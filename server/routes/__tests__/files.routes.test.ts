import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { filesRouter } from "../files.routes";

const { uploadMiddlewareMock, createFileControllerMock, deleteFileControllerMock } =
  vi.hoisted(() => ({
    uploadMiddlewareMock: vi.fn(),
    createFileControllerMock: vi.fn(),
    deleteFileControllerMock: vi.fn(),
  }));

vi.mock("../../controllers/create-file.controller", () => ({
  uploadMiddleware: uploadMiddlewareMock,
  createFileController: createFileControllerMock,
}));

vi.mock("../../controllers/delete-file.controller", () => ({
  deleteFileController: deleteFileControllerMock,
}));

describe("filesRouter", () => {
  beforeEach(() => {
    uploadMiddlewareMock.mockReset();
    createFileControllerMock.mockReset();
    deleteFileControllerMock.mockReset();

    uploadMiddlewareMock.mockImplementation(
      (_req: Request, _res: Response, next: express.NextFunction) => {
        next();
      },
    );

    createFileControllerMock.mockImplementation((_req: Request, res: Response) => {
      res.status(201).json({ route: "upload" });
    });

    deleteFileControllerMock.mockImplementation((_req: Request, res: Response) => {
      res.status(200).json({ route: "delete" });
    });
  });

  it("delegates POST /upload to upload middleware and controller", async () => {
    const app = createRouteTestApp({ router: filesRouter, basePath: "/files" });

    const response = await request(app).post("/files/upload").send({});

    expect(uploadMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(createFileControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ route: "upload" });
  });

  it("delegates DELETE /:fileId to delete controller", async () => {
    const app = createRouteTestApp({ router: filesRouter, basePath: "/files" });

    const response = await request(app).delete("/files/file-123");

    expect(deleteFileControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: "delete" });
  });
});
