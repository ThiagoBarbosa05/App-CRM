import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { adminRouter } from "../admin.routes";

describe("adminRouter", () => {
  it("returns 400 without createdBy", async () => {
    const app = createRouteTestApp({ router: adminRouter, basePath: "/admin" });
    const response = await request(app).post("/admin/seed-deal-questions").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "createdBy é obrigatório" });
  });

  it("keeps POST /admin/seed-deal-questions success payload", async () => {
    const app = createRouteTestApp({ router: adminRouter, basePath: "/admin" });
    const response = await request(app)
      .post("/admin/seed-deal-questions")
      .send({ createdBy: "user-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Perguntas padrão inseridas com sucesso!" });
  });
});
