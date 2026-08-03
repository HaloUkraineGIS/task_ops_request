// This MUST be the first thing imported anywhere near Calcite component
// imports. In ES modules, `import` declarations all execute before any
// plain top-level statement in the *importing* file, regardless of the
// line order in that file — so calling setAssetPath() as a plain
// statement after a list of `import "@esri/calcite-components/dist/
// components/calcite-*"` lines does NOT run in time; every one of those
// component modules has already registered/upgraded its custom element
// (and started fetching icons/t9n messages against an unset asset path)
// before that statement ever runs.
//
// Putting the call inside its own module's top-level body sidesteps this:
// when this module is imported first, its body (including this call, a
// plain statement) fully executes before the *next* import in main.ts is
// even evaluated.
import { setAssetPath } from "@esri/calcite-components/dist/components";

setAssetPath(`${import.meta.env.BASE_URL}assets`);
