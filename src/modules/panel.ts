import { flagFields, flagLabels, type FlagField } from "../config";
import type { RefsRecord } from "../config";
import { getZones, getZoneByName, type Zone } from "./zones";
import { getAllTaskCodes, getAllTaskOptions, getRefsRecord } from "./refs";
import * as mapModule from "./map";

export type DraftRow = {
  id: string;
  taskCode: string | null;
  refsRecord: RefsRecord | null;
  flags: Record<FlagField, boolean>;
  dateTo: Date | null;
};

type PanelCallbacks = {
  onRowsChanged: (rows: DraftRow[], complete: boolean) => void;
  onUnitChanged: (unitName: string | null) => void;
};

let rows: DraftRow[] = [];
let selectedUnit: string | null = null;
let callbacks: PanelCallbacks;

let elements: {
  unitSelect: HTMLElement;
  addButton: HTMLElement;
  rowList: HTMLElement;
  emptyHint: HTMLElement;
};

function newRowId(): string {
  return `row_${Math.random().toString(36).slice(2, 10)}`;
}

function isRowComplete(row: DraftRow): boolean {
  const hasCode = !!row.taskCode && !!row.refsRecord;
  const hasDate = !!row.dateTo;
  const hasFlag = flagFields.some((f) => row.flags[f]);
  return hasCode && hasDate && hasFlag;
}

function allComplete(): boolean {
  return rows.length > 0 && rows.every(isRowComplete);
}

function availableTaskOptionsForCurrentZone(): Array<{
  taskCode: string;
  taskName: string;
  label: string;
}> {
  if (!selectedUnit) return [];

  const zone = getZoneByName(selectedUnit);
  const taskCodes = zone ? Array.from(zone.taskCodes) : getAllTaskCodes();
  const allowed = new Set(taskCodes);

  const allOptions = getAllTaskOptions();
  const filtered = allOptions.filter((option) => allowed.has(option.taskCode));

  return filtered.length > 0 ? filtered : allOptions;
}

function codesUsedByOtherRows(excludeRowId: string): Set<string> {
  return new Set(
    rows
      .filter((r) => r.id !== excludeRowId && r.taskCode)
      .map((r) => r.taskCode as string)
  );
}

function emitChanged() {
  callbacks.onRowsChanged(rows, allComplete());
}

export function initPanel(root: {
  unitSelect: HTMLElement;
  addButton: HTMLElement;
  rowList: HTMLElement;
  emptyHint: HTMLElement;
}, cbs: PanelCallbacks) {
  elements = root;
  callbacks = cbs;

  elements.addButton.setAttribute("disabled", "true");

  renderUnitOptions();

  elements.unitSelect.addEventListener("calciteSelectChange", (e: any) => {
    const value = e.target.value as string;
    selectUnit(value || null);
  });

  elements.addButton.addEventListener("click", () => addRow());
}

function renderUnitOptions() {
  elements.unitSelect.innerHTML = "";
  const placeholder = document.createElement("calcite-option");
  placeholder.setAttribute("value", "");
  placeholder.textContent = "Select a unit (region)…";
  placeholder.setAttribute("selected", "true");
  elements.unitSelect.appendChild(placeholder);

  for (const zone of getZones()) {
    const opt = document.createElement("calcite-option");
    opt.setAttribute("value", zone.name);
    opt.textContent = zone.name;
    elements.unitSelect.appendChild(opt);
  }
}

function selectUnit(unitName: string | null) {
  selectedUnit = unitName;

  // Clear any existing, not-yet-submitted draft rows — a submitted batch
  // belongs to exactly one unit.
  for (const row of rows) mapModule.removeMarker(row.id);
  rows = [];
  renderRows();

  if (unitName) {
    elements.addButton.removeAttribute("disabled");
    const zone: Zone | undefined = getZoneByName(unitName);
    if (zone) mapModule.zoomToZone(zone.geometry);
  } else {
    elements.addButton.setAttribute("disabled", "true");
  }

  callbacks.onUnitChanged(unitName);
  emitChanged();
}

function addRow() {
  if (!selectedUnit) return;
  const row: DraftRow = {
    id: newRowId(),
    taskCode: null,
    refsRecord: null,
    flags: {
      taskbook: false,
      casevac: false,
      resurvey: false,
      security_check: false,
    },
    dateTo: null,
  };
  rows.push(row);
  renderRows();
  emitChanged();
}

function removeRow(rowId: string) {
  rows = rows.filter((r) => r.id !== rowId);
  mapModule.removeMarker(rowId);
  renderRows();
  emitChanged();
}

