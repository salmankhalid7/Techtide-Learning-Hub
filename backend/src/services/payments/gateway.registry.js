/**
 * @file gateway.registry.js
 * @description Registry that maps provider names to their gateway adapters.
 *
 * The checkout/finance services ask the registry for a gateway by provider name
 * (e.g. "stripe", "jazzcash", "easypaisa") and never import a concrete provider
 * directly, keeping the whole marketplace provider-agnostic.
 */

import {
    PAYMENT_PROVIDERS,
} from "../../constants/payment.constants.js";
import stripeGateway from "./stripe.gateway.js";
import jazzCashGateway from "./jazzcash.gateway.js";
import easyPaisaGateway from "./easypaisa.gateway.js";

/**
 * All registered gateways keyed by provider name.
 */
const gateways = Object.freeze({
    [PAYMENT_PROVIDERS.STRIPE]: stripeGateway,
    [PAYMENT_PROVIDERS.JAZZCASH]: jazzCashGateway,
    [PAYMENT_PROVIDERS.EASYPAISA]: easyPaisaGateway,
});

/**
 * Resolve a gateway adapter by provider name.
 *
 * @param {string} provider - one of PAYMENT_PROVIDERS.
 * @returns {object} the gateway adapter.
 * @throws {Error} if the provider is unknown.
 */
export const getGateway = (provider) => {
    const gateway = gateways[provider];
    if (!gateway) {
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
    return gateway;
};

/**
 * List of all configured providers (name + whether credentials exist).
 */
export const listGateways = () =>
    Object.values(PAYMENT_PROVIDERS).map((name) => ({
        provider: name,
        configured: gateways[name].isConfigured(),
    }));

export default getGateway;
