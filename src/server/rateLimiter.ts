/**
 * VoxStory AI - High Performance In-Memory Rate Limiting Middleware
 * Protects paid generation endpoints and prevents denial-of-service or quota exhaustion.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  endpointCategory: 'generation' | 'general';
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, endpointCategory } = options;
  const ipMap = new Map<string, RateLimitEntry>();

  // Cleanup stale IPs every 5 minutes (unref so tests exit cleanly)
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipMap.entries()) {
      if (now - entry.lastRefill > windowMs * 2) {
        ipMap.delete(ip);
      }
    }
  }, 300000);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const now = Date.now();
    let entry = ipMap.get(ip);

    if (!entry) {
      entry = { tokens: maxRequests - 1, lastRefill: now };
      ipMap.set(ip, entry);
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
      return next();
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    if (elapsed >= windowMs) {
      entry.tokens = maxRequests;
      entry.lastRefill = now;
    }

    if (entry.tokens > 0) {
      entry.tokens -= 1;
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', entry.tokens.toString());
      return next();
    }

    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil((windowMs - elapsed) / 1000);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('Retry-After', retryAfterSeconds.toString());

    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded for ${endpointCategory} operations. Maximum ${maxRequests} requests per ${Math.round(windowMs / 1000)} seconds.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds,
    });
  };
}

// Preset rate limiters:
// Generation endpoints: 30 requests per minute
export const generationRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  endpointCategory: 'generation',
});

// General API endpoints: 180 requests per minute
export const generalRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 180,
  endpointCategory: 'general',
});
