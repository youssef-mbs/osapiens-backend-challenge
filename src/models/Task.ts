import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Workflow } from "./Workflow";
import { TaskStatus } from "../workers/taskRunner";

@Entity({ name: "tasks" })
export class Task {
  @PrimaryGeneratedColumn("uuid")
  taskId!: string;

  @Column("varchar")
  clientId!: string;

  @Column("text")
  geoJson!: string;

  @Column("varchar")
  status!: TaskStatus;

  @Column({ nullable: true, type: "text" })
  progress?: string | null;

  @Column("uuid", { nullable: true })
  resultId?: string;

  @Column("varchar")
  taskType!: string;

  @Column("int", { default: 1 })
  stepNumber!: number;

  @Column("uuid", { nullable: true })
  dependencyTaskId?: string | null;

  @ManyToOne(() => Task, (task) => task.dependentTasks, { nullable: true })
  @JoinColumn({ name: "dependencyTaskId" })
  dependency?: Task | null;

  @OneToMany(() => Task, (task) => task.dependency)
  dependentTasks?: Task[];

  @ManyToOne(() => Workflow, (workflow) => workflow.tasks)
  workflow!: Workflow;
}
