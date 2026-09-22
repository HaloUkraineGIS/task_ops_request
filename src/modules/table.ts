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
    case "open_planned":
      return formatFlag(value);
    default:
      return value == null ? "—" : String(value);
  }
}

function sortValue(field: string, value: unknown): string | number {
  if (value == null || value === "") return "";
  switch (field) {
    case "submitted_at":
    case "date_to":
      return Number(value);
    case "taskbook":
    case "casevac":
    case "resurvey":
    case "security_check":
    case "open_planned":
      return formatFlag(value) === "Yes" ? 1 : 0;
    default:
      return String(value).toLocaleLowerCase();
  }
}

function compareRows(
  left: SubmittedRequestRow,
  right: SubmittedRequestRow,
  field: string,
  direction: "asc" | "desc"
): number {
  const leftValue = sortValue(field, left[field]);
  const rightValue = sortValue(field, right[field]);
  const leftEmpty = leftValue === "";
  const rightEmpty = rightValue === "";

  if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;
  if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
  if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
  return 0;
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

  const table = document.createElement("table");
  table.className = "submitted-table";

  let sortField: string | null = null;
  let sortDirection: "asc" | "desc" = "asc";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of tableColumns) {
    const th = document.createElement("th");
    const sortButton = document.createElement("button");
    sortButton.type = "button";
    sortButton.className = "submitted-table__sort-button";
    sortButton.textContent = col.label;
    sortButton.addEventListener("click", () => {
      if (sortField === col.field) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortField = col.field;
        sortDirection = "asc";
      }
      renderFilteredTable();
    });
    th.appendChild(sortButton);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

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

    const sorted = sortField
      ? [...filtered].sort((left, right) =>
          compareRows(left, right, sortField as string, sortDirection)
        )
      : filtered;

    for (const [index, col] of tableColumns.entries()) {
      const th = headRow.children[index] as HTMLElement;
      const button = th.querySelector("button");
      if (!button) continue;
      const isActive = sortField === col.field;
      th.setAttribute("aria-sort", isActive ? sortDirection : "none");
      button.setAttribute(
        "aria-label",
        `Sort by ${col.label}${isActive ? `, ${sortDirection === "asc" ? "ascending" : "descending"}` : ""}`
      );
      button.dataset.direction = isActive ? sortDirection : "";
    }

    tbody.replaceChildren(...buildTableRows(sorted, onRowClick).children);

    if (sorted.length === 0) {
      container.classList.add("table-container--empty");
    } else {
      container.classList.remove("table-container--empty");
    }
  };

  input.addEventListener("input", renderFilteredTable);
  filterWrap.appendChild(input);

  container.innerHTML = "";
  container.appendChild(filterWrap);
  container.appendChild(table);
  renderFilteredTable();
}
