# Approved History Mobile — short-height observation

Requested implementation observation only. **No approved HTML, CSS, script, note or capture was modified.** Interface States v1 does not include a History Mobile redesign or a proposed v2.

The existing approved History Mobile v1 was inspected after scrolling to the battery chart, with zero simulated safe-area insets and the existing 44px controls:

| CSS viewport | Header | Sticky reading card | Bottom of sticky area, including 12px gap | Remaining vertical space | Occupied |
| --- | ---: | ---: | ---: | ---: | ---: |
| 360 × 640 | 131px | 191.6px | 334.6px | 305.4px | 52.3% |
| 390 × 667 | 131px | 191.6px | 334.6px | 332.4px | 50.2% |
| 390 × 844 | 131px | 191.6px | 334.6px | 509.4px | 39.6% |

No horizontal overflow occurred. The plots still scroll and their 144px/112px drawing areas can be exposed below the controls. However, at 640–667px heights the persistent area occupies about half the viewport. That is a material usability constraint for the later implementation, especially with browser chrome, safe areas or larger text.

Future implementation checks should use real short-height devices, safe areas and browser zoom/text scaling. Verify that selected points, units/date ticks and retry/status messages can be reached and are not obscured. Preserve readable text and 44px targets. If a more compact sticky presentation or different sticking behavior is justified, obtain review of that targeted adaptation rather than silently shrinking the approved controls.

These are browser-layout measurements, not a full device/accessibility audit. No automatic collapse, alternative navigation, reduced type size or new interaction has been introduced. The four approved-folder hash checks still pass.
