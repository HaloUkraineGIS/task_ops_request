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

export async function refreshTable(container: HTMLElement): Promise<void> {
  container.innerHTML = `<div class="table-loading">Loading submitted requests…</div>`;
  let rows: SubmittedRequestRow[] = [];
  try {
    rows = await queryRecentSubmissions();
  } catch (err) {
    container.innerHTML = `<div class="table-error">Failed to load submitted requests.</div>`;
    return;
  }

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

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
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
  table.appendChild(tbody);

  container.innerHTML = "";
  if (rows.length === 0) {
    container.innerHTML = `<div class="table-empty">No submitted requests yet.</div>`;
  } else {
    container.appendChild(table);
  }
}
