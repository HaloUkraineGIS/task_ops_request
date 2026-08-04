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

// IMPORTANT — two easy mistakes to avoid here:
//
// 1. Stencil's setAssetPath does NOT resolve its argument to an absolute
//    URL; it stores the raw string as-is (`plt.$resourcesUrl$ = path`).
//    Every later `getAssetPath(x)` call then does
//    `new URL(x, plt.$resourcesUrl$)` — and the WHATWG URL constructor
//    requires the *base* argument to already be a full absolute URL
//    (scheme + host). A root-relative path like "/task_ops_request/assets"
//    is NOT a valid base and throws "Failed to construct 'URL': Invalid
//    base URL". So this must be built into a real absolute URL ourselves.
//
// 2. The value must point at the site ROOT, not at ".../assets". Calcite's
//    internal calls already look like `getAssetPath("./assets/modal/...")`
//    — they append "assets/" themselves. Passing a path that already ends
//    in "/assets" produces "/assets/assets/..." (double segment, 404s).
setAssetPath(new URL(import.meta.env.BASE_URL, window.location.origin).href);
