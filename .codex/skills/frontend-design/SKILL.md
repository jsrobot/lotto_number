---
name: frontend-design
description: Create, review, and refine frontend UI/UX for static web apps and mobile-first browser experiences. Use when Codex is asked to design a frontend, improve visual hierarchy, fix responsive layout/readability issues, choose UI controls, polish interaction states, or verify that an HTML/CSS/JavaScript interface feels professional on mobile and desktop.
---

# Frontend Design

## Workflow

1. Identify the user's primary workflow and target device first.
2. Inspect existing markup, styles, and interaction code before proposing visual changes.
3. Preserve the app's current design language unless it is causing usability problems.
4. Prefer focused layout and interaction changes over broad restyles.
5. Verify at mobile width first, then desktop.

## Design Rules

- Build the usable app surface, not a marketing page, unless explicitly asked.
- Keep operational tools dense, calm, and scannable.
- Use native/familiar controls for common jobs: selects for small option sets, toggles for binary settings, sliders or inputs for numbers, tabs for view switching.
- Keep repeated item cards compact with radius 8px or less.
- Avoid nested cards, decorative blobs, one-note palettes, and oversized type inside compact panels.
- Ensure text never overlaps, clips, or depends on viewport-scaled font sizes.
- Define stable dimensions for fixed-format UI such as grids, rows, balls, buttons, counters, and toolbars.
- Make touch targets at least 44px when feasible.

## Implementation Rules

- Match existing HTML/CSS naming and structure.
- Add CSS tokens when multiple elements must share size, color, spacing, or typography.
- Prefer responsive constraints such as `clamp()`, `minmax()`, `aspect-ratio`, and grid tracks.
- For mobile readability, test the narrow case mentally at 320px before widening.
- For static apps, bump cache query strings in `index.html` when changing loaded CSS/JS.

## Verification

- Run syntax/static checks available in the project.
- Run local server response checks for touched CSS/JS/HTML paths.
- Use browser screenshots or DOM inspection when available.
- If browser automation is unavailable, report that and describe the responsive assumptions checked.

## References

- Read `references/mobile-ui-checklist.md` when changing mobile layout, touch interaction, or responsive sizing.
