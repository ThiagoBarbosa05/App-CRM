import { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Rate limit in-memory leve para endpoints específicos.
 * Não usa Redis — adequado para single-instance. Para horizontal scaling,
 * migrar para Redis/express-rate-limit + ioredis.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const { windowMs, max, keyFn, message } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn
      ? keyFn(req)
      : `${req.ip ?? "unknown"}:${req.path}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.setHeader("Retry-After", Math.ceil((b.resetAt - now) / 1000));
      res
        .status(429)
        .json({ message: message ?? "Muitas requisições, tente novamente" });
      return;
    }
    next();
  };
}

// Limpa buckets expirados a cada 5 min para evitar leak
setInterval(
  () => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  },
  5 * 60 * 1000,
).unref();
