# Contextual mono and group ruby

Part of [the body-text plan](../overview.md).

Move regular ruby widening from intrinsic measurement to candidate resolution.
Retain lexical classes and resolve cl-22/cl-23 boundary context separately.
Apply JLReq 3.3.8's kana, punctuation, and edge rules. Resolve separate readings
over intervening kana with one ruby-em clearance. Keep existing oversized-group
and jukugo behavior until their own layers.

Acceptance: per-base mono anchors, kana versus kanji neighbors, both line edges,
punctuation spacing after adjustment, and competing overhang all have independent
expected-position tests. Fittable groups remain unbroken. Source and measurement
cluster contracts remain intact. Existing unannotated layouts and the bounded
candidate-expansion test pass.

Parent: main. Child: joint jukugo placement. Use `stacked-pr` for stack maintenance.
