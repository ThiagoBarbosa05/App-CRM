import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { templatesRouter } from "../templates.routes";

const { getTemplatesMock, getApprovedTemplatesMock } = vi.hoisted(() => ({
  getTemplatesMock: vi.fn(),
  getApprovedTemplatesMock: vi.fn(),
}));

vi.mock("../../integrations/umbler", () => ({
  getTemplates: getTemplatesMock,
  getApprovedTemplates: getApprovedTemplatesMock,
}));

describe("templatesRouter", () => {
  beforeEach(() => {
    getTemplatesMock.mockReset();
    getApprovedTemplatesMock.mockReset();
  });

  it("keeps GET /templates", async () => {
    getTemplatesMock.mockResolvedValue([{ id: "tpl-1" }]);
    const app = createRouteTestApp({ router: templatesRouter, basePath: "/" });

    const response = await request(app).get("/templates");

    expect(getTemplatesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "tpl-1" }]);
  });

  it("keeps GET /templates?approved=true", async () => {
    getApprovedTemplatesMock.mockResolvedValue([{ id: "tpl-2" }]);
    const app = createRouteTestApp({ router: templatesRouter, basePath: "/" });

    const response = await request(app).get("/templates?approved=true");

    expect(getApprovedTemplatesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });
});
