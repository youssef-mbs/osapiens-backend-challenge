# Backend Coding Challenge

## Getting Started

1. Fork the Project:
   ![There is a button on the top right of you codesandbox environment after signing in](public/image.png)
2. Start Coding

This repository demonstrates a backend architecture that handles asynchronous tasks, workflows, and job execution using TypeScript, Express.js, and TypeORM. The project showcases how to:

- Define and manage entities such as `Task` and `Workflow`.
- Use a `WorkflowFactory` to create workflows from YAML configurations.
- Implement a `TaskRunner` that executes jobs associated with tasks and manages task and workflow states.
- Run tasks asynchronously using a background worker.

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/backend-coding-challenge.git
   cd backend-coding-challenge
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure TypeORM:**
   - Edit `src/data-source.ts` if needed (entities, DB path).
4. **(Optional) Compile TypeScript:**
   ```bash
   npx tsc
   ```
5. **Start the server:**
   ```bash
   npm start
   ```
6. **Create a workflow:**
   - POST to `/analysis` (see example in README above).
7. **Check status/results:**
   - Use `/workflow/:id/status` and `/workflow/:id/results` endpoints.

See the full README for details, API examples, and troubleshooting.

## Key Features

1. **Entity Modeling with TypeORM**
   - **Task Entity:** Represents an individual unit of work with attributes like `taskType`, `status`, `progress`, and references to a `Workflow`.
   - **Workflow Entity:** Groups multiple tasks into a defined sequence or steps, allowing complex multi-step processes.

2. **Workflow Creation from YAML**
   - Use `WorkflowFactory` to load workflow definitions from a YAML file.
   - Dynamically create workflows and tasks without code changes by updating YAML files.

3. **Asynchronous Task Execution**
   - A background worker (`taskWorker`) continuously polls for `queued` tasks.
   - The `TaskRunner` runs the appropriate job based on a task’s `taskType`.

4. **Robust Status Management**
   - `TaskRunner` updates the status of tasks (from `queued` to `in_progress`, `completed`, or `failed`).
   - Workflow status is evaluated after each task completes, ensuring you know when the entire workflow is `completed` or `failed`.

5. **Dependency Injection and Decoupling**
   - `TaskRunner` takes in only the `Task` and determines the correct job internally.
   - `TaskRunner` handles task state transitions, leaving the background worker clean and focused on orchestration.

## Project Structure

```
src/
├─ data/
│   └─ world_data.json         # Contains world data for analysis
│
├─ models/
│   ├─ Result.ts               # Defines the Result entity
│   ├─ Task.ts                 # Defines the Task entity
│   └─ Workflow.ts             # Defines the Workflow entity
│
├─ jobs/
│   ├─ DataAnalysisJob.ts      # Example job
│   ├─ EmailNotificationJob.ts # Example job
│   ├─ Job.ts                  # Job interface
│   ├─ JobFactory.ts           # Maps taskType to a Job
│   ├─ PolygonAreaJob.ts       # Calculates polygon area
│   └─ ReportGenerationJob.ts  # Aggregates workflow results
│
├─ workflows/
│   ├─ WorkflowFactory.ts      # Creates workflows & tasks from YAML
│   └─ example_workflow.yml    # Example workflow definition
│
├─ workers/
│   ├─ taskRunner.ts           # Handles job execution & state transitions
│   └─ taskWorker.ts           # Background worker for queued tasks
│
├─ routes/
│   ├─ analysisRoutes.ts       # POST /analysis endpoint
│   ├─ defaultRoute.ts         # Default route handler
│   └─ workflowRoutes.ts       # Workflow status/results endpoints
│
├─ data-source.ts              # TypeORM DataSource configuration
└─ index.ts                    # Express.js server initialization & worker startup
```

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm or yarn
- SQLite or another supported database

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/backend-coding-challenge.git
   cd backend-coding-challenge
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure TypeORM:**
   - Edit `data-source.ts` to ensure the `entities` array includes `Task` and `Workflow` entities.
   - Confirm database settings (e.g. SQLite file path).

4. **Create or Update the Workflow YAML:**
   - Place a YAML file (e.g. `example_workflow.yml`) in a `workflows/` directory.
   - Define steps, for example:
     ```yaml
     name: "example_workflow"
     steps:
       - taskType: "analysis"
         stepNumber: 1
       - taskType: "notification"
         stepNumber: 2
     ```

### Running the Application

1. **Compile TypeScript (optional if using `ts-node`):**

   ```bash
   npx tsc
   ```

2. **Start the server:**

   ```bash
   npm start
   ```

   If using `ts-node`, this will start the Express.js server and the background worker after database initialization.

3. **Create a Workflow (e.g. via `/analysis`):**

   ```bash
   curl -X POST http://localhost:3000/analysis \
   -H "Content-Type: application/json" \
   -d '{
    "clientId": "client123",
    "geoJson": {
        "type": "Polygon",
        "coordinates": [
            [
                [
                    -63.624885020050996,
                    -10.311050368263523
                ],
                [
                    -63.624885020050996,
                    -10.367865108370523
                ],
                [
                    -63.61278302732815,
                    -10.367865108370523
                ],
                [
                    -63.61278302732815,
                    -10.311050368263523
                ],
                [
                    -63.624885020050996,
                    -10.311050368263523
                ]
            ]
        ]
    }
    }'
   ```

   This will read the configured workflow YAML, create a workflow and tasks, and queue them for processing.

