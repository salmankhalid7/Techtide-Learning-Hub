import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import morganStream from "./utils/morganStream.js";

import { config } from "./config/index.js";
import constants from "./config/constants.js";
import routes from "./routes/index.js";
import notFound from "./middlewares/notFound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import rateLimiter from "./middlewares/rateLimiter.middleware.js";


const app = express();

// ──────────────────────────────────────────────
// Security Headers
// ──────────────────────────────────────────────
/**
 * Configure common HTTP security headers.
 * crossOriginResourcePolicy set to "cross-origin"
 * so Cloudinary-hosted assets load without issues.
*/
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);


// Rate Limiter
app.use(rateLimiter);

// CORS
app.use(
  cors({
    origin: config.client.url,
    credentials: true,
  })
);

// Compression
app.use(compression());

// Body Parsers
/**
 * Parse incoming JSON requests.
 * Limit payload size to reduce abuse.
 */
app.use(
  express.json({
    limit: "10mb",
  })
);
/**
 * Parse URL-encoded form data.
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
// Prevent NoSQL Injection
// Using mongoSanitize.sanitize() instead of middleware to avoid
// Express 5's read-only req.query getter conflict
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  if (req.headers) req.headers = mongoSanitize.sanitize(req.headers);
  // Sanitize query and replace the getter-only property by redefining it
  const sanitizedQuery = mongoSanitize.sanitize(req.query);
  Object.defineProperty(req, "query", {
    value: sanitizedQuery,
    writable: false,
    configurable: true,
    enumerable: true,
  });
  next();
});
// Prevent HTTP Parameter Pollution
app.use(hpp());

// Cookies
app.use(cookieParser(config.cookie.secret));

// Forward HTTP request logs to the centralized logger.
app.use(
  morgan("combined", {
    stream: morganStream,
  })
);

// API Routes
app.use(
  `${constants.APP.API_PREFIX}/${config.app.apiVersion}`,
  routes
);

app.use("/api/v1", routes);
// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

// Disable the X-Powered-By header to avoid exposing Express
app.disable("x-powered-by");

export default app;