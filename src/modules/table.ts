import { tableColumns } from "../config";
import { queryRecentSubmissions, type SubmittedRequestRow } from "./wrfs";

function formatDateTime(value: unknown): string {
  if (value == null) return "—";
  const d = new Date(Number(value));
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDateOnly(value: unknown): string {
  if (value == null) return "—";
  const d = new Date(Number(value));
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatFlag(value: unknown): string {
  if (value === "yes" || value === 1 || value === true || value === "1") {
    return "Yes";
  }
  return "—";
}

function formatCell(field: string, value: unknown): string {
  switch (field) {
    case "submitted_at":
      return formatDateTime(value);
    case "date_to":
      return formatDateOnly(value);
    case "taskbook":
    case "casevac":
    case "resurvey":
    case "security_check":
      return formatFlag(value);
    default:
      return value == null ? "—" : String(value);
  }
}

function buildTableRows(
  rows: SubmittedRequestRow[],
  onRowClick?: (row: SubmittedRequestRow) => void | Promise<void>
): HTMLTableSectionElement {
  const tbody = document.createElement("tbody");

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.classList.add("submitted-table__row");
    tr.title = "Zoom to feature on map";
    const objectId = row.OBJECTID ?? row.objectid ?? row["OBJECTID"] ?? row["objectid"];
    if (objectId != null) {
      tr.dataset.objectId = String(objectId);
    }
    if (onRowClick) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        for (const sibling of tr.parentElement?.querySelectorAll(".submitted-table__row") ?? []) {
          sibling.classList.remove("submitted-table__row--selected");
        }
        tr.classList.add("submitted-table__row--selected");
        void onRowClick(row);
      });
    }
    for (const col of tableColumns) {
      const td = document.createElement("td");
      td.textContent = formatCell(col.field, row[col.field]);
      if (col.field === "casevac" && formatFlag(row[col.field]) === "Yes") {
        td.classList.add("cell--casevac");
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  return tbody;
}

export async function refreshTable(
  container: HTMLElement,
  onRowClick?: (row: SubmittedRequestRow) => void | Promise<void>
): Promise<void> {
  container.innerHTML = `<div class="table-loading">Loading submitted requests…</div>`;
  let rows: SubmittedRequestRow[] = [];
  try {
    rows = await queryRecentSubmissions();
  } catch (err) {
    container.innerHTML = `<div class="table-error">Failed to load submitted requests.</div>`;
    return;
  }

  const filterWrap = document.createElement("div");
  filterWrap.className = "table-filter-wrap";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "table-filter";
  input.placeholder = "Filter by Submitted by / Unit / Task code / Name";
  input.autocomplete = "off";

  const renderFilteredTable = () => {
    const term = input.value.trim().toLowerCase();
    const filtered = !term
      ? rows
      : rows.filter((row) => {
          const haystacks = [
            row.submitter_name,
            row.unit,
            row.task_code,
            row.task_name,
          ].map((value) => String(value ?? "").toLowerCase());
          return haystacks.some((value) => value.includes(term));
        });

    const table = document.createElement("table");
    table.className = "submitted-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const col of tableColumns) {
      const th = document.createElement("th");
      th.textContent = col.label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    table.appendChild(buildTableRows(filtered, onRowClick));

    container.innerHTML = "";
    container.appendChild(filterWrap);
    container.appendChild(table);
    if (filtered.length === 0) {
      container.innerHTML = "";
      container.appendChild(filterWrap);
      container.insertAdjacentHTML(
        "beforeend",
        '<div class="table-empty">No matching submitted requests.</div>'
      );
    }
  };

  input.addEventListener("input", renderFilteredTable);
  filterWrap.appendChild(input);

  renderFilteredTable();
}
