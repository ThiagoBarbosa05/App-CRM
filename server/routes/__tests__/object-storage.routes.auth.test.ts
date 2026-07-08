import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createObjectStorageApiRouter } from "../object-storage.routes";

const { s3SendMock } = vi.hoisted(() => ({
  s3SendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();

  class MockS3Client {
    send = s3SendMock;
  }

  return {
    ...actual,
    S3Client: MockS3Client,
  };
});

describe("object storage routers — auth enforcement (real requireAuth)", () => {
  beforeEach(() => {
    s3SendMock.mockReset();
  });

  it("rejects /api/upload without an auth cookie", async () => {
    const app = createObjectStorageApiRouter();

    const response = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from("hello"), "doc.pdf");

    expect(response.status).toBe(401);
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("rejects /api/delete-file without an auth cookie", async () => {
    const app = createObjectStorageApiRouter();

    const response = await request(app)
      .delete("/api/delete-file")
      .send({ fileUrl: "file-1.pdf" });

    expect(response.status).toBe(401);
    expect(s3SendMock).not.toHaveBeenCalled();
  });
});
