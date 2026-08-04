import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Graphic from "@arcgis/core/Graphic";
import esriRequest from "@arcgis/core/request";
import { config, serverManagedFields } from "../config";
import type { DraftRow } from "./panel";

// --- created_user/created_date appearing "stuck" on repeated submissions --
// Symptom previously reported: after the first submission in a session,
// later submissions (minutes apart) show the SAME created_user/created_date
// as the first one — even after signing out and back in — until roughly an
// hour passes and the page is fully reloaded, after which it's correct
// again.
//
// Diagnosed cause: queryRecentSubmissions() (used to populate the bottom
// "Submitted requests" table) re-issues a query with byte-identical
// where/outFields/orderBy/num parameters every time it runs. ArcGIS
// Enterprise OAuth access tokens are commonly valid for ~1 hour, and a
// "silent" re-login via an already-active portal SSO session can hand back
// that same still-valid token rather than minting a new one. With the token
// unchanged, the full request URL is then byte-identical across repeated
// calls too, and the browser (or an intermediate proxy/CDN) can legally
// serve a cached response for that exact URL instead of hitting the
// network — reproducing exactly this symptom, and explaining why it
// resolves once the token finally rotates (~1 hour) and a reload forces a
// fresh request. This does NOT necessarily mean the underlying database
// values were ever wrong — only what this app displayed.
//
// Fix in place: queryRecentSubmissions() below bypasses layer.queryFeatures
// in favor of a direct esriRequest call with `cacheBust: true` plus an
// explicit changing `_ts` parameter, which defeats caching at every layer
// (browser HTTP cache, corporate proxy, or ArcGIS Server response caching)
// regardless of which one was responsible.
//
// If created_user/created_date are still ever wrong when checked directly
// against the raw REST endpoint (not through this app's UI) — e.g. by
// opening `<wrfsUrl>/query?where=1=1&outFields=*&f=json&token=<TOKEN>` in a
// plain browser tab right after a submission — that would point to a real
// server/federation-level Editor Tracking issue rather than this app, since
// this client never sends created_user/created_date/last_edited_* fields
// (see serverManagedFields below, always stripped before applyEdits).
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

// This deliberately bypasses layer.queryFeatures() in favor of a direct
// esriRequest call. Reason: this query is re-issued with byte-identical
// parameters (where/outFields/orderBy/num never change) every time the
// bottom table refreshes. If the URL is otherwise identical too — which
// happens whenever the access token hasn't rotated yet, since ArcGIS
// Enterprise OAuth tokens are commonly valid for ~1 hour and a "silent"
// re-login via an active portal SSO session can hand back that same
// still-valid token — the browser (or an intermediate proxy/CDN) may
// serve a cached response for that exact URL instead of hitting the
// network. That reproduces *exactly* the reported symptom: newly
// submitted rows appear to freeze at the created_user/created_date of
// whichever request first populated the cache, for as long as the token
// (and therefore the URL) stays the same — until it rotates after ~1
// hour and a page reload forces a fresh request.
// `cacheBust: true` plus an explicit changing `_ts` param defeats this at
// every layer (browser HTTP cache, corporate proxy, and any ArcGIS
// Server-side response caching) regardless of which one was responsible.
export async function queryRecentSubmissions(): Promise<
  SubmittedRequestRow[]
> {
  // Ensures the layer/service is loaded and the user is authenticated
  // against it before issuing the raw request below.
  await getWrfsLayer();

  const response = await esriRequest(`${config.wrfsUrl}/query`, {
    query: {
      where: "1=1",
      outFields: "*",
      orderByFields: "created_date DESC",
      resultRecordCount: 500,
      returnGeometry: false,
      f: "json",
      _ts: Date.now(),
    },
    responseType: "json",
    cacheBust: true,
  });

  const features = (response.data?.features ?? []) as Array<{
    attributes: SubmittedRequestRow;
  }>;
  return features.map((f) => f.attributes);
}
