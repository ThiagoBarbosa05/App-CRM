/**
 * Token bucket rate limiter.
 * Allows up to `capacity` burst requests, then throttles to `ratePerSecond` req/s.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;
  private readonly refillRatePerMs: number;

  constructor(
    private readonly capacity: number,
    ratePerSecond: number,
  ) {
    this.tokens = capacity;
    this.lastRefillAt = Date.now();
    this.refillRatePerMs = ratePerSecond / 1000;
  }

  async consume(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for one token to become available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    return this.consume();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillAt = now;
  }
}
