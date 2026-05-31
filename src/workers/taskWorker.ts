import { AppDataSource } from "../data-source";
import { Task } from "../models/Task";
import { TaskRunner, TaskStatus } from "./taskRunner";

export async function taskWorker() {
  const taskRepository = AppDataSource.getRepository(Task);
  const taskRunner = new TaskRunner(taskRepository);

  while (true) {
    const queuedTasks = await taskRepository.find({
      where: { status: TaskStatus.Queued },
      relations: ["workflow", "dependency"],
      order: { stepNumber: "ASC" },
    });

    const task = queuedTasks.find((candidate) => {
      if (!candidate.dependency) {
        return true;
      }

      return (
        candidate.dependency.status === TaskStatus.Completed ||
        candidate.dependency.status === TaskStatus.Failed
      );
    });

    if (task) {
      try {
        await taskRunner.run(task);
      } catch (error) {
        console.error(
          "Task execution failed. Task status has already been updated by TaskRunner.",
        );
        console.error(error);
      }
    }

    // Wait before checking for the next task again
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
