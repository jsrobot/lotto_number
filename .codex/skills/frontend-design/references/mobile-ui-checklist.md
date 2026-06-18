# Mobile UI Checklist

## Layout

- Verify 320px, 360px, 390px, and desktop-width assumptions.
- Keep primary action visible near the relevant result or form.
- Avoid making users jump across tabs for one workflow.
- Prefer one-dimensional rows for scan/result data when users compare many values.
- Use `min-width: 0` on grid/flex children that may shrink.

## Readability

- Keep compact labels short.
- Use shared size tokens for visually equivalent data.
- If six lotto balls or similar fixed items must fit on one row, calculate row width:
  - container width
  - label/control columns
  - gaps
  - six fixed item widths
- Use smaller labels before shrinking core data.

## Touch

- Keep important controls at least 44px tall.
- Do not hide native select affordances unless replacing with a complete accessible control.
- Swipes should work from broad page regions unless they conflict with a native control or scroll.

## Visual Polish

- Use restrained contrast and a small set of semantic colors.
- Prefer spacing and alignment fixes before adding decoration.
- Keep cards only for repeated items, modals, or framed tools.
- Do not place card-like sections inside other cards.

## Verification

- Check no text overlaps in Korean and English.
- Check long labels and generated values.
- Check active/disabled/focus states.
- Re-run static path checks after cache-busting changes.
