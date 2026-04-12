import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { birthdayAutomationRouter } from "../birthday-automation.routes";

const { sendBirthdayMessagesMock, sendBirthdayMessagesScheduledMock } = vi.hoisted(() => ({
  sendBirthdayMessagesMock: vi.fn(),
  sendBirthdayMessagesScheduledMock: vi.fn(),
}));

vi.mock("../../jobs/send-birthday-mensage", () => ({
  sendBirthdayMessages: sendBirthdayMessagesMock,
  sendBirthdayMessagesScheduled: sendBirthdayMessagesScheduledMock,
}));

describe("birthdayAutomationRouter", () => {
  beforeEach(() => {
    sendBirthdayMessagesMock.mockReset();
    sendBirthdayMessagesScheduledMock.mockReset();
  });

  it("keeps POST /birthday-automation/trigger", async () => {
    const app = createRouteTestApp({ router: birthdayAutomationRouter, basePath: "/birthday-automation" });
    const response = await request(app).post("/birthday-automation/trigger");

    expect(sendBirthdayMessagesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("keeps POST /birthday-automation/trigger-scheduled", async () => {
    const app = createRouteTestApp({ router: birthdayAutomationRouter, basePath: "/birthday-automation" });
    const response = await request(app).post("/birthday-automation/trigger-scheduled");

    expect(sendBirthdayMessagesScheduledMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
