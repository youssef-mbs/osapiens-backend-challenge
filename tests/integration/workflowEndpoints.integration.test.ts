import request from "supertest";
import { describe, it, expect } from "vitest";
import express from "express";
import workflowRoutes from "../../src/routes/workflowRoutes";
import { beforeAll, afterAll } from "vitest";
import { AppDataSource } from "../../src/data-source";
import { Task } from "../../src/models/Task";
import { Workflow } from "../../src/models/Workflow";
import { Result } from "../../src/models/Result";

// Mock app for testing
const app = express();
app.use(express.json());
app.use(workflowRoutes);

beforeAll(async () => {
  await AppDataSource.setOptions({
    type: "sqlite",
    database: ":memory:",
    synchronize: true,
    entities: [Task, Workflow, Result],
  }).initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

describe("Workflow API integration", () => {
  it("returns 404 for non-existent workflow status", async () => {
    const res = await request(app).get("/workflow/nonexistent/status");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns 404 for non-existent workflow results", async () => {
    const res = await request(app).get("/workflow/nonexistent/results");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  // Additional tests for completed and not completed workflows would require DB setup/mocking
});
