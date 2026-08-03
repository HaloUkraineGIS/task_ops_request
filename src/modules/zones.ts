import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import { config } from "../config";
import type { RefsRecord } from "../config";

export type Zone = {
  name: string;
  geometry: Polygon;
  /** task_code values whose ReFS lat/lon fall inside this zone. */
  taskCodes: Set<string>;
};

let zones: Zone[] = [];

export async function loadZones(
  refsCache: Map<string, RefsRecord>
): Promise<Zone[]> {
  const layer = new FeatureLayer({ url: config.zonesUrl });
  await layer.load();

  const query = new Query({
    where: "1=1",
    outFields: [config.zoneNameField],
    returnGeometry: true,
    outSpatialReference: { wkid: 4326 } as __esri.SpatialReferenceProperties,
  });

  const result = await layer.queryFeatures(query);

  zones = result.features.map((feature) => {
    const geometry = feature.geometry as Polygon;
    const name = String(feature.attributes[config.zoneNameField]);
    const taskCodes = new Set<string>();

    for (const [taskCode, record] of refsCache) {
      if (record.latitude == null || record.longitude == null) continue;
      const point = new Point({
        latitude: record.latitude,
        longitude: record.longitude,
        spatialReference: { wkid: 4326 },
      });
      if (geometryEngine.contains(geometry, point)) {
        taskCodes.add(taskCode);
      }
    }

    return { name, geometry, taskCodes };
  });

  return zones;
}

export function getZones(): Zone[] {
  return zones;
}

export function getZoneByName(name: string): Zone | undefined {
  return zones.find((z) => z.name === name);
}
