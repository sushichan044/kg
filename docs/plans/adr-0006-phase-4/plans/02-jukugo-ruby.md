# Joint jukugo placement

Part of [the body-text plan](../overview.md).

Use appendix F's one-ruby-em overhang and succeeding-base-first procedure.
Keep every reading segment associated with its own base. Recompute the compound
fragment when a legal base boundary divides it between lines. Compound interiors
remain distinct from ordinary mono-reading clearance and line expansion.

Acceptance: lengths 1+3, 3+1, and 3+2+1; 温泉 and 京都; permitted outer kana;
forbidden outer kanji; and split compounds have reference-derived coordinates.

Parent: contextual ruby. Child: group reading allocation. Use `stacked-pr` for
stack maintenance.

## Implemented spacing follow-up

The selected appendix F procedure uses solid shoulder readings. It tries
compound-interior overhang before outside neighbours, then distributes required
spacing among long readings in proportion to their measured solid widths. Each
base receives equal leading and trailing shares; line-edge bases receive their
shares inward. A single-base fragment touching both edges uses head alignment
and retains box expansion when its reading is longer than the base span.

Tests cover equal and unequal long readings, short-reading exclusion, shoulder
placement, kana/kanji outer contexts, line-edge alignment, split compounds, and
indivisible provider clusters. The coverage claim remains limited to logical
vertical body metrics, rather than actual font realization.
