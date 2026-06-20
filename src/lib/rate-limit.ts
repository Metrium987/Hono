import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export const RATE_LIMIT_CONFIGS = {
  MAGIC_LINK:     { windowMs:     60_000, maxRequests:   5 },
  PUBLIC_QUOTE:   { windowMs:     60_000, maxRequests:  10 },
  API_KEYS:       { windowMs:  3_600_000, maxRequests:  20 },
  STRIPE_WEBHOOK: { windowMs:     60_000, maxRequests: 100 },
} as const;

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.windowMs}:${config.maxRequests}`;
  if (!limiterCache.has(cacheKey)) {
    const windowSec = Math.floor(config.windowMs / 1000);
    limiterCache.set(cacheKey, new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSec} s`),
      prefix: "hono_rl",
    }));
  }
  return limiterCache.get(cacheKey)!;
}

export async function rateLimit(key: string, config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  try {
    const limiter = getLimiter(config);
    const { success, remaining, reset } = await limiter.limit(key);
    return { allowed: success, remaining, resetAt: reset };
  } catch {
    // If Redis is unavailable, fail open to avoid blocking legitimate requests
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: Date.now() + config.windowMs };
  }
}
