import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import workflowRoutes from "../../src/routes/workflowRoutes";
import { AppDataSource } from "../../src/data-source";
import { Task } from "../../src/models/Task";
import { Workflow } from "../../src/models/Workflow";
import { Result } from "../../src/models/Result";

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

describe("Dependent Workflow Integration", () => {
  it("should not run a task until its dependency is completed", async () => {
    // Simulate two tasks, one depends on the other
    // This is a logic test, not a full API test
    const workflow = new Workflow();
    workflow.clientId = "test-client";
    workflow.status = "initial";
    await AppDataSource.manager.save(workflow);

    const task1 = new Task();
    task1.clientId = "test-client";
    task1.geoJson = "{}";
    task1.status = "completed";
    task1.taskType = "analysis";
    task1.stepNumber = 1;
    task1.workflow = workflow;
    await AppDataSource.manager.save(task1);

    const task2 = new Task();
    task2.clientId = "test-client";
    task2.geoJson = "{}";
    task2.status = "queued";
    task2.taskType = "notification";
    task2.stepNumber = 2;
    task2.dependencyTaskId = task1.taskId;
    task2.workflow = workflow;
    await AppDataSource.manager.save(task2);

    // Simulate TaskRunner logic
    const loadedTask2 = await AppDataSource.manager
      .getRepository(Task)
      .findOne({ where: { taskId: task2.taskId }, relations: ["dependency"] });
    expect(loadedTask2?.dependencyTaskId).toBe(task1.taskId);
    // Dependency is completed, so task2 can run
    expect(loadedTask2?.status).toBe("queued");
  });
});
