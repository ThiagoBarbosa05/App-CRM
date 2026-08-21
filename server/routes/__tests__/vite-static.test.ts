import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { serveStatic } from "../../vite";

describe("serveStatic", () => {
  let distPath: string;

  beforeEach(() => {
    distPath = fs.mkdtempSync(path.join(os.tmpdir(), "crm-static-"));
    fs.mkdirSync(path.join(distPath, "assets"));
    fs.writeFileSync(path.join(distPath, "index.html"), "<html>CRM</html>");
    fs.writeFileSync(path.join(distPath, "assets", "app-abc123.js"), "export {};");
  });

  afterEach(() => {
    fs.rmSync(distPath, { recursive: true, force: true });
  });

  it("retorna 404 sem HTML para um asset inexistente", async () => {
    const app = express();
    serveStatic(app, distPath);

    const response = await request(app).get("/assets/chunk-antigo.js");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).not.toContain("text/html");
    expect(response.text).not.toContain("<html>");
  });

  it("preserva o fallback do SPA e impede cache do index", async () => {
    const app = express();
    serveStatic(app, distPath);

    const response = await request(app).get("/whatsapp/conversas");
    const directIndexResponse = await request(app).get("/index.html");

    expect(response.status).toBe(200);
    expect(response.text).toBe("<html>CRM</html>");
    expect(response.headers["cache-control"]).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(directIndexResponse.headers["cache-control"]).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  it("serve assets versionados com cache imutável", async () => {
    const app = express();
    serveStatic(app, distPath);

    const response = await request(app).get("/assets/app-abc123.js");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
