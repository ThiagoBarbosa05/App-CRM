import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trainingsRouter } from "../trainings.routes";
import { createRouteTestApp } from "../../test/create-route-test-app";

const {
  getTrainingsMock,
  createTrainingMock,
  createTrainingAttachmentsMock,
  getTrainingMock,
  updateTrainingMock,
  updateTrainingAttachmentsMock,
  deleteTrainingAttachmentsMock,
  deleteTrainingMock,
  reorderTrainingsMock,
  dbInsertValuesMock,
  dbUpdateSetMock,
  s3SendMock,
  normalizeObjectEntityPathMock,
} = vi.hoisted(() => ({
  getTrainingsMock: vi.fn(),
  createTrainingMock: vi.fn(),
  createTrainingAttachmentsMock: vi.fn(),
  getTrainingMock: vi.fn(),
  updateTrainingMock: vi.fn(),
  updateTrainingAttachmentsMock: vi.fn(),
  deleteTrainingAttachmentsMock: vi.fn(),
  deleteTrainingMock: vi.fn(),
  reorderTrainingsMock: vi.fn(),
  dbInsertValuesMock: vi.fn(),
  dbUpdateSetMock: vi.fn(),
  s3SendMock: vi.fn(),
  normalizeObjectEntityPathMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getTrainings: getTrainingsMock,
    createTraining: createTrainingMock,
    createTrainingAttachments: createTrainingAttachmentsMock,
    getTraining: getTrainingMock,
    updateTraining: updateTrainingMock,
    updateTrainingAttachments: updateTrainingAttachmentsMock,
    deleteTrainingAttachments: deleteTrainingAttachmentsMock,
    deleteTraining: deleteTrainingMock,
    reorderTrainings: reorderTrainingsMock,
  },
}));

vi.mock("../../db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: dbInsertValuesMock,
    })),
    update: vi.fn(() => ({
      set: dbUpdateSetMock,
    })),
  },
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

vi.mock("../../objectStorage", () => ({
  ObjectStorageService: class {
    normalizeObjectEntityPath = normalizeObjectEntityPathMock;
  },
}));

describe("trainingsRouter", () => {
  beforeEach(() => {
    getTrainingsMock.mockReset();
    createTrainingMock.mockReset();
    createTrainingAttachmentsMock.mockReset();
    getTrainingMock.mockReset();
    updateTrainingMock.mockReset();
    updateTrainingAttachmentsMock.mockReset();
    deleteTrainingAttachmentsMock.mockReset();
    deleteTrainingMock.mockReset();
    reorderTrainingsMock.mockReset();
    dbInsertValuesMock.mockReset();
    dbUpdateSetMock.mockReset();
    s3SendMock.mockReset();

    dbInsertValuesMock.mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "training-1", title: "Doc" }]),
    });
    dbUpdateSetMock.mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "training-1", title: "Updated" }]),
      })),
    });
    normalizeObjectEntityPathMock.mockReturnValue("/objects/uploads/file-1");
  });

  it("keeps GET /trainings with type query", async () => {
    getTrainingsMock.mockResolvedValue([{ id: "training-1" }]);
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });

    const response = await request(app).get("/trainings?type=video");

    expect(getTrainingsMock).toHaveBeenCalledWith("video");
    expect(response.status).toBe(200);
  });

  it("creates video training and attachment", async () => {
    createTrainingMock.mockResolvedValue({ id: "training-1", title: "Video" });
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });

    const response = await request(app).post("/trainings/video").send({
      title: "Video",
      description: "Desc",
      category: "Cat",
      type: "video",
      videoUrl: "https://video",
    });

    expect(createTrainingMock).toHaveBeenCalledTimes(1);
    expect(createTrainingAttachmentsMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid video training body", async () => {
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });
    const response = await request(app).post("/trainings/video").send({});
    expect(response.status).toBe(400);
  });

  it("creates document training through DB inserts", async () => {
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });
    const response = await request(app).post("/trainings/documents").send({
      title: "Doc",
      description: "Desc",
      category: "Cat",
      documentUrl: "file.pdf",
      documentType: "application/pdf",
    });

    expect(dbInsertValuesMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(201);
  });

  it("updates document file and returns upload payload", async () => {
    getTrainingMock.mockResolvedValue({ training_attachments: { url: "old.pdf" } });
    s3SendMock.mockResolvedValue({});
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });

    const response = await request(app)
      .put("/trainings/documents/training-1/file")
      .attach("file", Buffer.from("pdf"), "doc.pdf");

    expect(s3SendMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(response.body.fileType).toBe("application/pdf");
  });

  it("returns 400 when reorder payload is invalid", async () => {
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });
    const response = await request(app).put("/trainings/training-1/order").send({ direction: "left" });
    expect(response.status).toBe(400);
  });

  it("keeps scripts create route", async () => {
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });
    const response = await request(app).post("/trainings/scripts").send({
      title: "Script",
      description: "Desc",
      category: "Cat",
      content: "Conteudo",
    });

    expect(dbInsertValuesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("keeps PUT /training-images normalizing imageURL", async () => {
    const app = createRouteTestApp({ router: trainingsRouter, basePath: "/" });
    const response = await request(app).put("/training-images").send({ imageURL: "https://storage.googleapis.com/private/uploads/file-1" });

    expect(response.status).toBe(200);
    expect(response.body.objectPath).toBeDefined();
  });
});
