import rateLimit from "express-rate-limit"; // Import rate-limiting middleware

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute time window
  max: 100,                 // Max 100 requests per IP per window
  standardHeaders: true,    // Send standard RateLimit headers
  legacyHeaders: false,     // Disable deprecated X-RateLimit headers
  message: {                // Custom response when rate limit is exceeded
    success: false,
    statusCode: 429,
    message: "Too many requests. Please try again later.",
  },
});

export default rateLimiter; // Export for use in the app