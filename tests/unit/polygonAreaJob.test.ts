import { describe, expect, it } from "vitest";
import { PolygonAreaJob } from "../../src/jobs/PolygonAreaJob";
import { Task } from "../../src/models/Task";

function makeTask(geoJson: unknown): Task {
  return {
    taskId: "task-1",
    geoJson: JSON.stringify(geoJson),
  } as Task;
}

describe("PolygonAreaJob", () => {
  it("calculates area for a polygon geometry", async () => {
    const job = new PolygonAreaJob();
    const task = makeTask({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    });

    const result = await job.run(task);

    expect(result.areaSqMeters).toBeGreaterThan(0);
  });

  it("throws on invalid JSON payload", async () => {
    const job = new PolygonAreaJob();
    const task = {
      taskId: "task-2",
      geoJson: "not-json",
    } as Task;

    await expect(job.run(task)).rejects.toThrow(
      "Invalid geoJson payload: expected valid JSON string.",
    );
  });

  it("throws on unsupported geojson type", async () => {
    const job = new PolygonAreaJob();
    const task = makeTask({
      type: "Point",
      coordinates: [0, 0],
    });

    await expect(job.run(task)).rejects.toThrow(
      "Unsupported geoJson format: expected Polygon/MultiPolygon geometry or Feature.",
    );
  });
});
