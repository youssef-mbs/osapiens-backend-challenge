import { Repository } from "typeorm";
import { Task } from "../models/Task";
import { getJobForTaskType } from "../jobs/JobFactory";
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import { Workflow } from "../models/Workflow";
import { Result } from "../models/Result";
import { JobContext } from "../jobs/Job";

export enum TaskStatus {
  Queued = "queued",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

export class TaskRunner {
  constructor(private taskRepository: Repository<Task>) {}

  /**
   * Runs the appropriate job based on the task's type, managing the task's status.
   * @param task - The task entity that determines which job to run.
   * @throws If the job fails, it rethrows the error.
   */
  async run(task: Task): Promise<void> {
    const hydratedTask = await this.taskRepository.findOne({
      where: { taskId: task.taskId },
      relations: ["workflow", "dependency"],
    });

    if (!hydratedTask) {
      throw new Error(`Task ${task.taskId} was not found.`);
    }

    const dependencyState = await this.resolveDependencyState(hydratedTask);

    if (dependencyState.waiting) {
      hydratedTask.status = TaskStatus.Queued;
      hydratedTask.progress = `waiting for dependency task ${dependencyState.taskId} to complete...`;
      await this.taskRepository.save(hydratedTask);
      return;
    }

    if (dependencyState.failed) {
      hydratedTask.status = TaskStatus.Failed;
      hydratedTask.progress = `dependency task ${dependencyState.taskId} failed; cannot continue.`;
      await this.taskRepository.save(hydratedTask);
      await this.updateWorkflowStatus(hydratedTask.workflow.workflowId);
      return;
    }

    hydratedTask.status = TaskStatus.InProgress;
    hydratedTask.progress = "starting job...";
    await this.taskRepository.save(hydratedTask);
    const job = getJobForTaskType(hydratedTask.taskType);
    const context = await this.buildJobContext(hydratedTask);

    try {
      console.log(
        `Starting job ${hydratedTask.taskType} for task ${hydratedTask.taskId}...`,
      );
      const resultRepository =
        this.taskRepository.manager.getRepository(Result);
      const taskResult = await job.run(hydratedTask, context);
      console.log(
        `Job ${hydratedTask.taskType} for task ${hydratedTask.taskId} completed successfully.`,
      );
      const result = new Result();
      result.taskId = hydratedTask.taskId!;
      result.data = JSON.stringify(taskResult || {});
      await resultRepository.save(result);
      hydratedTask.resultId = result.resultId!;
      hydratedTask.status = TaskStatus.Completed;
      hydratedTask.progress = null;
      await this.taskRepository.save(hydratedTask);
    } catch (error: any) {
      console.error(
        `Error running job ${hydratedTask.taskType} for task ${hydratedTask.taskId}:`,
        error,
      );

      hydratedTask.status = TaskStatus.Failed;
      hydratedTask.progress = error?.message || "task execution failed";
      await this.taskRepository.save(hydratedTask);

      await this.updateWorkflowStatus(hydratedTask.workflow.workflowId);

      throw error;
    }

    await this.updateWorkflowStatus(hydratedTask.workflow.workflowId);
  }

  private async buildJobContext(task: Task): Promise<JobContext | undefined> {
    if (!task.dependencyTaskId) {
      return undefined;
    }

    const dependencyTask =
      task.dependency ??
      (await this.taskRepository.findOne({
        where: { taskId: task.dependencyTaskId },
      }));

    if (!dependencyTask) {
      return { dependencyTaskId: task.dependencyTaskId };
    }

    if (!dependencyTask.resultId) {
      return { dependencyTaskId: dependencyTask.taskId };
    }

    const resultRepository = this.taskRepository.manager.getRepository(Result);
    const dependencyResult = await resultRepository.findOne({
      where: { resultId: dependencyTask.resultId },
    });

    if (!dependencyResult?.data) {
      return { dependencyTaskId: dependencyTask.taskId };
    }

    try {
      return {
        dependencyTaskId: dependencyTask.taskId,
        dependencyOutput: JSON.parse(dependencyResult.data),
      };
    } catch {
      return {
        dependencyTaskId: dependencyTask.taskId,
        dependencyOutput: dependencyResult.data,
      };
    }
  }

  private async resolveDependencyState(
    task: Task,
  ): Promise<{ waiting: boolean; failed: boolean; taskId?: string }> {
    if (!task.dependencyTaskId) {
      return { waiting: false, failed: false };
    }

    const dependencyTask =
      task.dependency ??
      (await this.taskRepository.findOne({
        where: { taskId: task.dependencyTaskId },
      }));

    if (!dependencyTask) {
      throw new Error(
        `Task ${task.taskId} depends on missing task ${task.dependencyTaskId}.`,
      );
    }

    if (dependencyTask.status === TaskStatus.Failed) {
      return { waiting: false, failed: true, taskId: dependencyTask.taskId };
    }

    if (dependencyTask.status !== TaskStatus.Completed) {
      return { waiting: true, failed: false, taskId: dependencyTask.taskId };
    }

    return { waiting: false, failed: false, taskId: dependencyTask.taskId };
  }

  private async updateWorkflowStatus(workflowId: string): Promise<void> {
    const workflowRepository =
      this.taskRepository.manager.getRepository(Workflow);
    const currentWorkflow = await workflowRepository.findOne({
      where: { workflowId },
      relations: ["tasks"],
    });

    if (currentWorkflow) {
      const allCompleted = currentWorkflow.tasks.every(
        (t) => t.status === TaskStatus.Completed,
      );
      const anyFailed = currentWorkflow.tasks.some(
        (t) => t.status === TaskStatus.Failed,
      );

      if (anyFailed) {
        currentWorkflow.status = WorkflowStatus.Failed;
      } else if (allCompleted) {
        currentWorkflow.status = WorkflowStatus.Completed;
      } else {
        currentWorkflow.status = WorkflowStatus.InProgress;
      }

      await workflowRepository.save(currentWorkflow);
    }
  }
}