function renderRows() {
  elements.rowList.innerHTML = "";
  elements.emptyHint.style.display = rows.length === 0 ? "block" : "none";

  const taskOptions = availableTaskOptionsForCurrentZone();
  for (const row of rows) {
    elements.rowList.appendChild(buildRowElement(row, taskOptions));
  }
}

function buildRowElement(
  row: DraftRow,
  taskOptions: Array<{ taskCode: string; taskName: string; label: string }>
): HTMLElement {
  const el = document.createElement("div");
  el.className = "task-row";
  el.dataset.rowId = row.id;

  // --- Column 1: task code combobox ---
  const codeCol = document.createElement("div");
  codeCol.className = "task-row__code";

  const combobox = document.createElement("calcite-combobox") as any;
  combobox.setAttribute("selection-mode", "single");
  combobox.setAttribute("placeholder", "Task code…");
  combobox.setAttribute("overlay-positioning", "fixed");
  combobox.setAttribute("filterable", "true");

  const used = codesUsedByOtherRows(row.id);
  for (const option of taskOptions) {
    const item = document.createElement("calcite-combobox-item");
    item.setAttribute("value", option.taskCode);
    item.setAttribute("text-label", option.label);
    if (row.taskCode === option.taskCode) item.setAttribute("selected", "true");
    if (used.has(option.taskCode) && row.taskCode !== option.taskCode) {
      item.setAttribute("disabled", "true");
    }
    combobox.appendChild(item);
  }

  combobox.addEventListener("calciteComboboxChange", () => {
    const value = (combobox.value as string) || null;
    row.taskCode = value;
    row.refsRecord = value ? getRefsRecord(value) ?? null : null;
    renderRowHint(el, row);
    if (row.refsRecord) {
      mapModule.setDraftMarker(
        row.id,
        row.refsRecord.latitude,
        row.refsRecord.longitude
      );
    } else {
      mapModule.removeMarker(row.id);
    }
    emitChanged();
  });

  codeCol.appendChild(combobox);

  const hint = document.createElement("div");
  hint.className = "task-row__hint";
  codeCol.appendChild(hint);

  // --- Column 2: four checkboxes ---
  const flagsCol = document.createElement("div");
  flagsCol.className = "task-row__flags";
  for (const flag of flagFields) {
    const label = document.createElement("label");
    label.className = `task-row__flag${flag === "casevac" ? " task-row__flag--casevac" : ""}`;

    const checkbox = document.createElement("calcite-checkbox") as any;
    if (row.flags[flag]) checkbox.setAttribute("checked", "true");
    checkbox.addEventListener("calciteCheckboxChange", () => {
      row.flags[flag] = checkbox.checked;
      emitChanged();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(flagLabels[flag]));
    flagsCol.appendChild(label);
  }

  // --- Column 3: date-to picker ---
  const dateCol = document.createElement("div");
  dateCol.className = "task-row__date";
  const datePicker = document.createElement("calcite-input-date-picker") as any;
  datePicker.setAttribute("placeholder", "Date to…");
  if (row.dateTo) {
    datePicker.value = row.dateTo.toISOString().slice(0, 10);
  }
  datePicker.addEventListener("calciteInputDatePickerChange", () => {
    const value = datePicker.value as string;
    row.dateTo = value ? new Date(value) : null;
    emitChanged();
  });
  dateCol.appendChild(datePicker);

  // --- Trash icon ---
  const trash = document.createElement("calcite-action") as any;
  trash.setAttribute("icon", "trash");
  trash.setAttribute("text", "Remove");
  trash.setAttribute("scale", "s");
  trash.addEventListener("click", () => removeRow(row.id));

  el.appendChild(codeCol);
  el.appendChild(flagsCol);
  el.appendChild(dateCol);
  el.appendChild(trash);

  renderRowHint(el, row);

  return el;
}

function renderRowHint(rowEl: HTMLElement, row: DraftRow) {
  const hint = rowEl.querySelector(".task-row__hint");
  if (!hint) return;
  if (row.refsRecord) {
    hint.textContent = `${row.refsRecord.task_name} · ${row.refsRecord.task_type_name} — ${row.refsRecord.latitude.toFixed(5)}, ${row.refsRecord.longitude.toFixed(5)}`;
  } else {
    hint.textContent = "";
  }
}

export function getRows(): DraftRow[] {
  return rows;
}

export function getSelectedUnit(): string | null {
  return selectedUnit;
}

export function clearAfterSuccessfulSubmit(successTaskCodes: Set<string>) {
  for (const row of rows) {
    if (row.taskCode && successTaskCodes.has(row.taskCode)) {
      mapModule.markMarkerSaved(row.id);
    }
  }
  rows = rows.filter(
    (row) => !(row.taskCode && successTaskCodes.has(row.taskCode))
  );
  renderRows();
  emitChanged();
}
