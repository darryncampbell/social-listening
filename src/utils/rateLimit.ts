/**
 * Simple in-memory rate limiter
 * For production, consider using @upstash/ratelimit with Redis
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on server restart)
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (usually IP address)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();
  
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;
  
  const entry = store.get(key);
  
  if (!entry || now > entry.resetTime) {
    // First request or window expired - create new entry
    store.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    };
  }
  
  // Within existing window
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);
  
  if (entry.count >= config.limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetIn,
    };
  }
  
  // Increment counter
  entry.count++;
  
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn,
  };
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback - use a default identifier
  return 'unknown';
}

// Pre-configured rate limiters for different endpoints
export const RATE_LIMITS = {
  // Proxy: 30 requests per minute (for RSS syncing)
  proxy: { limit: 30, windowSeconds: 60 },
  
  // AI generation: 10 requests per minute (expensive operation)
  generateReply: { limit: 10, windowSeconds: 60 },
  
  // API key config: 5 requests per minute (sensitive operation)
  apiKeyConfig: { limit: 5, windowSeconds: 60 },
} as const;
