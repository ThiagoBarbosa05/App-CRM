import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createObjectStorageApiRouter,
  publicObjectsRouter,
  objectEntitiesRouter,
} from "../object-storage.routes";
import { ObjectNotFoundError } from "../../objectStorage";

const {
  searchPublicObjectMock,
  downloadObjectMock,
  getObjectEntityUploadURLMock,
  getObjectEntityFileMock,
  s3SendMock,
} = vi.hoisted(() => ({
  searchPublicObjectMock: vi.fn(),
  downloadObjectMock: vi.fn(),
  getObjectEntityUploadURLMock: vi.fn(),
  getObjectEntityFileMock: vi.fn(),
  s3SendMock: vi.fn(),
}));

vi.mock("../../objectStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../objectStorage")>();

  class MockObjectStorageService {
    searchPublicObject = searchPublicObjectMock;
    downloadObject = downloadObjectMock;
    getObjectEntityUploadURL = getObjectEntityUploadURLMock;
    getObjectEntityFile = getObjectEntityFileMock;
  }

  return {
    ...actual,
    ObjectStorageService: MockObjectStorageService,
  };
});

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

describe("object storage routers", () => {
  beforeEach(() => {
    searchPublicObjectMock.mockReset();
    downloadObjectMock.mockReset();
    getObjectEntityUploadURLMock.mockReset();
    getObjectEntityFileMock.mockReset();
    s3SendMock.mockReset();
  });

  it("returns signed upload URL from /api/objects/upload", async () => {
    getObjectEntityUploadURLMock.mockResolvedValue("https://signed-url");
    const app = createObjectStorageApiRouter();

    const response = await request(app).post("/api/objects/upload");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ uploadURL: "https://signed-url" });
  });

  it("returns 404 json for missing /public-objects file", async () => {
    searchPublicObjectMock.mockResolvedValue(null);

    const response = await request(publicObjectsRouter).get("/public-objects/image.png");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "File not found" });
  });

  it("returns 404 for missing /objects file", async () => {
    getObjectEntityFileMock.mockRejectedValue(new ObjectNotFoundError());

    const response = await request(objectEntitiesRouter).get("/objects/uploads/file-1");

    expect(response.status).toBe(404);
  });

  it("returns 400 when /api/upload has no file", async () => {
    const app = createObjectStorageApiRouter();

    const response = await request(app).post("/api/upload");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Arquivo não fornecido" });
  });

  it("uploads file through /api/upload with current response shape", async () => {
    s3SendMock.mockResolvedValue({});
    const app = createObjectStorageApiRouter();

    const response = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from("hello"), "doc.pdf");

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.fileType).toBe("application/pdf");
    expect(response.body.url).toContain("doc.pdf");
  });

  it("returns 400 when /api/delete-file has no fileUrl", async () => {
    const app = createObjectStorageApiRouter();

    const response = await request(app).delete("/api/delete-file").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "URL do arquivo é obrigatória" });
  });

  it("deletes file through /api/delete-file", async () => {
    s3SendMock.mockResolvedValue({});
    const app = createObjectStorageApiRouter();

    const response = await request(app)
      .delete("/api/delete-file")
      .send({ fileUrl: "file-1.pdf" });

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Arquivo removido com sucesso" });
  });
});
