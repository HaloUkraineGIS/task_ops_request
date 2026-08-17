import "./modules/arcgis-config";
import "@esri/calcite-components/dist/calcite/calcite.css";
import "./modules/calcite-setup";
import "@esri/calcite-components/dist/components/calcite-button";
import "@esri/calcite-components/dist/components/calcite-select";
import "@esri/calcite-components/dist/components/calcite-option";
import "@esri/calcite-components/dist/components/calcite-combobox";
import "@esri/calcite-components/dist/components/calcite-combobox-item";
import "@esri/calcite-components/dist/components/calcite-checkbox";
import "@esri/calcite-components/dist/components/calcite-input-date-picker";
import "@esri/calcite-components/dist/components/calcite-action";
import "@esri/calcite-components/dist/components/calcite-modal";

import "./styles/main.css";

import { ensureSignedIn, signOut } from "./modules/auth";
import { loadRefsCache } from "./modules/refs";
import { loadZones } from "./modules/zones";
import { initMap, zoomToSubmittedFeature } from "./modules/map";
import { initPanel, getRows, getSelectedUnit, type DraftRow } from "./modules/panel";
import { initModal, openModal } from "./modules/modal";
import { refreshTable } from "./modules/table";
import { makeResizable } from "./modules/resizable";

const bootOverlay = document.getElementById("boot-overlay")!;
const bootStatus = document.getElementById("boot-status")!;
const bootReload = document.getElementById("boot-reload")!;
const appShell = document.getElementById("app-shell")!;

function setBootStatus(text: string) {
  bootStatus.textContent = text;
}

function showBootError(message: string) {
  setBootStatus(message);
  bootReload.style.display = "inline-block";
  bootReload.addEventListener("click", () => window.location.reload());
}

async function boot() {
  try {
    setBootStatus("Signing in…");
    const user = await ensureSignedIn();
    document.getElementById("user-name")!.textContent = user.fullName;
    document.getElementById("sign-out-btn")!.addEventListener("click", signOut);

    setBootStatus("Loading reference data and zones…");
    const refsCache = await loadRefsCache();
    const zones = await loadZones(refsCache);
    void zones;

    setBootStatus("Initializing map…");
    const mapContainer = document.getElementById("map-panel") as HTMLDivElement;
    await initMap(mapContainer);

    setBootStatus("Initializing interface…");
    wireUi();

    setBootStatus("Loading submitted requests…");
    await refreshTable(document.getElementById("bottom-panel-body")!, async (row) => {
      const objectId = row.OBJECTID ?? row.objectid ?? row["OBJECTID"] ?? row["objectid"];
      if (objectId == null) return;
      await zoomToSubmittedFeature(String(objectId));
    });

    bootOverlay.style.display = "none";
    appShell.classList.remove("app-shell--booting");
  } catch (err) {
    console.error(err);
    showBootError(
      "Something went wrong while loading TaskOps Request. Please try reloading."
    );
  }
}

function wireUi() {
  const submitBtn = document.getElementById("submit-btn") as HTMLElement;
  const bottomPanelBody = document.getElementById("bottom-panel-body") as HTMLElement;
  const refreshButton = document.getElementById("bottom-panel-refresh") as HTMLElement;

  const reloadSubmittedTable = () => {
    void refreshTable(bottomPanelBody, async (row) => {
      const objectId = row.OBJECTID ?? row.objectid ?? row["OBJECTID"] ?? row["objectid"];
      if (objectId == null) return;
      await zoomToSubmittedFeature(String(objectId));
    });
  };

  initPanel(
    {
      unitSelect: document.getElementById("unit-select")!,
      addButton: document.getElementById("add-task-btn")!,
      rowList: document.getElementById("row-list")!,
      emptyHint: document.getElementById("empty-hint")!,
    },
    {
      onRowsChanged: (rows: DraftRow[], complete: boolean) => {
        const n = rows.length;
        submitBtn.textContent = `Submit (${n})`;
        if (complete && n > 0) {
          submitBtn.removeAttribute("disabled");
        } else {
          submitBtn.setAttribute("disabled", "true");
        }
      },
      onUnitChanged: () => {
        submitBtn.setAttribute("disabled", "true");
        submitBtn.textContent = "Submit (0)";
      },
    }
  );

  initModal(
    {
      modal: document.getElementById("confirm-modal")!,
      list: document.getElementById("confirm-list")!,
      confirmButton: document.getElementById("confirm-submit-btn")!,
      cancelButton: document.getElementById("confirm-cancel-btn")!,
      resultArea: document.getElementById("confirm-result")!,
    },
    {
      onSubmitted: reloadSubmittedTable,
    }
  );

  refreshButton.addEventListener("click", reloadSubmittedTable);

  submitBtn.addEventListener("click", () => {
    const rows = getRows();
    const unit = getSelectedUnit();
    if (!unit || rows.length === 0) return;
    openModal(rows, unit);
  });

  // Resizable side panel (width) and bottom panel (height).
  makeResizable({
    handle: document.getElementById("resizer-vertical")!,
    target: document.getElementById("side-panel")!,
    axis: "horizontal",
    min: 420,
    max: 900,
  });

  const bottomPanel = document.getElementById("bottom-panel")!;
  const bottomResizer = document.getElementById("resizer-horizontal")!;
  makeResizable({
    handle: bottomResizer,
    target: bottomPanel,
    axis: "vertical",
    min: 140,
    max: Math.round(window.innerHeight * 0.75),
    invert: true,
  });

  let bottomCollapsed = false;
  const collapseBtn = document.getElementById("bottom-panel-collapse")!;
  const bottomBody = document.getElementById("bottom-panel-body")!;
  collapseBtn.addEventListener("click", () => {
    bottomCollapsed = !bottomCollapsed;
    bottomBody.style.display = bottomCollapsed ? "none" : "block";
    collapseBtn.setAttribute(
      "icon",
      bottomCollapsed ? "chevron-up" : "chevron-down"
    );
    bottomResizer.classList.toggle("is-disabled", bottomCollapsed);
    bottomPanel.classList.toggle("is-collapsed", bottomCollapsed);
  });
}

boot();
