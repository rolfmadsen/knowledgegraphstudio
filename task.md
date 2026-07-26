# Task: Fix TypeScript Compilation Errors in `npm run build`

## Goal
Fix 9 TypeScript compilation errors in `src/features/properties/Inspector.tsx`, `src/notations/event-modeling/PayloadSpecModal.tsx`, and `src/notations/event-modeling/index.tsx`.

## Checklist
- [x] `[x]` Fix unused import `PayloadAttribute` and missing `ValidationWarning` import in `src/features/properties/Inspector.tsx`.
- [x] `[x]` Fix prop types for `updateProperty` and `addConcept` in `PayloadSpecModalProps` in `src/notations/event-modeling/PayloadSpecModal.tsx`.
- [x] `[x]` Fix `e.target.value` type casting in `PayloadSpecModal.tsx`.
- [x] `[x]` Verify TypeScript types match across Inspector and Event Modeling components.