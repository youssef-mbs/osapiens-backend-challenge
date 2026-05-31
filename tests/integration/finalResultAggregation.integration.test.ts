import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AppDataSource } from "../../src/data-source";
import { Task } from "../../src/models/Task";
import { Workflow } from "../../src/models/Workflow";
import { Result } from "../../src/models/Result";
import { TaskRunner, TaskStatus } from "../../src/workers/taskRunner";

// This test simulates a workflow with completed and failed tasks and checks finalResult aggregation

describe("Workflow finalResult aggregation", () => {
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

  it("aggregates all task outputs and errors into finalResult", async () => {
    const workflow = new Workflow();
    workflow.clientId = "test-client";
    workflow.status = "initial";
    await AppDataSource.manager.save(workflow);

    // Completed task
    const task1 = new Task();
    task1.clientId = "test-client";
    task1.geoJson = "{}";
    task1.status = TaskStatus.Completed;
    task1.taskType = "polygonArea";
    task1.stepNumber = 1;
    task1.workflow = workflow;
    await AppDataSource.manager.save(task1);

    const result1 = new Result();
    result1.taskId = task1.taskId;
    result1.data = JSON.stringify({ area: 12345 });
    await AppDataSource.manager.save(result1);
    task1.resultId = result1.resultId;
    await AppDataSource.manager.save(task1);

    // Failed task
    const task2 = new Task();
    task2.clientId = "test-client";
    task2.geoJson = "{}";
    task2.status = TaskStatus.Failed;
    task2.taskType = "reportGeneration";
    task2.stepNumber = 2;
    task2.workflow = workflow;
    task2.progress = "Task failed due to error";
    await AppDataSource.manager.save(task2);

    // Simulate workflow completion
    const runner = new TaskRunner(AppDataSource.manager.getRepository(Task));
    // This will trigger aggregation
    await runner["updateWorkflowStatus"](workflow.workflowId);

    const updatedWorkflow = await AppDataSource.manager
      .getRepository(Workflow)
      .findOne({ where: { workflowId: workflow.workflowId } });
    expect(updatedWorkflow?.finalResult).toBeTruthy();
    const parsed = JSON.parse(updatedWorkflow!.finalResult!);
    expect(parsed.tasks.length).toBe(2);
    expect(parsed.tasks[0].output).toEqual({ area: 12345 });
    expect(parsed.tasks[1].error).toMatch(/failed/i);
  });
});
