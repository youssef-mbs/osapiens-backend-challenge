import { Job, JobContext } from "./Job";
import { Task } from "../models/Task";
import booleanWithin from "@turf/boolean-within";
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import countryMapping from "../data/world_data.json";

export class DataAnalysisJob implements Job {
  async run(task: Task, _context?: JobContext): Promise<string> {
    console.log(`Running data analysis for task ${task.taskId}...`);

    const inputGeometry = this.parseInputAsFeature(task.geoJson);

    for (const countryFeature of countryMapping.features) {
      if (
        countryFeature.geometry.type === "Polygon" ||
        countryFeature.geometry.type === "MultiPolygon"
      ) {
        const normalizedCountryFeature = countryFeature as Feature<
          Polygon | MultiPolygon,
          GeoJsonProperties
        >;

        try {
          const isWithin = booleanWithin(
            inputGeometry,
            normalizedCountryFeature,
          );
          if (isWithin) {
            console.log(
              `The polygon is within ${countryFeature.properties?.name}`,
            );
            return countryFeature.properties?.name;
          }
        } catch {
          // Skip malformed geometries from the source dataset.
        }
      }
    }
    return "No country found";
  }

  private parseInputAsFeature(
    rawGeoJson: string,
  ): Feature<Polygon | MultiPolygon, GeoJsonProperties> {
    const parsed = JSON.parse(rawGeoJson);

    if (
      parsed?.type === "Feature" &&
      (parsed.geometry?.type === "Polygon" ||
        parsed.geometry?.type === "MultiPolygon")
    ) {
      return parsed as Feature<Polygon | MultiPolygon, GeoJsonProperties>;
    }

    if (parsed?.type === "Polygon" || parsed?.type === "MultiPolygon") {
      return {
        type: "Feature",
        geometry: parsed,
        properties: {},
      };
    }

    throw new Error(
      "Unsupported geoJson format. Expected Polygon/MultiPolygon geometry or Feature.",
    );
  }
}
