import area from "@turf/area";
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { Job } from "./Job";
import { Task } from "../models/Task";

type PolygonLikeFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

export class PolygonAreaJob implements Job {
  async run(task: Task): Promise<{ areaSqMeters: number }> {
    const polygonFeature = this.parsePolygonFeature(task.geoJson);
    const areaSqMeters = area(polygonFeature);

    if (!Number.isFinite(areaSqMeters)) {
      throw new Error("Failed to calculate polygon area from geoJson input.");
    }

    return { areaSqMeters };
  }

  private parsePolygonFeature(rawGeoJson: string): PolygonLikeFeature {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawGeoJson);
    } catch {
      throw new Error("Invalid geoJson payload: expected valid JSON string.");
    }

    const asAny = parsed as any;

    if (asAny?.type === "Feature") {
      if (
        asAny.geometry?.type === "Polygon" ||
        asAny.geometry?.type === "MultiPolygon"
      ) {
        return asAny as PolygonLikeFeature;
      }
      throw new Error(
        "Invalid geoJson feature geometry: expected Polygon or MultiPolygon.",
      );
    }

    if (asAny?.type === "Polygon" || asAny?.type === "MultiPolygon") {
      return {
        type: "Feature",
        geometry: asAny,
        properties: {},
      };
    }

    throw new Error(
      "Unsupported geoJson format: expected Polygon/MultiPolygon geometry or Feature.",
    );
  }
}
