import * as fs from "fs";
import * as yaml from "js-yaml";
import { DataSource } from "typeorm";
import { Workflow } from "../models/Workflow";
import { Task } from "../models/Task";
import { TaskStatus } from "../workers/taskRunner";

export enum WorkflowStatus {
  Initial = "initial",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

interface WorkflowStep {
  taskType: string;
  stepNumber: number;
  dependsOn?: number;
}

interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
}

export class WorkflowFactory {
  constructor(private dataSource: DataSource) {}

  /**
   * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
   * @param filePath - Path to the YAML file.
   * @param clientId - Client identifier for the workflow.
   * @param geoJson - The geoJson data string for tasks (customize as needed).
   * @returns A promise that resolves to the created Workflow.
   */
  async createWorkflowFromYAML(
    filePath: string,
    clientId: string,
    geoJson: string,
  ): Promise<Workflow> {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
    const workflowRepository = this.dataSource.getRepository(Workflow);
    const taskRepository = this.dataSource.getRepository(Task);
    const workflow = new Workflow();

    workflow.clientId = clientId;
    workflow.status = WorkflowStatus.Initial;

    const savedWorkflow = await workflowRepository.save(workflow);

    const duplicateSteps = new Set<number>();
    const seenSteps = new Set<number>();
    for (const step of workflowDef.steps) {
      if (seenSteps.has(step.stepNumber)) {
        duplicateSteps.add(step.stepNumber);
      }
      seenSteps.add(step.stepNumber);
    }

    if (duplicateSteps.size > 0) {
      throw new Error(
        `Duplicate stepNumber values found: ${Array.from(duplicateSteps).join(", ")}`,
      );
    }

    const tasks: Task[] = workflowDef.steps.map((step) => {
      const task = new Task();
      task.clientId = clientId;
      task.geoJson = geoJson;
      task.status = TaskStatus.Queued;
      task.taskType = step.taskType;
      task.stepNumber = step.stepNumber;
      task.workflow = savedWorkflow;
      return task;
    });

    const savedTasks = await taskRepository.save(tasks);

    const taskByStepNumber = new Map<number, Task>(
      savedTasks.map((task) => [task.stepNumber, task]),
    );

    const tasksToUpdate: Task[] = [];
    for (const step of workflowDef.steps) {
      if (step.dependsOn === undefined) {
        continue;
      }

      if (step.dependsOn === step.stepNumber) {
        throw new Error(
          `Task step ${step.stepNumber} cannot depend on itself.`,
        );
      }

      const currentTask = taskByStepNumber.get(step.stepNumber);
      const dependencyTask = taskByStepNumber.get(step.dependsOn);

      if (!currentTask) {
        throw new Error(`Task for step ${step.stepNumber} was not created.`);
      }

      if (!dependencyTask) {
        throw new Error(
          `Task step ${step.stepNumber} depends on missing step ${step.dependsOn}.`,
        );
      }

      currentTask.dependencyTaskId = dependencyTask.taskId;
      currentTask.dependency = dependencyTask;
      tasksToUpdate.push(currentTask);
    }

    if (tasksToUpdate.length > 0) {
      await taskRepository.save(tasksToUpdate);
    }

    return savedWorkflow;
  }
}
