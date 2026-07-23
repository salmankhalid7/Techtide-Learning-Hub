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
});

export default config;