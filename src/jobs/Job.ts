import { Task } from "../models/Task";

export interface JobContext {
  dependencyOutput?: unknown;
  dependencyTaskId?: string;
}

export interface Job {
  run(task: Task, context?: JobContext): Promise<any>;
}
