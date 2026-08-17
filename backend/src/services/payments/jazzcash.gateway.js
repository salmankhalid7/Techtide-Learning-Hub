/**
 * @file jazzcash.gateway.js
 * @description JazzCash payment provider adapter for the LearnX marketplace
 *              (Pakistan, PKR).
 *
 * JazzCash uses a redirect (hosted-payment) + server-to-server IPN flow:
 *   1. createCheckout -> build a signed payment request; redirect the customer
 *        to the JazzCash payment page (via a 302 / returned URL).
 *   2. JazzCash posts back to the customer's `pp_ReturnURL`, then sends a
 *        server-to-server IPN to the merchant gateway with the same params.
 *   3. verifyPayment / handleWebhook -> authenticate the IPN with the
 *        integrity salt and resolve the canonical status.
 *
 * Security: every outbound request is HMAC-signed with the integrity salt;
 * every inbound IPN is signature-verified with a timing-safe comparison. All
 * amounts are sent in paisa (amount * 100), integer only.
 *
 * NOTE: exact endpoint hosts vary by merchant tier/region. The base URL is
 * configurable via env so it can point at the sandbox or live host without a
 * code change.
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

class JazzCashGateway extends PaymentGateway {
    constructor() {
        super(PAYMENT_PROVIDERS.JAZZCASH);
        this.merchantId = config.payment?.jazzcash?.merchantId;
        this.password = config.payment?.jazzcash?.password;
        this.integritySalt = config.payment?.jazzcash?.integritySalt;
        this.currency = config.payment?.jazzcash?.currency || "PKR";
        this.sandbox = config.payment?.jazzcash?.sandbox !== false;
        // Configurable endpoint so it can target either sandbox or live.
        this.baseUrl =
            process.env.JAZZCASH_BASE_URL ||
            (this.sandbox
                ? "https://sandbox.jazzcash.com.pk/ApplicationAPI/Payment"
                : "https://payments.jazzcash.com.pk/ApplicationAPI/Payment");
    }

    isConfigured() {
        return Boolean(
            config.payment?.jazzcash?.enabled &&
                this.merchantId &&
                this.password &&
                this.integritySalt
        );
    }

    _requireConfigured() {
        if (!this.isConfigured()) {
            throw new PaymentNotConfiguredError(
                "JazzCash is not configured. Set JAZZCASH_ENABLED, JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD and JAZZCASH_INTEGRITY_SALT."
            );
        }
    }

    /**
     * Build the signed JazzCash payment request hash.
     *
     * JazzCash expects a SHA-256 of the alphabetically-sorted key=value pairs
     * (excluding pp_SecureHash itself), concatenated and appended with the
     * integrity salt, all uppercased.
     */
    _computeSecureHash(params) {
        const hashString = Object.keys(params)
            .filter((key) => key !== "pp_SecureHash")
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join("&")
            .concat("&", this.integritySalt);

        return crypto
            .createHash("sha256")
            .update(hashString)
            .digest("hex")
            .toUpperCase();
    }

    /**
     * Create a signed JazzCash payment request and return the gateway URL plus
     * the request form fields so the client can render a redirect.
     */
    async createCheckout({ payment, order, student, returnUrl, cancelUrl }) {
        this._requireConfigured();

        const txnRef = `LXP-${payment._id.toString()}-${Date.now()}`;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const txnDateTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
            now.getDate()
        )}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        const amountPaisa = Math.round(payment.amount * 100);

        const params = {
            pp_Version: "1.1",
            pp_TxnType: "MWALLET",
            pp_Language: "EN",
            pp_MerchantID: this.merchantId,
            pp_Password: this.password,
            pp_TxnRefNo: txnRef,
            pp_Amount: String(amountPaisa),
            pp_TxnCurrency: this.currency,
            pp_TxnDateTime: txnDateTime,
            pp_BillReference: order._id.toString(),
            pp_Description: `LearnX order ${order._id.toString()}`,
            pp_ReturnURL: returnUrl,
            // Metadata carried through the round-trip so we can resolve the order.
            pp_MerchantCode: payment._id.toString(),
            pp_ProductID: order.items?.[0]?.course?.toString() || "",
            // Cancellation destination (JazzCash posts a FAILED state here).
            pp_CancelURL: cancelUrl,
        };

        params.pp_SecureHash = this._computeSecureHash(params);

        const gatewayUrl = `${this.baseUrl}/DoPayment`;

        logger.info("JazzCash checkout created", { txnRef, orderId: order._id });

        return {
            checkoutUrl: gatewayUrl,
            // The form is POSTed by the client to `checkoutUrl` with `fields`.
            formFields: params,
            providerTransactionId: txnRef,
            providerStatus: "pending",
            raw: params,
            redirectMethod: "POST",
        };
    }

    /**
     * Resolve a JazzCash transaction's status from an IPN/postback payload.
     *
     * @param {object} params - the returned/IPN parameter object.
     * @returns {{ status:string, providerTransactionId:string, providerStatus:string, raw:object }}
     */
    async verifyPayment({ providerTransactionId, params = null }) {
        this._requireConfigured();

        if (params) {
            // IPN/postback verification path.
            _verifyJazzCashSignature(params, this.integritySalt);
            const status = _mapJazzCashResponse(params?.pp_ResponseCode);
            return {
                status,
                providerTransactionId: params?.pp_TxnRefNo || providerTransactionId,
                providerStatus: params?.pp_ResponseCode || "",
                raw: params,
            };
        }

        // No provider-side transaction-status GET is guaranteed across tiers.
        // Without a postback we can only report the last known state as pending
        // and ask the caller to poll for the IPN.
        return {
            status: PAYMENT_STATUS.PENDING,
            providerTransactionId,
            providerStatus: "",
            raw: {},
        };
    }

    /**
     * Verify and handle a JazzCash server-to-server IPN postback.
     */
    async handleWebhook(req) {
        this._requireConfigured();
        const params = { ...(req.body || {}) };

        if (Object.keys(params).length === 0) {
            throw new Error("JazzCash webhook received an empty payload.");
        }

        _verifyJazzCashSignature(params, this.integritySalt);

        const status = _mapJazzCashResponse(params.pp_ResponseCode);
        return {
            event: "jazzcash.ipn",
            providerTransactionId: params.pp_TxnRefNo || "",
            status,
            raw: params,
        };
    }

    /**
     * JazzCash refunds are not universally available on the standard merchant
     * API. When the merchant tier supports it, configure the refund endpoint.
     * Otherwise this throws a clear, actionable error (never silently fails).
     */
    async refund({ providerTransactionId, amount, currency, reason }) {
        this._requireConfigured();
        const refundUrl = process.env.JAZZCASH_REFUND_URL;
        if (!refundUrl) {
            throw new Error(
                "JazzCash refunds require the merchant refund API and JAZZCASH_REFUND_URL to be configured."
            );
        }

        const txnRef = `RF-${Date.now()}`;
        const params = {
            pp_Version: "1.1",
            pp_TxnType: "MERCHANT_SALE_REFUND",
            pp_Language: "EN",
            pp_MerchantID: this.merchantId,
            pp_Password: this.password,
            pp_Amount: String(Math.round(amount * 100)),
            pp_TxnRefNo: txnRef,
            pp_OriginalTxnRefNo: providerTransactionId,
            pp_BillReference: providerTransactionId,
            pp_Description: reason || "Refund",
        };
        params.pp_SecureHash = this._computeSecureHash(params);

        let response;
        try {
            response = await fetch(refundUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(params).toString(),
            });
        } catch (err) {
            logger.error("JazzCash refund network error", { error: err.message });
            throw new Error(`JazzCash refund request failed: ${err.message}`);
        }

        const data = await response.json().catch(() => ({}));
        const succeeded = data?.pp_ResponseCode === "000";

        return {
            providerRefundId: data?.pp_TxnRefNo || "",
            status: succeeded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PENDING,
            raw: data,
        };
    }
}

/**
 * Verify a JazzCash postback/IPN signature using a timing-safe comparison.
 */
function _verifyJazzCashSignature(params, integritySalt) {
    const provided = params?.pp_SecureHash;
    if (!provided) {
        throw new Error("JazzCash postback missing pp_SecureHash.");
    }

    const hashString = Object.keys(params)
        .filter((key) => key !== "pp_SecureHash")
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&")
        .concat("&", integritySalt);

    const expected = crypto
        .createHash("sha256")
        .update(hashString)
        .digest("hex")
        .toUpperCase();

    const a = Buffer.from(String(provided).toUpperCase());
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Invalid JazzCash signature.");
    }
}

/**
 * Map a JazzCash response code onto the canonical PAYMENT_STATUS.
 * "000" = success; other codes are failures.
 */
function _mapJazzCashResponse(responseCode) {
    if (responseCode === "000") return PAYMENT_STATUS.SUCCEEDED;
    if (responseCode == null || responseCode === "") return PAYMENT_STATUS.PENDING;
    return PAYMENT_STATUS.FAILED;
}

const jazzCashGateway = new JazzCashGateway();
export default jazzCashGateway;
