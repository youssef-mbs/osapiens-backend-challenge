import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Task } from "./Task";
import { WorkflowStatus } from "../workflows/WorkflowFactory";

@Entity({ name: "workflows" })
export class Workflow {
  @PrimaryGeneratedColumn("uuid")
  workflowId!: string;

  @Column("varchar")
  clientId!: string;

  @Column("varchar", { default: WorkflowStatus.Initial })
  status!: WorkflowStatus;

  @Column({ type: "text", nullable: true })
  finalResult?: string | null;

  @OneToMany(() => Task, (task) => task.workflow)
  tasks!: Task[];
}
