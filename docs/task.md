# Task Breakdown: RDF / Turtle Exchange Format## Checklist
- [x] `[x]` Create `src/features/compiler/rdfGenerator.ts` for generating Turtle syntax (SKOS + OWL + PROV-O)
- [x] `[x]` Update `src/store/useGraphStore.ts` to include `'rdf'` in `activeCodeTab` union
- [x] `[x]` Update `src/features/viewport/code/CodeViewport.tsx` to add "RDF / Turtle" tab, render generated RDF code, and update status headers
- [x] `[x]` Write unit test `src/features/compiler/__tests__/rdfGenerator.test.ts` to verify RDF generation
- [x] `[x]` Verify build and UI integration
