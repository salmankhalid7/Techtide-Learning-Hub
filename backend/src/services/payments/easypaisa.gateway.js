/**
 * @file easypaisa.gateway.js
 * @description EasyPaisa payment provider adapter for the LearnX marketplace
 *              (Pakistan, PKR).
 *
 * EasyPaisa provides a hosted-payment + server-to-server IPN flow (similar to
 * JazzCash):
 *   1. createCheckout -> build the payment request (HMAC-signed); redirect the
 *        customer to the EasyPaisa payment page.
 *   2. EasyPaisa posts the result back to the return URL and IPN endpoint.
 *   3. verifyPayment / handleWebhook -> authenticate the postback and resolve
 *        the canonical status.
 *
 * Exact request/response fields and host endpoints differ between merchant
 * tiers and API versions; this adapter keeps the endpoint and signing scheme
 * configurable through env so it can be pointed at the correct sandbox/live
 * host without a code change. Where a merchant tier does not expose a refund
 * API, `refund` returns a clear, actionable error rather than silently failing.
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

class EasyPaisaGateway extends PaymentGateway {
    constructor() {
        super(PAYMENT_PROVIDERS.EASYPAISA);
        this.merchantId = config.payment?.easypaisa?.merchantId;
        this.storeId = config.payment?.easypaisa?.storeId;
        this.apiSecret = config.payment?.easypaisa?.apiSecret;
        this.currency = config.payment?.easypaisa?.currency || "PKR";
        this.sandbox = config.payment?.easypaisa?.sandbox !== false;
        // Configurable endpoint (sandbox/live).
        this.baseUrl =
            process.env.EASYPAISA_BASE_URL ||
            (this.sandbox
                ? "https://sandbox.easypaisa.com.pk/maas/payment"
                : "https://easypay.easypaisa.com.pk/maas/payment");
    }

    isConfigured() {
        return Boolean(
            config.payment?.easypaisa?.enabled &&
                this.merchantId &&
                this.storeId &&
                this.apiSecret
        );
    }

    _requireConfigured() {
        if (!this.isConfigured()) {
            throw new PaymentNotConfiguredError(
                "EasyPaisa is not configured. Set EASYPAISA_ENABLED, EASYPAISA_MERCHANT_ID, EASYPAISA_STORE_ID and EASYPAISA_API_SECRET."
            );
        }
    }

    /**
     * Compute an HMAC-SHA256 signature over the sorted request params with the
     * merchant secret. Timing-safe verification is used on inbound payloads.
     */
    _computeSignature(params) {
        const dataString = Object.keys(params)
            .filter((key) => key !== "signature" && key !== "checksum")
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join("&");

        return crypto
            .createHmac("sha256", this.apiSecret)
            .update(dataString)
            .digest("hex");
    }

    /**
     * Build an EasyPaisa hosted-payment request and return the gateway URL and
     * form fields.
     */
    async createCheckout({ payment, order, student, returnUrl, cancelUrl }) {
        this._requireConfigured();

        const orderRef = `${order._id.toString()}-${Date.now()}`;
        const amount = Math.round(payment.amount * 100); // paisa

        const params = {
            merchantId: this.merchantId,
            storeId: this.storeId,
            orderRef,
            orderId: order._id.toString(),
            paymentId: payment._id.toString(),
            studentId: student._id.toString(),
            amount: String(amount),
            currency: this.currency,
            successUrl: returnUrl,
            cancelUrl,
            // Merchant-provided metadata echoed back on the IPN.
            merchantHash: crypto
                .createHash("sha256")
                .update(payment._id.toString())
                .digest("hex")
                .slice(0, 40),
            apiVersion: "1.1",
        };

        params.signature = this._computeSignature(params);

        const gatewayUrl = `${this.baseUrl}/init`;

        logger.info("EasyPaisa checkout created", { orderRef, orderId: order._id });

        return {
            checkoutUrl: gatewayUrl,
            formFields: params,
            providerTransactionId: orderRef,
            providerStatus: "pending",
            raw: params,
            redirectMethod: "POST",
        };
    }

    /**
     * Resolve an EasyPaisa transaction status from an IPN/postback payload.
     */
    async verifyPayment({ providerTransactionId, params = null }) {
        this._requireConfigured();

        if (params) {
            _verifyEasyPaisaSignature(params, this.apiSecret);
            const status = _mapEasyPaisaStatus(params);
            return {
                status,
                providerTransactionId: params?.orderRef || params?.transactionId || providerTransactionId,
                providerStatus: params?.status || params?.responseCode || "",
                raw: params,
            };
        }

        // No reliable provider-side status GET across tiers; report pending.
        return {
            status: PAYMENT_STATUS.PENDING,
            providerTransactionId,
            providerStatus: "",
            raw: {},
        };
    }

    /**
     * Verify and handle an EasyPaisa IPN postback.
     */
    async handleWebhook(req) {
        this._requireConfigured();
        const params = { ...(req.body || {}) };

        if (Object.keys(params).length === 0) {
            throw new Error("EasyPaisa webhook received an empty payload.");
        }

        _verifyEasyPaisaSignature(params, this.apiSecret);

        return {
            event: "easypaisa.ipn",
            providerTransactionId: params?.orderRef || params?.transactionId || "",
            status: _mapEasyPaisaStatus(params),
            raw: params,
        };
    }

    /**
     * Refund via EasyPaisa. Requires a configured refund endpoint; otherwise a
     * clear, actionable error is thrown (never a silent failure).
     */
    async refund({ providerTransactionId, amount, currency, reason }) {
        this._requireConfigured();
        const refundUrl = process.env.EASYPAISA_REFUND_URL;
        if (!refundUrl) {
            throw new Error(
                "EasyPaisa refunds require the merchant refund API and EASYPAISA_REFUND_URL to be configured."
            );
        }

        const params = {
            merchantId: this.merchantId,
            storeId: this.storeId,
            orderRef: providerTransactionId,
            amount: String(Math.round(amount * 100)),
            currency: this.currency,
            reason: reason || "Refund",
        };
        params.signature = this._computeSignature(params);

        let response;
        try {
            response = await fetch(refundUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });
        } catch (err) {
            logger.error("EasyPaisa refund network error", { error: err.message });
            throw new Error(`EasyPaisa refund request failed: ${err.message}`);
        }

        const data = await response.json().catch(() => ({}));
        return {
            providerRefundId: data?.refundId || data?.transactionId || "",
            status: _mapEasyPaisaStatus(data) === PAYMENT_STATUS.SUCCEEDED
                ? PAYMENT_STATUS.REFUNDED
                : PAYMENT_STATUS.PENDING,
            raw: data,
        };
    }
}

