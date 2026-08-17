import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import { config, refsOutFields, type RefsRecord } from "../config";

let cache: Map<string, RefsRecord> | null = null;

/**
 * Loads the entire ReFS table (~5000 records) once at boot and caches it
 * client-side, keyed by task_code (one row = one unique task_code).
 */
export async function loadRefsCache(): Promise<Map<string, RefsRecord>> {
  if (cache) return cache;

  const layer = new FeatureLayer({ url: config.refsUrl });
  await layer.load();

  const query = new Query({
    where: "1=1",
    outFields: [...refsOutFields],
    returnGeometry: false,
    num: 2000,
  });

  const map = new Map<string, RefsRecord>();
  let start = 0;
  const pageSize = 2000;

  // Page through results in case the service enforces a max record count
  // below the full ~5000 row table.
  for (;;) {
    query.start = start;
    query.num = pageSize;
    const result = await layer.queryFeatures(query);

    for (const feature of result.features) {
      const attrs = feature.attributes as RefsRecord;
      if (attrs.task_code) {
        map.set(attrs.task_code, attrs);
      }
    }

    if (!result.exceededTransferLimit || result.features.length === 0) break;
    start += result.features.length;
  }

  cache = map;
  return map;
}

export function getRefsRecord(taskCode: string): RefsRecord | undefined {
  return cache?.get(taskCode);
}

export function getAllTaskCodes(): string[] {
  return cache ? Array.from(cache.keys()) : [];
}

export function getAllTaskOptions(): Array<{
  taskCode: string;
  taskName: string;
  label: string;
}> {
  if (!cache) return [];

  return Array.from(cache.values())
    .filter((row) => !!row.task_code && !!row.task_name)
    .map((row) => ({
      taskCode: row.task_code,
      taskName: row.task_name,
      label: `${row.task_code} (${row.task_name})`,
    }))
    .sort((a, b) => a.taskCode.localeCompare(b.taskCode));
}
