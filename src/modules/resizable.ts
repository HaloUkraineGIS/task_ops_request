export type ResizeAxis = "horizontal" | "vertical";

export type ResizableOptions = {
  handle: HTMLElement;
  target: HTMLElement;
  /** "horizontal" drags change width, "vertical" drags change height. */
  axis: ResizeAxis;
  min: number;
  max: number;
  /** If true, dragging increases the size as the pointer moves left/up. */
  invert?: boolean;
  /** Called whenever the size changes, with the new size in px. */
  onResize?: (size: number) => void;
};

/**
 * Wires up a small drag handle to resize a target element along one axis
 * using Pointer Events, with size clamped to [min, max]. No UI library
 * dependency — just pointerdown/pointermove/pointerup.
 */
export function makeResizable(opts: ResizableOptions): { destroy: () => void } {
  const { handle, target, axis, min, max, invert = false, onResize } = opts;
  let startPos = 0;
  let startSize = 0;
  let dragging = false;

  function currentSize(): number {
    const rect = target.getBoundingClientRect();
    return axis === "horizontal" ? rect.width : rect.height;
  }

  function onPointerDown(e: PointerEvent) {
    if (handle.classList.contains("is-disabled")) return;
    dragging = true;
    startPos = axis === "horizontal" ? e.clientX : e.clientY;
    startSize = currentSize();
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor =
      axis === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const pos = axis === "horizontal" ? e.clientX : e.clientY;
    const delta = pos - startPos;
    const signedDelta = invert ? -delta : delta;
    const next = Math.min(max, Math.max(min, startSize + signedDelta));

    if (axis === "horizontal") {
      target.style.width = `${next}px`;
    } else {
      target.style.height = `${next}px`;
    }
    onResize?.(next);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    handle.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerUp);

  return {
    destroy() {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