/**
 * Verify an EasyPaisa postback signature using a timing-safe comparison.
 */
function _verifyEasyPaisaSignature(params, apiSecret) {
    const provided = params?.signature || params?.checksum;
    if (!provided) {
        throw new Error("EasyPaisa postback missing signature.");
    }

    const dataString = Object.keys(params)
        .filter((key) => key !== "signature" && key !== "checksum")
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");

    const expected = crypto
        .createHmac("sha256", apiSecret)
        .update(dataString)
        .digest("hex");

    const a = Buffer.from(String(provided).toLowerCase());
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Invalid EasyPaisa signature.");
    }
}

/**
 * Map an EasyPaisa postback status onto the canonical PAYMENT_STATUS.
 */
function _mapEasyPaisaStatus(params) {
    const code = String(params?.status ?? params?.responseCode ?? "").toLowerCase();
    const success = params?.success === true || params?.success === "true"
        || code === "success" || code === "000" || code === "succeeded";
    if (success) return PAYMENT_STATUS.SUCCEEDED;
    if (
        code === "" ||
        code === "pending" ||
        params?.status === null
    ) {
        return PAYMENT_STATUS.PENDING;
    }
    return PAYMENT_STATUS.FAILED;
}

const easyPaisaGateway = new EasyPaisaGateway();
export default easyPaisaGateway;
