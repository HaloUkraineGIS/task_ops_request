import { flagFields, flagLabels } from "../config";
import type { DraftRow } from "./panel";
import { submitBatch } from "./wrfs";
import * as panel from "./panel";

type ModalRefs = {
  modal: HTMLElement;
  list: HTMLElement;
  confirmButton: HTMLElement;
  cancelButton: HTMLElement;
  resultArea: HTMLElement;
};

let refs: ModalRefs;
let onSubmitted: (() => void) | null = null;

export function initModal(root: ModalRefs, cb: { onSubmitted: () => void }) {
  refs = root;
  onSubmitted = cb.onSubmitted;
  refs.cancelButton.addEventListener("click", closeModal);
  refs.confirmButton.addEventListener("click", handleConfirm);
}

export function openModal(rows: DraftRow[], unitName: string) {
  refs.resultArea.innerHTML = "";
  refs.list.innerHTML = "";

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "confirm-row";
    const flags = flagFields
      .filter((f) => row.flags[f])
      .map((f) => flagLabels[f])
      .join(", ");
    item.innerHTML = `
      <span class="confirm-row__code">${row.taskCode}</span>
      <span class="confirm-row__name">${row.refsRecord?.task_name ?? ""}</span>
      <span class="confirm-row__date">${row.dateTo ? row.dateTo.toLocaleDateString() : ""}</span>
      <span class="confirm-row__flags">${flags}</span>
    `;
    refs.list.appendChild(item);
  }

  (refs.modal as any).open = true;
  refs.confirmButton.removeAttribute("disabled");
  refs.confirmButton.textContent = "Confirm & submit";
}

function closeModal() {
  (refs.modal as any).open = false;
}

async function handleConfirm() {
  const rows = panel.getRows();
  const unit = panel.getSelectedUnit();
  if (!unit || rows.length === 0) return;

  refs.confirmButton.setAttribute("disabled", "true");
  refs.confirmButton.textContent = "Submitting…";
  refs.resultArea.innerHTML = "";

  try {
    const outcome = await submitBatch(rows, unit);

    if (outcome.failures.length === 0) {
      refs.resultArea.innerHTML = `<div class="result result--success">All ${outcome.successTaskCodes.size} task(s) submitted successfully.</div>`;
      panel.clearAfterSuccessfulSubmit(outcome.successTaskCodes);
      onSubmitted?.();
      setTimeout(closeModal, 1400);
    } else if (outcome.isPermissionError) {
      refs.resultArea.innerHTML = `<div class="result result--error">You don't have permission to create tasks — contact your ArcGIS Enterprise administrator.</div>`;
      refs.confirmButton.removeAttribute("disabled");
      refs.confirmButton.textContent = "Retry";
    } else {
      panel.clearAfterSuccessfulSubmit(outcome.successTaskCodes);
      onSubmitted?.();
      const items = outcome.failures
        .map((f) => `<li><strong>${f.taskCode}</strong>: ${f.message}</li>`)
        .join("");
      refs.resultArea.innerHTML = `
        <div class="result result--partial">
          <p>${outcome.successTaskCodes.size} succeeded, ${outcome.failures.length} failed:</p>
          <ul>${items}</ul>
        </div>`;
      refs.confirmButton.removeAttribute("disabled");
      refs.confirmButton.textContent = "Retry remaining";
    }
  } catch (err) {
    refs.resultArea.innerHTML = `<div class="result result--error">Submission failed: ${
      err instanceof Error ? err.message : String(err)
    }</div>`;
    refs.confirmButton.removeAttribute("disabled");
    refs.confirmButton.textContent = "Retry";
  }
}