4. **Check Logs:**
   - The worker picks up tasks from `queued` state.
   - `TaskRunner` runs the corresponding job (e.g., data analysis, email notification) and updates states.
   - Once tasks are done, the workflow is marked as `completed`.

### **Coding Challenge Tasks for the Interviewee**

The following tasks must be completed to enhance the backend system:

---

### **1. Add a New Job to Calculate Polygon Area**

**Objective:**  
Create a new job class to calculate the area of a polygon from the GeoJSON provided in the task.

#### **Steps:**

1. Create a new job file `PolygonAreaJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Use `@turf/area` to calculate the polygon area from the `geoJson` field in the task.
4. Save the result in the `output` field of the task.

#### **Requirements:**

- The `output` should include the calculated area in square meters.
- Ensure that the job handles invalid GeoJSON gracefully and marks the task as failed.

---

### **2. Add a Job to Generate a Report**

**Objective:**  
Create a new job class to generate a report by aggregating the outputs of multiple tasks in the workflow.

#### **Steps:**

1. Create a new job file `ReportGenerationJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Aggregate outputs from all preceding tasks in the workflow into a JSON report. For example:
   ```json
   {
     "workflowId": "<workflow-id>",
     "tasks": [
       { "taskId": "<task-1-id>", "type": "polygonArea", "output": "<area>" },
       {
         "taskId": "<task-2-id>",
         "type": "dataAnalysis",
         "output": "<analysis result>"
       }
     ],
     "finalReport": "Aggregated data and results"
   }
   ```
4. Save the report as the `output` of the `ReportGenerationJob`.

#### **Requirements:**

- Ensure the job runs only after all preceding tasks are complete.
- Handle cases where tasks fail, and include error information in the report.

---

### **3. Support Interdependent Tasks in Workflows**

**Objective:**  
Modify the system to support workflows with tasks that depend on the outputs of earlier tasks.

#### **Steps:**

1. Update the `Task` entity to include a `dependency` field that references another task
2. Modify the `TaskRunner` to wait for dependent tasks to complete and pass their outputs as inputs to the current task.
3. Extend the workflow YAML format to specify task dependencies (e.g., `dependsOn`).
4. Update the `WorkflowFactory` to parse dependencies and create tasks accordingly.

#### **Requirements:**

- Ensure dependent tasks do not execute until their dependencies are completed.
- Test workflows where tasks are chained through dependencies.

---

### **4. Ensure Final Workflow Results Are Properly Saved**

**Objective:**  
Save the aggregated results of all tasks in the workflow as the `finalResult` field of the `Workflow` entity.

#### **How it works:**

- When all tasks in a workflow are completed, the system automatically aggregates the outputs and errors from each task and saves them as a JSON object in the `finalResult` field of the `Workflow` entity.
- If any task fails, its error message is included in the aggregation.

#### **Sample finalResult value:**

```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "tasks": [
    {
      "taskId": "...",
      "type": "polygonArea",
      "output": { "area": 12345 },
      "error": null
    },
    {
      "taskId": "...",
      "type": "reportGeneration",
      "output": { "report": "..." },
      "error": null
    },
    {
      "taskId": "...",
      "type": "dataAnalysis",
      "output": null,
      "error": "Task failed due to ..."
    }
  ],
  "summary": "Aggregated workflow results"
}
```

You can retrieve this result via the `/workflow/:id/results` endpoint after the workflow is completed.

---

### **5. Create an Endpoint for Getting Workflow Status**

**Objective:**  
Implement an API endpoint to retrieve the current status of a workflow.

#### **Endpoint Specification:**

- **URL:** `/workflow/:id/status`
- **Method:** `GET`
- **Response Example:**
  ```json
  {
    "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
    "status": "in_progress",
    "completedTasks": 3,
    "totalTasks": 5
  }
  ```

#### **Requirements:**

- Include the number of completed tasks and the total number of tasks in the workflow.
- Return a `404` response if the workflow ID does not exist.

---

### **6. Create an Endpoint for Retrieving Workflow Results**

**Objective:**  
Implement an API endpoint to retrieve the final results of a completed workflow.

#### **Endpoint Specification:**

- **URL:** `/workflow/:id/results`
- **Method:** `GET`
- **Response Example:**
  ```json
  {
    "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
    "status": "completed",
    "finalResult": "Aggregated workflow results go here"
  }
  ```

#### **Requirements:**

- Return the `finalResult` field of the workflow if it is completed.
- Return a `404` response if the workflow ID does not exist.
- Return a `400` response if the workflow is not yet completed.

---

### **Deliverables**

- **Code Implementation:**
  - New jobs: `PolygonAreaJob` and `ReportGenerationJob`.
  - Enhanced workflow support for interdependent tasks.
  - Workflow final results aggregation.
  - New API endpoints for workflow status and results.
