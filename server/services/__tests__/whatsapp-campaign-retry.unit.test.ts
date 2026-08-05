import { describe, it, expect } from "vitest";
import { classifySendError, computeBackoffMs } from "../whatsapp-campaign-retry";
import { WhatsAppApiError } from "server/integrations/whatsapp";

describe("classifySendError", () => {
  describe("WhatsAppApiError status codes", () => {
    it("should classify 429 (rate limit) as retryable", () => {
      const err = new WhatsAppApiError("Rate limit", 429);
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify 500 (server error) as retryable", () => {
      const err = new WhatsAppApiError("Server error", 500);
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify 503 (service unavailable) as retryable", () => {
      const err = new WhatsAppApiError("Service unavailable", 503);
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify 502 (bad gateway) as retryable", () => {
      const err = new WhatsAppApiError("Bad gateway", 502);
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify 400 (bad request) as permanent", () => {
      const err = new WhatsAppApiError("Bad request", 400);
      expect(classifySendError(err)).toBe("permanent");
    });

    it("should classify 404 (not found) as permanent", () => {
      const err = new WhatsAppApiError("Not found", 404);
      expect(classifySendError(err)).toBe("permanent");
    });

    it("should classify 401 (unauthorized) as permanent", () => {
      const err = new WhatsAppApiError("Unauthorized", 401);
      expect(classifySendError(err)).toBe("permanent");
    });
  });

  describe("Network errors", () => {
    it("should classify ECONNRESET as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "ECONNRESET";
      err.message = "Connection reset";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify ECONNREFUSED as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "ECONNREFUSED";
      err.message = "Connection refused";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify ETIMEDOUT as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "ETIMEDOUT";
      err.message = "Operation timed out";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify EPIPE as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "EPIPE";
      err.message = "Broken pipe";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify EAI_AGAIN as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "EAI_AGAIN";
      err.message = "Temporary failure";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify UND_ERR_* errors as retryable", () => {
      const err = Object.create(Error.prototype);
      err.code = "UND_ERR_SOCKET_HANG_UP";
      err.message = "Socket hang up";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify TypeError (fetch/undici) as retryable", () => {
      const err = new TypeError("fetch failed");
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify AbortError as retryable", () => {
      const err = Object.create(Error.prototype);
      err.name = "AbortError";
      err.message = "The operation was aborted";
      expect(classifySendError(err)).toBe("retryable");
    });

    it("should classify TimeoutError as retryable", () => {
      const err = Object.create(Error.prototype);
      err.name = "TimeoutError";
      err.message = "Operation timeout";
      expect(classifySendError(err)).toBe("retryable");
    });
  });

  describe("Generic errors", () => {
    it("should classify generic Error as permanent", () => {
      const err = new Error("boom");
      expect(classifySendError(err)).toBe("permanent");
    });

    it("should classify unknown error as permanent", () => {
      expect(classifySendError("some string error")).toBe("permanent");
      expect(classifySendError(null)).toBe("permanent");
      expect(classifySendError(undefined)).toBe("permanent");
      expect(classifySendError({ message: "custom" })).toBe("permanent");
    });
  });
});

describe("computeBackoffMs", () => {
  it("should return monotonically increasing backoff delays", () => {
    const delays: number[] = [];
    for (let i = 0; i <= 5; i++) {
      delays.push(computeBackoffMs(i));
    }

    // Verify strictly increasing
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it("should follow exponential backoff pattern: 5s, 10s, 20s, 40s, 80s", () => {
    expect(computeBackoffMs(0)).toBe(5000); // 5s
    expect(computeBackoffMs(1)).toBe(10000); // 10s
    expect(computeBackoffMs(2)).toBe(20000); // 20s
    expect(computeBackoffMs(3)).toBe(40000); // 40s
    expect(computeBackoffMs(4)).toBe(80000); // 80s
  });

  it("should cap backoff at 300 seconds (5 minutes)", () => {
    // At attempt 6: 5 * 2^6 = 320s, should be capped to 300s
    expect(computeBackoffMs(6)).toBe(300000);
    // At attempt 7: 5 * 2^7 = 640s, should be capped to 300s
    expect(computeBackoffMs(7)).toBe(300000);
    // Verify higher attempts also cap at 300s
    expect(computeBackoffMs(10)).toBe(300000);
  });

  it("should handle attempt 0", () => {
    expect(computeBackoffMs(0)).toBe(5000);
  });

  it("should return value in milliseconds", () => {
    const result = computeBackoffMs(0);
    expect(result).toBe(5000);
    expect(typeof result).toBe("number");
  });
});
