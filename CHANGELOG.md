# Changelog

All notable changes to this project will be documented in this file.

---

## [2.1.0] - 2026-05-14

### Added

- `schedulePoll(enable)` function that starts or stops the poll interval based on a boolean flag.
- `visibilitychange` listener that calls `schedulePoll(false)` when the tab is hidden and `schedulePoll(true)` when it becomes visible again, eliminating all background fetches.
- `beforeunload` event listener as a second cleanup path alongside `pagehide`.
- `listeners.onVisibilityChange` stored reference so `destroy()` can remove the listener cleanly.

### Changed

- `destroy()` now removes the `visibilitychange` listener in addition to the mouse listeners.
- Initial poll start uses `schedulePoll(!document.hidden)` instead of an unconditional `setInterval`, so a widget opened in a background tab defers its first interval until the tab gains focus.

### Removed

- `MutationObserver` on `document.body`. Cleanup is handled entirely by `pagehide` and `beforeunload`; the observer was unnecessary overhead for a widget that is never removed by the page's own code.
- `listeners.observer` and its `disconnect()` call in `destroy()`.

---

## [2.0.0] - 2026-05-14

### Breaking Changes

- Minimum supported environment is any userscript manager that honours `@run-at document-idle` (Tampermonkey, Violentmonkey, Greasemonkey 4+).

### Added

- `destroy()` function that clears all timers and removes document-level event listeners.
- `MutationObserver` on `document.body` to call `destroy()` automatically when the widget node is removed from the DOM.
- `window.addEventListener('pagehide', destroy)` as a secondary cleanup path for SPA navigation.
- `AbortSignal.timeout` (10 s) on every `fetch` call to prevent stalled requests from blocking the UI indefinitely.
- Exponential-ish retry logic on fetch failure: retries at 2 s, 5 s, and 15 s before deferring to the regular poll interval.
- `parseISO(iso)` helper that validates date strings and returns a numeric timestamp or `null`, guarding against `NaN` in time arithmetic.
- `formatTimeRemaining(iso, mode)` unified formatter replacing the duplicate `formatCountdown` and `formatResetLabel` functions.
- `setErrorState(token)` writes a visible token (`API?` or a warning symbol) to the header display on fetch or shape errors.
- `dom` object that caches all widget element references after insertion, replacing repeated `getElementById` calls.
- `CONFIG` object centralising `POLL_INTERVAL_MS`, `FETCH_TIMEOUT_MS`, `RETRY_DELAYS_MS`, and `WIDGET_WIDTH_PX`.
- `listeners` object storing document-level mouse handler references so they can be removed by `destroy()`.
- ARIA attributes: `role="region"` and `aria-label` on the widget, `role="progressbar"` on both bar elements, `aria-live="polite"` on the header display and body, `aria-expanded` on the toggle kept in sync with collapse state.
- Toggle element changed from `<span>` to `<button>` with `all: unset` reset, making it natively keyboard-focusable.
- `keydown` handler on the toggle button for `Enter` and `Space` activation.
- `focus-visible` style on the toggle button.

### Changed

- `getOrgUUID` now caches a promise (`orgUUIDPromise`) instead of a string, preventing parallel in-flight requests to `/api/organizations`.
- On `getOrgUUID` failure the promise cache is cleared so the next poll can retry.
- `updateHeaderDisplay` skips the DOM write when the computed text matches the current value, reducing unnecessary repaints during the per-second countdown.
- `updateBar` resolves element references from the `dom` cache with an `getElementById` fallback.
- `makeDraggable` stores `mousemove` and `mouseup` handlers in `listeners` rather than as anonymous closures.
- CSS widget width sourced from `CONFIG.WIDGET_WIDTH_PX` instead of a hardcoded `130px` literal.
- Version bumped to `2.0`.

### Removed

- `formatCountdown` function (replaced by `formatTimeRemaining`).
- `formatResetLabel` function (replaced by `formatTimeRemaining`).
- `DOMContentLoaded` fallback branch; `@run-at document-idle` is sufficient.
- `fetchIntervalId` module-level variable replaced by `pollTimerId` managed through `destroy()`.

### Fixed

- Document-level `mousemove` and `mouseup` listeners were never removed, causing a memory leak when the widget was destroyed.
- Two parallel calls at startup could both fire `/api/organizations` before either resolved.
- `new Date(resets_at)` produced `NaN` for invalid or missing timestamps, causing incorrect countdown display.
- Fetch errors were only reported to the console; the widget showed stale dashes with no indication of failure.
- Toggle had no keyboard support and no ARIA state, making it inaccessible to keyboard and screen-reader users.

---

## [1.1.0] - prior release

- Added minimized header display showing usage percentage and countdown timer.
- Introduced draggable widget positioning.
- Added 7-day utilisation bar alongside the existing 5-hour bar.
- Countdown timer pauses when widget is expanded.

## [1.0.0] - initial release

- Floating usage monitor for claude.ai with Gruvbox colour theme.
- Displays 5-hour utilisation percentage and progress bar.
- Polls `/api/organizations/{uuid}/usage` every 60 seconds.
- Collapsible widget with expand/collapse toggle.
