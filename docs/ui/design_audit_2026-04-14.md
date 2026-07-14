# UI Design Audit (Draft)

Date: 2026-04-14

## Current strengths
- Clear 3-column workspace structure: projects, artifact canvas, inspector.
- Consistent controls and visual language across sidebar and inspector.
- Document artifact supports edit/preview and exposes LLM metadata.

## Main UX bottlenecks
1. Action hierarchy is weak in graph mode (primary and secondary actions look similar).
2. Error messages are too technical for end users.
3. Dense data views need quick visual modes (compact vs normal).
4. Top controls should be persistent and compact to reduce cursor travel.

## Decisions for next iteration
- Keep graph controls always visible.
- Place graph controls in a compact top-right panel.
- Avoid hiding important controls inside “more” menus.
- Keep inspector and project panels unchanged for now.

## Implemented in this step
- Graph toolbar moved to top-right.
- Toolbar height reduced and buttons compacted.
- Status badges moved to top-left to avoid overlap with toolbar.
- Reserved top strip for overlays reduced from 54px to 42px.

## Proposed design system refinements (next)
- Button tiers: primary / secondary / ghost tokens.
- Unified notification patterns: info / warning / error with action hint.
- Compact density toggle for table/document artifacts.
- Keyboard hint layer for core graph actions.

## Validation checklist
- Controls reachable without overlap on 1366x768 and 1920x1080.
- Context menu does not intersect compact toolbar.
- Plugin progress banner remains readable.
- No regression for undo/redo and layout actions.
