import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/Task", () => {
  class Task {}
  return { Task };
});

vi.mock("../../src/models/Result", () => {
  class Result {}
  return { Result };
});

vi.mock("../../src/workers/taskRunner", () => ({
  TaskStatus: {
    Queued: "queued",
    InProgress: "in_progress",
    Completed: "completed",
    Failed: "failed",
  },
}));

vi.mock("../../src/data-source", () => ({
  AppDataSource: {
    getRepository: vi.fn(),
  },
}));

import { ReportGenerationJob } from "../../src/jobs/ReportGenerationJob";
import { AppDataSource } from "../../src/data-source";
import { Task } from "../../src/models/Task";
import { Result } from "../../src/models/Result";
import { TaskStatus } from "../../src/workers/taskRunner";

const taskRepo = {
  find: vi.fn(),
};

const resultRepo = {
  find: vi.fn(),
};

describe("ReportGenerationJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    taskRepo.find.mockReset();
    resultRepo.find.mockReset();
  });

  it("throws if workflow id is missing", async () => {
    const job = new ReportGenerationJob();

    await expect(job.run({ stepNumber: 3 } as Task)).rejects.toThrow(
      "ReportGenerationJob requires task.workflow.workflowId to be loaded.",
    );
  });

  it("throws when a preceding task is not in terminal state", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation(
      (entity: any) => {
        if (entity === Task) {
          return taskRepo as any;
        }
        if (entity === Result) {
          return resultRepo as any;
        }
        throw new Error("Unexpected repository request");
      },
    );

    taskRepo.find.mockResolvedValue([
      {
        taskId: "t1",
        taskType: "analysis",
        status: TaskStatus.Queued,
        stepNumber: 1,
      },
      {
        taskId: "t2",
        taskType: "reportGeneration",
        status: TaskStatus.Queued,
        stepNumber: 2,
      },
    ]);

    const job = new ReportGenerationJob();

    await expect(
      job.run({
        taskId: "t2",
        stepNumber: 2,
        workflow: { workflowId: "wf-1" },
      } as Task),
    ).rejects.toThrow(
      "Cannot generate report before preceding tasks are complete.",
    );
  });

  it("aggregates preceding outputs and failed task errors", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation(
      (entity: any) => {
        if (entity === Task) {
          return taskRepo as any;
        }
        if (entity === Result) {
          return resultRepo as any;
        }
        throw new Error("Unexpected repository request");
      },
    );

    taskRepo.find.mockResolvedValue([
      {
        taskId: "t1",
        taskType: "polygonArea",
        status: TaskStatus.Completed,
        stepNumber: 1,
      },
      {
        taskId: "t2",
        taskType: "analysis",
        status: TaskStatus.Failed,
        progress: "analysis failed",
        stepNumber: 2,
      },
      {
        taskId: "t3",
        taskType: "reportGeneration",
        status: TaskStatus.Queued,
        stepNumber: 3,
      },
    ]);

    resultRepo.find.mockResolvedValue([
      {
        taskId: "t1",
        data: JSON.stringify({ areaSqMeters: 12345 }),
      },
    ]);

    const job = new ReportGenerationJob();
    const report = await job.run({
      taskId: "t3",
      stepNumber: 3,
      workflow: { workflowId: "wf-1" },
    } as Task);

    expect(report.workflowId).toBe("wf-1");
    expect(report.tasks).toHaveLength(2);
    expect(report.tasks[0]).toMatchObject({
      taskId: "t1",
      type: "polygonArea",
      status: TaskStatus.Completed,
      output: { areaSqMeters: 12345 },
    });
    expect(report.tasks[1]).toMatchObject({
      taskId: "t2",
      type: "analysis",
      status: TaskStatus.Failed,
      error: "analysis failed",
    });
    expect(report.finalReport).toContain("Failed tasks: 1");
  });
});
