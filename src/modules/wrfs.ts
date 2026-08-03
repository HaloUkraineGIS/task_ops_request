import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import Graphic from "@arcgis/core/Graphic";
import { config, serverManagedFields } from "../config";
import type { DraftRow } from "./panel";

// --- Known open risk: created_user/created_date identity mix-ups -----------
// There is an unresolved, intermittent bug where created_user/created_date
// on WrFS records sometimes do not match the actual submitting user/time,
// even with Editor Tracking correctly configured and this client never
// sending these fields (see serverManagedFields below — always stripped
// before applyEdits). This has occurred across physically separate
// browsers/machines, which app code has no mechanism to cause, and points to
// the ArcGIS Enterprise topology (server federation and/or isDataArchived
// interacting with Editor Tracking) rather than this file.
//
// Diagnostic to run on a new deployment BEFORE extensive feature testing:
//   1. Sign in as User A and User B in separate browsers/incognito windows.
//   2. Capture each browser's `token` param from a query request (DevTools
//      Network tab).
//   3. Open <portal>/sharing/rest/community/self?f=json&token=<TOKEN> for
//      each token in a plain browser tab (no app code involved) and confirm
//      each resolves to the correct, distinct username.
//   4. Have both users submit within a minute of each other and inspect the
//      raw WrFS records via a direct query URL (not through this app's UI).
//   5. If identities/timestamps are still wrong at this raw REST level, this
//      is a server/federation configuration issue — escalate to the ArcGIS
//      Enterprise administrator rather than changing this file.
// -----------------------------------------------------------------------------

let layer: FeatureLayer | null = null;

export async function getWrfsLayer(): Promise<FeatureLayer> {
  if (layer) return layer;
  layer = new FeatureLayer({ url: config.wrfsUrl });
  await layer.load();
  return layer;
}

/** Formats a fresh UUID as {UPPERCASE-GUID-WITH-DASHES}. */
function toEsriGuid(uuid: string): string {
  return `{${uuid.toUpperCase()}}`;
}

/**
 * Detects the real field type of request_gr_id from the loaded layer
 * schema and returns a correctly-formatted value. Never hardcode the
 * assumption that the field is a GUID — detect it, because guessing wrong
 * causes a silent "Setting of value for <field> failed" applyEdits error.
 */
export async function buildRequestGrId(): Promise<string> {
  const l = await getWrfsLayer();
  const field = l.fields.find((f) => f.name === "request_gr_id");
  const raw = crypto.randomUUID();
  if (field && (field.type === "guid" || field.type === "global-id")) {
    return toEsriGuid(raw);
  }
  return raw;
}

/** "yes" / null — these are short text fields, not numeric booleans. */
function flagValue(checked: boolean): string | null {
  return checked ? "yes" : null;
}

export async function buildGraphics(
  rows: DraftRow[],
  unitName: string,
  requestGrId: string
): Promise<Graphic[]> {
  const completeRows = rows.filter(
    (row): row is DraftRow & { refsRecord: NonNullable<DraftRow["refsRecord"]> } =>
      row.refsRecord != null
  );

  return completeRows.map((row) => {
    const ref = row.refsRecord;
    const attributes: Record<string, unknown> = {
      request_gr_id: requestGrId,
      unit: unitName,
      task_id: ref.task_id,
      task_code: ref.task_code,
      task_name: ref.task_name,
      task_type_name: ref.task_type_name,
      survey_date: ref.survey_date,
      oblast: ref.oblast,
      rayon: ref.rayon,
      council: ref.council,
      locality: ref.locality,
      area_surveyed_m2: ref.area_surveyed_m2,
      latitude: ref.latitude,
      longitude: ref.longitude,
      taskbook: flagValue(row.flags.taskbook),
      casevac: flagValue(row.flags.casevac),
      resurvey: flagValue(row.flags.resurvey),
      security_check: flagValue(row.flags.security_check),
      date_to: row.dateTo ? row.dateTo.getTime() : null,
    };

    // Belt-and-braces: never send server-managed Editor Tracking fields.
    for (const f of serverManagedFields) delete attributes[f];

    return new Graphic({
      attributes,
      geometry: {
        type: "point",
        x: ref.longitude,
        y: ref.latitude,
        spatialReference: { wkid: 4326 },
      } as __esri.PointProperties,
    });
  });
}

export type ApplyEditsOutcome = {
  successTaskCodes: Set<string>;
  failures: Array<{ taskCode: string; message: string }>;
  isPermissionError: boolean;
};

const PERMISSION_ERROR_PATTERN = /permission|forbidden|not authorized|403/i;

export async function submitBatch(
  rows: DraftRow[],
  unitName: string
): Promise<ApplyEditsOutcome> {
  // Rows reaching here should always be "complete" (validated by the panel
  // before the submit button is enabled), but filter defensively so the
  // graphics array and this list stay index-aligned.
  const completeRows = rows.filter((row) => row.refsRecord != null);

  const l = await getWrfsLayer();
  const requestGrId = await buildRequestGrId();
  const graphics = await buildGraphics(completeRows, unitName, requestGrId);

  const result = await l.applyEdits({ addFeatures: graphics });

  const successTaskCodes = new Set<string>();
  const failures: Array<{ taskCode: string; message: string }> = [];
  let isPermissionError = false;

  result.addFeatureResults.forEach((res, i) => {
    const taskCode = completeRows[i]?.refsRecord?.task_code ?? "unknown";
    if (res.error) {
      failures.push({ taskCode, message: res.error.message ?? "Unknown error" });
      if (PERMISSION_ERROR_PATTERN.test(res.error.message ?? "")) {
        isPermissionError = true;
      }
    } else {
      successTaskCodes.add(taskCode);
    }
  });

  return { successTaskCodes, failures, isPermissionError };
}

export type SubmittedRequestRow = Record<string, unknown>;

export async function queryRecentSubmissions(): Promise<
  SubmittedRequestRow[]
> {
  const l = await getWrfsLayer();
  const query = new Query({
    where: "1=1",
    outFields: ["*"],
    orderByFields: ["created_date DESC"],
    returnGeometry: false,
    num: 500,
  });
  const result = await l.queryFeatures(query);
  return result.features.map((f) => f.attributes as SubmittedRequestRow);
}
