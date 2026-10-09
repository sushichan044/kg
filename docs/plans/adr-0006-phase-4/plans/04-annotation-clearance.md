# Existing decoration clearance

Part of [the body-text plan](../overview.md).

Validate ruby and emphasis occupancy in the same coordinate system. Preserve
right-side placement, half-size annotations, and the 0.5-em line gap. Exclude
colliding candidates, including forced lines, and return `ComposerRejected`
with a concrete reason when no layout is possible. Omit emphasis on the
punctuation classes named by JLReq 3.3.9.

Acceptance: colliding ruby/emphasis is refused; compatible annotations keep
their existing coordinates; combined units, diagnostics, page/stage edges,
and both Chromium and WebKit respect core-owned placement. Package builds and
embedded-asset checks pass. Public inputs and persisted settings stay unchanged.

Parent: group reading allocation. Use `stacked-pr` for stack maintenance.
