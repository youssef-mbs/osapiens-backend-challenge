import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/Task", () => {
  class Task {}
  return { Task };
});

vi.mock("../../src/models/Result", () => {
  class Result {}
  return { Result };
});

vi.mock("../../src/models/Workflow", () => {
  class Workflow {}
  return { Workflow };
});

vi.mock("../../src/workflows/WorkflowFactory", () => ({
  WorkflowStatus: {
    Initial: "initial",
    InProgress: "in_progress",
    Completed: "completed",
    Failed: "failed",
  },
}));

import { Task } from "../../src/models/Task";
import { Result } from "../../src/models/Result";
import { Workflow } from "../../src/models/Workflow";
import { TaskRunner, TaskStatus } from "../../src/workers/taskRunner";
import * as jobFactory from "../../src/jobs/JobFactory";
import { WorkflowStatus } from "../../src/workflows/WorkflowFactory";

function createRunnerHarness() {
  const taskRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
    manager: {
      getRepository: vi.fn(),
    },
  };

  const resultRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
  };

  const workflowRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
  };

  taskRepo.manager.getRepository.mockImplementation((entity: unknown) => {
    if (entity === Result) {
      return resultRepo;
    }
    if (entity === Workflow) {
      return workflowRepo;
    }
    throw new Error("Unexpected repository request");
  });

  const runner = new TaskRunner(taskRepo as any);
  return { runner, taskRepo, resultRepo, workflowRepo };
}

describe("TaskRunner dependency behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps task queued while dependency is in progress", async () => {
    const { runner, taskRepo } = createRunnerHarness();

    const task = {
      taskId: "task-2",
      taskType: "notification",
      status: TaskStatus.Queued,
      dependencyTaskId: "task-1",
      dependency: { taskId: "task-1", status: TaskStatus.InProgress },
      workflow: { workflowId: "wf-1" },
    } as Task;

    taskRepo.findOne.mockResolvedValue(task);
    taskRepo.save.mockResolvedValue(task);

    const getJobSpy = vi.spyOn(jobFactory, "getJobForTaskType");

    await runner.run({ taskId: "task-2" } as Task);

    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskStatus.Queued,
      }),
    );
    expect(task.progress).toContain("waiting for dependency task");
    expect(getJobSpy).not.toHaveBeenCalled();
  });

  it("passes dependency output context to job when dependency completed", async () => {
    const { runner, taskRepo, resultRepo, workflowRepo } =
      createRunnerHarness();

    const dependencyTask = {
      taskId: "task-1",
      status: TaskStatus.Completed,
      resultId: "result-1",
    };

    const task = {
      taskId: "task-2",
      taskType: "notification",
      status: TaskStatus.Queued,
      dependencyTaskId: "task-1",
      dependency: dependencyTask,
      workflow: { workflowId: "wf-1" },
    } as Task;

    taskRepo.findOne.mockResolvedValue(task);
    taskRepo.save.mockImplementation(async (value: Task) => value);

    resultRepo.findOne.mockResolvedValue({
      resultId: "result-1",
      data: JSON.stringify({ areaSqMeters: 99 }),
    });
    resultRepo.save.mockResolvedValue({ resultId: "result-2" });

    workflowRepo.findOne.mockResolvedValue({
      workflowId: "wf-1",
      status: WorkflowStatus.Initial,
      tasks: [
        { status: TaskStatus.Completed },
        { status: TaskStatus.Completed },
      ],
    });
    workflowRepo.save.mockResolvedValue(undefined);

    const runSpy = vi.fn().mockResolvedValue({ sent: true });
    vi.spyOn(jobFactory, "getJobForTaskType").mockReturnValue({
      run: runSpy,
    } as any);

    await runner.run({ taskId: "task-2" } as Task);

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "task-2" }),
      expect.objectContaining({
        dependencyTaskId: "task-1",
        dependencyOutput: { areaSqMeters: 99 },
      }),
    );

    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskStatus.Completed,
      }),
    );
  });
});
