import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register, password reset)
 * Prevents brute force attacks and credential stuffing
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  // Use default key generator with IPv6-safe handling
});

/**
 * Rate limiter for public tracking endpoints (open, click, submit)
 * Prevents abuse and bot traffic from skewing metrics
 */
export const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 100 tracking events per minute per IP
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  // Use default key generator with IPv6-safe handling
});

/**
 * Rate limiter for general API endpoints
 * Protects against excessive API usage
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  // Use default key generator; consider user-scoped limiter if needed
});

/**
 * Stricter rate limiter for admin operations
 * Protects sensitive operations like user creation, deletion, settings changes
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 admin operations per 15 minutes
  message: 'Too many admin operations. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Use default key generator; consider user-scoped limiter if needed
});
