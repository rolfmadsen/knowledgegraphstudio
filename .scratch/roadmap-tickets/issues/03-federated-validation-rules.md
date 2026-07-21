# 03 — Expanded Federated Validation Rules

**What to build:**
Extend the cross-notation alignment checks inside the validation hook `useValidation.ts` using the global federated over-ontology schemas. Specifically, implement validations to ensure that shared actors/roles across C4 and ArchiMate that share the exact same name (case-insensitive) also share identical security classifications and lifecycle states. If any discrepancies are found, raise a warning in the validation status bar and warning lists.

**Blocked by:**
None — can start immediately

**Status:**
ready-for-agent

- [ ] `useValidation.ts` scans all C4 actor nodes and ArchiMate business actor/role nodes.
- [ ] Match nodes case-insensitively by name and verify that their `classification` properties match.
- [ ] Verify that their `lifecycleState` properties match.
- [ ] Raise a consistency warning (with detail about the node conflict) in the status bar list when a discrepancy exists.
