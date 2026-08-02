# Task Breakdown: Contextual Export Tabs & View Sync Fix

- [x] Write unit tests in `src/features/compiler/__tests__/viewFilteredGenerators.test.ts` specifying view-filtered generators.
- [x] Update `openapiGenerator.ts` and `asyncapiGenerator.ts` to support optional `activeViewId` filtering.
- [x] Update `CodeViewport.tsx` to fix the `localYaml` sync bug, filter export tabs contextually by `activeView.type`, and implement automatic tab fallback.
- [x] Update `useGraphStore.ts` stringifyState method to preserve the active view in view-filtered YAML outputs.
- [x] Verify state sync and contextual tab logic.