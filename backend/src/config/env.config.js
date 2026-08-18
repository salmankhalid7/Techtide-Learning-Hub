import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Retrieves a required environment variable.
 * Uses console.error to avoid a circular dependency
 * (logger.js imports this config module).
 */
function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * Retrieves a required environment variable and parses it as a number.
 */
function requireNumber(name) {
  const value = Number(requireEnv(name));

  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a valid number`);
  }

  return value;
}

/**
 * The only allowed NODE_ENV values.
 */
const VALID_NODE_ENVS = ["development", "production", "test"];

/**
 * Validates that env is one of the allowed values.
 */
function requireNodeEnv(name) {
  const value = requireEnv(name);

  if (!VALID_NODE_ENVS.includes(value)) {
    throw new Error(
      `${name} must be one of: ${VALID_NODE_ENVS.join(", ")}. Got: "${value}"`
    );
  }

  return value;
}

/* ------------------------------------------------------------------ */
/*  Configuration object                                               */
/* ------------------------------------------------------------------ */

const config = Object.freeze({
  security: Object.freeze({
    bcryptSaltRounds: requireNumber("BCRYPT_SALT_ROUNDS"),
  }),

  pagination: Object.freeze({
    defaultPageSize: requireNumber("DEFAULT_PAGE_SIZE"),
    maxPageSize: requireNumber("MAX_PAGE_SIZE"),
  }),

  app: Object.freeze({
    name: requireEnv("APP_NAME"),
    env: requireNodeEnv("NODE_ENV"),
    port: requireNumber("PORT"),
    apiVersion: requireEnv("API_VERSION"),
  }),

  database: Object.freeze({
    uri: requireEnv("MONGODB_URI"),
  }),

  jwt: Object.freeze({
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    accessExpiresIn: requireEnv("JWT_ACCESS_EXPIRES_IN"),

    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    refreshExpiresIn: requireEnv("JWT_REFRESH_EXPIRES_IN"),
  }),

  // Cloudinary media storage (optional — no requireEnv)
  cloudinary: Object.freeze({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  }),

  client: Object.freeze({
    url: requireEnv("CLIENT_URL"),
  }),

  cookie: Object.freeze({
    secret: requireEnv("COOKIE_SECRET"),
  }),

  logger: Object.freeze({
    level: process.env.LOG_LEVEL || "info",
  }),

  // OAuth is optional — values may be empty until configured
  oauth: Object.freeze({
    google: Object.freeze({
      clientId: process.env.GOOGLE_CLIENT_ID || undefined,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || undefined,
    }),

    github: Object.freeze({
      clientId: process.env.GITHUB_CLIENT_ID || undefined,
      clientSecret: process.env.GITHUB_CLIENT_SECRET || undefined,
      callbackURL: process.env.GITHUB_CALLBACK_URL || undefined,
    }),
  }),
  // Mail is optional — values may be empty until configured
  mail: Object.freeze({
    host: process.env.MAIL_HOST || undefined,
    port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : undefined,
    user: process.env.MAIL_USER || undefined,
    pass: process.env.MAIL_PASS || undefined,
    from: process.env.MAIL_FROM || undefined,
  }),

  // AI evaluation is optional — when unconfigured the task evaluator falls
  // back to its deterministic heuristic so the feature stays functional.
  // `provider` drives sensible defaults for `baseUrl`/`model` when the env
  // values are not provided explicitly (Groq is supported natively).
  ai: Object.freeze({
    enabled: process.env.AI_EVAL_ENABLED === "true",
    provider: process.env.AI_EVAL_PROVIDER || "groq",
    apiKey: process.env.AI_EVAL_API_KEY || undefined,

    // Resolve provider-aware defaults using the resolved `provider` above so
    // they stay consistent (e.g. provider=groq => groq base URL + model).
    baseUrl:
      process.env.AI_EVAL_BASE_URL ||
      ((process.env.AI_EVAL_PROVIDER || "groq") === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1"),

    model:
      process.env.AI_EVAL_MODEL ||
      ((process.env.AI_EVAL_PROVIDER || "groq") === "groq"
        ? "llama-3.3-70b-versatile"
        : "gpt-4o-mini"),

    temperature: process.env.AI_EVAL_TEMPERATURE
      ? Number(process.env.AI_EVAL_TEMPERATURE)
      : 0.2,
    maxTokens: process.env.AI_EVAL_MAX_TOKENS
      ? Number(process.env.AI_EVAL_MAX_TOKENS)
      : 2000,
    timeoutMs: process.env.AI_EVAL_TIMEOUT_MS
      ? Number(process.env.AI_EVAL_TIMEOUT_MS)
      : 30000,
  }),

  // Payments / marketplace is optional — the app boots without any payment
  // keys configured. Each provider block uses `process.env.X || undefined` so
  // it never crashes when unset. Providers report "not configured" at runtime
  // until real/sandbox credentials are added.
  payment: Object.freeze({
    // Platform commission (percent of each sale retained by the platform).
    // Default 30 => the company keeps 30% and the instructor earns 70%.
    commissionRatePercent: process.env.PAYMENT_COMMISSION_RATE
      ? Number(process.env.PAYMENT_COMMISSION_RATE)
      : 30,

    // Base URL used to build webhook links / redirect URLs.
    webhookBaseUrl: process.env.PAYMENT_WEBHOOK_BASE_URL || undefined,
    appBaseUrl: process.env.PAYMENT_APP_BASE_URL || undefined,

    stripe: Object.freeze({
      enabled: process.env.STRIPE_ENABLED === "true",
      secretKey: process.env.STRIPE_SECRET_KEY || undefined,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || undefined,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
      currency: process.env.STRIPE_CURRENCY || "usd",
    }),

    jazzcash: Object.freeze({
      enabled: process.env.JAZZCASH_ENABLED === "true",
      merchantId: process.env.JAZZCASH_MERCHANT_ID || undefined,
      password: process.env.JAZZCASH_PASSWORD || undefined,
      integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || undefined,
      currency: process.env.JAZZCASH_CURRENCY || "PKR",
      // Sandbox vs live endpoint.
      sandbox: process.env.JAZZCASH_SANDBOX !== "false",
    }),

    easypaisa: Object.freeze({
      enabled: process.env.EASYPAISA_ENABLED === "true",
      merchantId: process.env.EASYPAISA_MERCHANT_ID || undefined,
      storeId: process.env.EASYPAISA_STORE_ID || undefined,
      apiSecret: process.env.EASYPAISA_API_SECRET || undefined,
      currency: process.env.EASYPAISA_CURRENCY || "PKR",
      // Sandbox vs live endpoint.
      sandbox: process.env.EASYPAISA_SANDBOX !== "false",
    }),
  }),
});

export default config;