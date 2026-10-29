# Design handoff validation

The following checks were run against the **versioned design package**, using the repository's existing Playwright/Chromium installation. These are isolated prototype checks, not tests of new React/API functionality.

| Check | Result |
| --- | --- |
| Approved export preservation | All **60** packaged sources/captures match their portable SHA-256 manifest. The original four local prototype folders and approved state sources were read, not rewritten. |
| Main layouts | **8** cases: two desktop surfaces at 1440px, two mobile surfaces at 360/390/430px. No horizontal or card-content overflow; photos load. |
| Interface states | **24** valid Overview/History state-platform combinations; mobile cases also checked at 360/390/430px. No script errors, missing local resources or data requests. |
| State gallery | **12** valid state/view pairs, with both images loaded and local HTML/PNG/note links resolving. |
| Unavailable data | Loading/empty/initial error show no received numerical measurements or invented measurement timestamps; loading/error do not fabricate a successful `asOf`. |
| Freshness and retention | Strictly greater than 300 seconds; stale data retained; failed refresh preserves stale reference and selected missing minute. Changing the browser clock does not alter the server reference. |
| Manual request demonstration | Retry stages a single pending action; duplicate starts are refused. Initial failure stays error; cached failure keeps the prior snapshot. No actual request is sent. |
| History semantics | Approved two plotted runs retain their gap; selected missing minute shows unavailable; a genuine recorded solar zero remains zero. Keyboard minute stepping and touch plot selection work. |
| Accessibility sample | Mobile primary/navigation/minute targets are at least 44px; focus styling is present; reduced-motion spinner does not rotate. Full assistive-technology certification is not claimed. |
| Publication scope | Owner explicitly authorized publishing the supplied photograph and derived captures, with no additional attribution. The Ekova image/logo, private tool metadata, machine-specific reports and intermediate designs are excluded. |

## Measured solid-color contrast

Computed from the sRGB relative-luminance formula by the verification script; ratios are rounded to two decimals.

| Pair | Ratio |
| --- | ---: |
| `#F4F7F3` primary text / `#06110F` shell | 17.76:1 |
| `#A9BBB0` secondary text / `#06110F` shell | 9.52:1 |
| `#111B09` action text / `#F1FF16` yellow | 16.09:1 |
| `#F1FF16` solar / `#06110F` shell | 17.41:1 |
| `#36CBB0` consumption / `#06110F` shell | 9.43:1 |
| `#B7F36B` battery / `#06110F` shell | 14.66:1 |

These pass the 4.5:1 normal-text threshold for these solid pairs. They do not establish contrast for every translucent pixel over the photograph, thin secondary control edges, every disabled state or every image crop. Preserve the approved visual sources and verify composited text/control/focus contrast in the later implementation.

## Repeatable check

Run `node docs/design/checks/verify-prototypes.cjs` from the repository after installing the existing frontend dependencies and Chromium, as described in [README.md](README.md). It validates the published relative paths and source hashes without rewriting screenshots. Its machine-specific result goes to ignored `artifacts/design-review/validation.json`.

Publication review also checks Markdown links, JSON/JavaScript syntax, the staged diff for unrelated changes/secrets, and Git normalization of immutable exports. Application code, dependency manifests, backend, simulator, containers and all three workflows are unchanged. Existing GitHub Actions run on the design PR; their live results are reported there, separately from these local design checks.

## Remaining implementation observations

- History Mobile's sticky area occupies about half a 640–667px-high viewport. The [short-phone audit](prototypes/interface-states-v1/SHORT_PHONE_AUDIT.md) records measurements and future device checks; no redesigned sticky behavior is included.
- A unified tablet/content-fit breakpoint and real safe areas, browser chrome, keyboard/screen reader and enlarged text need validation when the React dashboard is implemented.
- Frozen review files contain old pending-approval labels and draft checkpoint notes. [The approval record](README.md) supersedes them; they remain unchanged to preserve the reviewed exports.
- Fixture scripts and staged request transitions are illustrative. They neither query data nor implement independent production request state, cancellation, history contracts or networking.
- Manrope requires Google Fonts access when opening HTML. Captures preserve the reviewed type; fallback typography can wrap differently offline.

The owner approved all four primary prototypes and Interface States v1. The owner definitively approved the system document and resource package in PR #13. Phase 4 completes with its reviewed squash integration; no Phase 5 implementation starts here. The MVP remains unfinished.
