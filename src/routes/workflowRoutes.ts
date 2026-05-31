import { Router } from "express";
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Workflow } from "../models/Workflow";
import { Task } from "../models/Task";

const router = Router();

// GET /workflow/:id/status
router.get("/workflow/:id/status", async (req: Request, res: Response) => {
  const workflowId = req.params.id;
  const workflowRepo = AppDataSource.getRepository(Workflow);
  const taskRepo = AppDataSource.getRepository(Task);

  const workflow = await workflowRepo.findOne({
    where: { workflowId },
    relations: ["tasks"],
  });
  if (!workflow) {
    res.status(404).json({ message: "Workflow not found" });
    return;
  }
  const completedTasks = workflow.tasks.filter(
    (t) => t.status === "completed",
  ).length;
  const totalTasks = workflow.tasks.length;
  res.json({
    workflowId: workflow.workflowId,
    status: workflow.status,
    completedTasks,
    totalTasks,
  });
  return;
});

// GET /workflow/:id/results
router.get("/workflow/:id/results", async (req: Request, res: Response) => {
  const workflowId = req.params.id;
  const workflowRepo = AppDataSource.getRepository(Workflow);
  const workflow = await workflowRepo.findOne({ where: { workflowId } });
  if (!workflow) {
    res.status(404).json({ message: "Workflow not found" });
    return;
  }
  if (workflow.status !== "completed") {
    res.status(400).json({ message: "Workflow not completed yet" });
    return;
  }
  res.json({
    workflowId: workflow.workflowId,
    status: workflow.status,
    finalResult: workflow.finalResult,
  });
  return;
});

export default router;
