/**
 * @file stripe.gateway.js
 * @description Stripe payment provider adapter for the LearnX marketplace.
 *
 * Handles international payments (USD/etc.) via Stripe's REST API using the
 * project's existing global `fetch` — no SDK dependency. Implements the
 * `PaymentGateway` contract (see gateway.interface.js).
 *
 * Workflow:
 *   1. createCheckout  -> Stripe Checkout Session (hosted) / PaymentIntent.
 *   2. verifyPayment   -> retrieve the PaymentIntent/Checkout Session.
 *   3. handleWebhook   -> verify the Stripe-Signature, return canonical status.
 *   4. refund          -> Stripe Refund API.
 *
 * Security: webhook payloads are signature-verified with the webhook secret
 * (HMAC-SHA256 + timing-safe compare). API calls use the secret key.
 */

import crypto from "crypto";

import { config } from "../../config/index.js";
import logger from "../../config/logger.js";
import {
    PaymentGateway,
    PaymentNotConfiguredError,
} from "./gateway.interface.js";
import {
    PAYMENT_STATUS,
    PAYMENT_PROVIDERS,
} from "../../constants/payment.constants.js";

const STRIPE_API_BASE = "https://api.stripe.com";

class StripeGateway extends PaymentGateway {
    constructor() {
        super(PAYMENT_PROVIDERS.STRIPE);
        this.secretKey = config.payment?.stripe?.secretKey;
        this.publishableKey = config.payment?.stripe?.publishableKey;
        this.webhookSecret = config.payment?.stripe?.webhookSecret;
        this.currency = config.payment?.stripe?.currency || "usd";
    }

    isConfigured() {
        return Boolean(
            config.payment?.stripe?.enabled &&
                this.secretKey &&
                this.publishableKey
        );
    }

    _requireConfigured() {
        if (!this.isConfigured()) {
            throw new PaymentNotConfiguredError(
                "Stripe is not configured. Set STRIPE_ENABLED, STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY."
            );
        }
    }

    /**
     * Low-level Stripe API request wrapper.
     */
    async _request({ method = "GET", path = "", body = null, idempotencyKey = null }) {
        this._requireConfigured();
        const headers = {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        };
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

        let bodyStr = "";
        if (body && Object.keys(body).length > 0) {
            bodyStr = new URLSearchParams(body).toString();
        }

        let response;
        try {
            response = await fetch(`${STRIPE_API_BASE}${path}`, {
                method,
                headers,
                body: method === "GET" ? undefined : bodyStr,
            });
        } catch (err) {
            logger.error("Stripe network error", { path, error: err.message });
            throw new Error(`Stripe request failed: ${err.message}`);
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const msg = data?.error?.message || data?.error?.code || "Stripe error";
            logger.error("Stripe API error", { path, status: response.status, msg });
            throw new Error(`Stripe error (${response.status}): ${msg}`);
        }

        return data;
    }

    /**
     * Create a Stripe Checkout Session for a hosted payment page.
     *
     * @returns {{ checkoutUrl:string, providerTransactionId:string,
     *            providerStatus:string, raw:object }}
     */
    async createCheckout({ payment, order, student, returnUrl, cancelUrl }) {
        this._requireConfigured();

        const amountCents = Math.round(payment.amount * 100);

        // Attach metadata so webhooks/verification can resolve the order.
        const session = await this._request({
            method: "POST",
            path: "/v1/checkout/sessions",
            body: {
                mode: "payment",
                success_url: returnUrl,
                cancel_url: cancelUrl,
                client_reference_id: order._id.toString(),
                metadata: {
                    paymentId: payment._id.toString(),
                    orderId: order._id.toString(),
                    studentId: student._id.toString(),
                },
                line_items: order.items.map((item) => ({
                    price_data: {
                        currency: this.currency,
                        product_data: { name: item.courseTitle || "Course" },
                        unit_amount: amountCents,
                    },
                    quantity: item.quantity || 1,
                })),
            },
            idempotencyKey: payment.idempotencyKey,
        });

        return {
            checkoutUrl: session?.url || null,
            providerTransactionId: session?.id || null,
            providerStatus: session?.status || "open",
            raw: session,
        };
    }

    /**
     * Verify a payment's current status with Stripe.
     *
     * @returns {{ status:string, providerStatus:string, raw:object }}
     */
    async verifyPayment({ providerTransactionId }) {
        this._requireConfigured();
        const session = await this._request({
            method: "GET",
            path: `/v1/checkout/sessions/${encodeURIComponent(providerTransactionId)}`,
        });

        return {
            status: _mapStripeStatus(session?.payment_status, session?.status),
            providerStatus: session?.payment_status || session?.status || "",
            raw: session,
        };
    }

