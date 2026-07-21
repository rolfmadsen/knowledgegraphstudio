# 01 — Semantic Reasoning & Inferred Relations (ArchiMate Inferences)

**What to build:**
An in-memory semantic reasoning engine (`InferenceService.ts`) that automatically computes transitive closures and inverse relations (e.g. compositions and parent references) for ArchiMate models. These inferred relations must be surfaced dynamically as virtual properties in the inspector panel and rendered as thin, styled helper lines on the visual canvas, without polluting the underlying `model.typegraph.yaml` file.

**Blocked by:**
None — can start immediately

**Status:**
ready-for-agent

- [ ] `InferenceService.ts` computes transitive closures of relations in memory.
- [ ] Automatic inverse relation generation (e.g., composing parent-child composition connections).
- [ ] Canvas renders inferred connections as thin, styled slate-300 dashed lines.
- [ ] Inferred connections are readable in the Inspector properties panel but are omitted from YAML serialization.
