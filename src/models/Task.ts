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

  @Column()
  clientId!: string;

  @Column("text")
  geoJson!: string;

  @Column()
  status!: TaskStatus;

  @Column({ nullable: true, type: "text" })
  progress?: string | null;

  @Column({ nullable: true })
  resultId?: string;

  @Column()
  taskType!: string;

  @Column({ default: 1 })
  stepNumber!: number;

  @Column({ nullable: true })
  dependencyTaskId?: string | null;

  @ManyToOne(() => Task, (task) => task.dependentTasks, { nullable: true })
  @JoinColumn({ name: "dependencyTaskId" })
  dependency?: Task | null;

  @OneToMany(() => Task, (task) => task.dependency)
  dependentTasks?: Task[];

  @ManyToOne(() => Workflow, (workflow) => workflow.tasks)
  workflow!: Workflow;
}