    /**
     * Handle and verify an incoming Stripe webhook.
     *
     * @param {object} req - Express request (raw body needed for signature).
     * @returns {{ event:string, providerTransactionId:string, status:string,
     *            raw:object }}
     * @throws Error if signature verification fails.
     */
    async handleWebhook(req) {
        this._requireConfigured();
        if (!this.webhookSecret) {
            throw new Error("Stripe webhook secret is not configured.");
        }

        _verifyStripeSignature(req, this.webhookSecret);

        const event = req.body;
        const eventType = event?.type || "";
        const data = event?.data?.object || {};

        let providerTransactionId = "";
        let status = PAYMENT_STATUS.PENDING;

        if (eventType === "checkout.session.completed") {
            providerTransactionId = data?.id || "";
            status = _mapStripeStatus(data?.payment_status, data?.status);
        } else if (eventType === "checkout.session.expired") {
            providerTransactionId = data?.id || "";
            status = PAYMENT_STATUS.CANCELLED;
        } else if (eventType?.startsWith("charge.")) {
            providerTransactionId = data?.payment_intent || data?.id || "";
            status = _mapChargeStatus(eventType);
        } else if (eventType === "payment_intent.succeeded") {
            providerTransactionId = data?.id || "";
            status = PAYMENT_STATUS.SUCCEEDED;
        }

        return {
            event: eventType,
            providerTransactionId,
            status,
            raw: event,
        };
    }

    /**
     * Issue a full or partial refund via Stripe.
     *
     * @returns {{ providerRefundId:string, status:string, raw:object }}
     */
    async refund({ providerTransactionId, amount, currency, reason }) {
        this._requireConfigured();
        if (!providerTransactionId) {
            throw new Error("Stripe refund requires a providerTransactionId.");
        }

        const body = { reason: "requested_by_customer" };
        if (amount != null) {
            body.amount = Math.round(amount * 100);
        }
        if (reason) {
            body.metadata = { note: reason };
        }

        const refund = await this._request({
            method: "POST",
            path: "/v1/refunds",
            body,
            idempotencyKey: `refund-${providerTransactionId}-${Date.now()}`,
        });

        return {
            providerRefundId: refund?.id || "",
            status: refund?.status === "succeeded"
                ? PAYMENT_STATUS.REFUNDED
                : PAYMENT_STATUS.PROCESSING,
            raw: refund,
        };
    }
}

/**
 * Map Stripe checkout/payment statuses onto the canonical PAYMENT_STATUS.
 */
function _mapStripeStatus(paymentStatus, sessionStatus) {
    if (paymentStatus === "paid") return PAYMENT_STATUS.SUCCEEDED;
    if (paymentStatus === "unpaid") {
        // A session with status canceled/expired is treated as cancelled.
        if (sessionStatus === "expired" || sessionStatus === "canceled") {
            return PAYMENT_STATUS.CANCELLED;
        }
        return PAYMENT_STATUS.PENDING;
    }
    if (sessionStatus === "expired" || sessionStatus === "canceled") {
        return PAYMENT_STATUS.CANCELLED;
    }
    return PAYMENT_STATUS.PENDING;
}

/**
 * Map a charge.* webhook type onto the canonical status.
 */
function _mapChargeStatus(eventType) {
    if (eventType === "charge.succeeded") return PAYMENT_STATUS.SUCCEEDED;
    if (eventType === "charge.failed") return PAYMENT_STATUS.FAILED;
    if (eventType === "charge.refunded") return PAYMENT_STATUS.REFUNDED;
    return PAYMENT_STATUS.PROCESSING;
}

/**
 * Verify the Stripe-Signature header (HMAC-SHA256 over the raw body) using a
 * timing-safe comparison. Escalates any failure to a thrown error so the
 * webhook endpoint never trusts an invalid signature.
 */
function _verifyStripeSignature(req, secret) {
    const signatureHeader = req.headers["stripe-signature"];
    if (!signatureHeader) {
        throw new Error("Missing Stripe-Signature header.");
    }

    // Stripe signature format: t=<timestamp>,v1=<signature>
    const parts = signatureHeader.split(",").reduce((acc, part) => {
        const [k, v] = part.split("=");
        acc[k.trim()] = v;
        return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.v1;

    if (!timestamp || !signature) {
        throw new Error("Malformed Stripe-Signature header.");
    }

    // Rebuild the signed payload: <timestamp>.<rawBody>
    const rawBody = req.rawBody != null ? req.rawBody : JSON.stringify(req.body);
    const signedPayload = `${timestamp}.${rawBody}`;

    const expected = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

    // Timing-safe comparison.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Invalid Stripe webhook signature.");
    }

    // Replay protection: reject signatures older than 5 minutes.
    const toleranceSeconds = 300;
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Math.abs(now - ts) > toleranceSeconds) {
        throw new Error("Stripe webhook timestamp is outside the tolerance window.");
    }
}

const stripeGateway = new StripeGateway();
export default stripeGateway;
