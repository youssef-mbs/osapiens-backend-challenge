import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Result } from "../models/Result";
import { Task } from "../models/Task";
import { TaskStatus } from "../workers/taskRunner";
import { Job } from "./Job";

interface ReportTaskItem {
  taskId: string;
  type: string;
  status: TaskStatus;
  output?: unknown;
  error?: string;
}

interface WorkflowReport {
  workflowId: string;
  tasks: ReportTaskItem[];
  finalReport: string;
}

export class ReportGenerationJob implements Job {
  async run(task: Task): Promise<WorkflowReport> {
    const workflowId = task.workflow?.workflowId;
    if (!workflowId) {
      throw new Error(
        "ReportGenerationJob requires task.workflow.workflowId to be loaded.",
      );
    }

    const taskRepository = AppDataSource.getRepository(Task);
    const resultRepository = AppDataSource.getRepository(Result);

    const workflowTasks = await taskRepository.find({
      where: { workflow: { workflowId } },
      order: { stepNumber: "ASC" },
    });

    const precedingTasks = workflowTasks.filter(
      (candidate) => candidate.stepNumber < task.stepNumber,
    );
    const nonTerminalTasks = precedingTasks.filter(
      (candidate) =>
        candidate.status === TaskStatus.Queued ||
        candidate.status === TaskStatus.InProgress,
    );

    if (nonTerminalTasks.length > 0) {
      throw new Error(
        `Cannot generate report before preceding tasks are complete. Pending steps: ${nonTerminalTasks
          .map((pending) => pending.stepNumber)
          .join(", ")}`,
      );
    }

    const resultRows = precedingTasks.length
      ? await resultRepository.find({
          where: {
            taskId: In(precedingTasks.map((candidate) => candidate.taskId)),
          },
        })
      : [];
    const resultMap = new Map<string, string | null>(
      resultRows.map((result) => [result.taskId, result.data]),
    );

    const reportTasks: ReportTaskItem[] = precedingTasks.map((candidate) => {
      const serializedOutput = resultMap.get(candidate.taskId);
      const output = this.parseOutput(serializedOutput);
      const isFailed = candidate.status === TaskStatus.Failed;

      return {
        taskId: candidate.taskId,
        type: candidate.taskType,
        status: candidate.status,
        ...(output !== undefined ? { output } : {}),
        ...(isFailed ? { error: candidate.progress ?? "Task failed." } : {}),
      };
    });

    const failedCount = reportTasks.filter(
      (candidate) => candidate.status === TaskStatus.Failed,
    ).length;

    return {
      workflowId,
      tasks: reportTasks,
      finalReport: `Aggregated ${reportTasks.length} tasks. Failed tasks: ${failedCount}.`,
    };
  }

  private parseOutput(serializedOutput?: string | null): unknown {
    if (!serializedOutput) {
      return undefined;
    }

    try {
      return JSON.parse(serializedOutput);
    } catch {
      return serializedOutput;
    }
  }
}
