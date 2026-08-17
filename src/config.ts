// Single source of truth for every ArcGIS Enterprise URL/ID and every
// field-name mapping used by the app. Never hardcode these elsewhere.

export const config = {
  portalUrl: "https://gis.htgoims.org/portal",

  // Registered ArcGIS Enterprise OAuth 2.0 Application (Authorization
  // Code + PKCE, public client). Redirect URIs registered on this
  // client must include both the GitHub Pages URL and
  // http://localhost:5173/ for local dev.
  oauthAppId: "I2nM1oIsuu2NcMi9",

  webMapId: "14392a78de604a73a2557a378afc2927",

  refsUrl:
    "https://gis-services.htgoims.org/arcgis/rest/services/ukraine/ukr_gis_task_mf_bac_cb/MapServer/0",

  wrfsUrl:
    "https://gis-services.htgoims.org/arcgis/rest/services/ukraine/ukr_task_ops_request/FeatureServer/0",

  zonesUrl:
    "https://gis.htgoims.org/server/rest/services/Hosted/ukr_regional_operating_areas/FeatureServer/0",
  zoneNameField: "name",
} as const;

// ReFS fields to query/cache client-side at boot.
export const refsOutFields = [
  "task_id",
  "task_code",
  "task_name",
  "task_type_name",
  "survey_date",
  "status_name",
  "oblast",
  "rayon",
  "council",
  "locality",
  "area_surveyed_m2",
  "latitude",
  "longitude",
] as const;

export type RefsRecord = {
  task_id: number;
  task_code: string;
  task_name: string;
  task_type_name: string;
  survey_date: number | null;
  status_name: string | null;
  oblast: string | null;
  rayon: string | null;
  council: string | null;
  locality: string | null;
  area_surveyed_m2: number | null;
  latitude: number;
  longitude: number;
};

// WrFS fields that are auto-copied from the chosen ReFS record. These are
// never shown as separate form fields.
export const autoCopiedFields = [
  "task_id",
  "task_name",
  "task_type_name",
  "survey_date",
  "oblast",
  "rayon",
  "council",
  "locality",
  "area_surveyed_m2",
  "latitude",
  "longitude",
] as const;

// The four "flag" checkboxes, in required display order.
export const flagFields = [
  "taskbook",
  "casevac",
  "resurvey",
  "security_check",
] as const;
export type FlagField = (typeof flagFields)[number];

export const flagLabels: Record<FlagField, string> = {
  taskbook: "Taskbook",
  casevac: "CASEVAC",
  resurvey: "Resurvey",
  security_check: "Security check",
};

// Fields that must NEVER be sent in applyEdits — server-managed via
// Editor Tracking (editable:false). See spec §0 / §7.7.
export const serverManagedFields = [
  "created_user",
  "created_date",
  "last_edited_user",
  "last_edited_date",
] as const;

// Columns rendered in the bottom "Submitted requests" table, in exact
// required order, with display labels.
export const tableColumns: Array<{ field: string; label: string }> = [
  { field: "submitted_at", label: "Submitted" },
  { field: "submitter_name", label: "Submitted by" },
  { field: "unit", label: "Unit (region)" },
  { field: "task_code", label: "Task code" },
  { field: "task_name", label: "Name" },
  { field: "task_type_name", label: "Type" },
  { field: "date_to", label: "Date to" },
  { field: "taskbook", label: "Taskbook" },
  { field: "casevac", label: "CASEVAC" },
  { field: "resurvey", label: "Resurvey" },
  { field: "security_check", label: "Security check" },
];
