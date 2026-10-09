# Candidate-local group reading allocation

Part of [the body-text plan](../overview.md).

Carry the consumed reading position through paragraph transitions. Assign a
contiguous cluster-aligned reading interval before fitting and scoring a line.
Include that cursor in state and candidate-cache identity. Consume the complete
reading at the terminal transition and retain kg's proportional allocation policy.

Acceptance: readings are neither lost nor repeated, fragments reserve reading
when possible, suppressed bases retain their ranges, and provider clusters are
never bisected. Record state and candidate bounds and test long annotated text
before enabling the new allocation. Keep the unannotated search bound unchanged.

Parent: joint jukugo. Child: decoration clearance. Use `stacked-pr` for stack
maintenance.
