# Fejlfinding og Erfaringer (Troubleshooting & Learnings)

Dette dokument opsummerer løsninger på tekniske udfordringer, fejl og vigtige læringer i TypeGraph.

## React Flow Parent Node Advarsel
**Problem**:
Under interaktioner (klik, træk, eller valg) på canvasset blev følgende advarsel udløst i browser-konsollen:
`Please make sure that parent nodes are in front of their child nodes in the nodes array.`

**Årsag**:
Advarslen opstår i `@xyflow/react` (tidligere React Flow), hvis en node har et defineret `parentId`, men denne forældrenode enten:
1. Ikke findes i `nodes`-arrayet (fx fordi den blev slettet, eller typen blev ændret).
2. Er placeret *efter* undernoden i `nodes`-arrayet (React Flow bygger sit interne nodekort sekventielt).
3. Har en forkert type, der ikke tillader at være visuel container (kun `bounded_context` understøtter undernoder i vores system).

**Løsning**:
1. **Validering af `parentId`**: I `ReactFlowCanvas.tsx` i `computedNodes` valideres `parentId` strengt. Det tillades kun, hvis forældre-konceptet findes i den aktive visning, i model-storen, og har `conceptType === 'bounded_context'`. Ellers nulstilles det til `undefined`.
2. **Cykelsikker sortering**: Implementeret en topologisk sortering af noder baseret på deres dybde i hierarkiet (via en cykel-detekterende `getDepth` funktion). Dette sikrer, at forældrenoder altid placeres før deres undernoder i arrayet. Ved cirkulære referencer afbrydes rekursionen med det samme.
3. **Oprydning ved sletning**: I `useGraphStore.ts` (`deleteConcept` og `deleteConcepts`) nulstilles `parentId` for alle undernoder asynkront, når en forældrenode slettes.
4. **Oprydning ved typeændring**: I `GraphService.ts` (`updateConcept`) nulstilles `parentId` til `undefined` for alle undernoder, hvis forældrenodens type ændres til noget andet end `bounded_context`.

## JSON Parsing & Reflection Loop i AI-Service
**Problem**:
Når en LLM (lokal eller via API) genererede forslag til graf-kommandoer, skete det undertiden at:
1. LLM'en returnerede ugyldig JSON-syntaks (fx manglende kommaer eller uafsluttede JSON-blokke).
2. Der blev vist rå markdown ` ```json ` koder i chatboblen.
3. LLM'en genererede tomme tekniske overskrifter som f.eks. `3. **JSON-Kommandoer**` og efterlod dem i chatten efter rensning.

**Løsning**:
1. **Syntaks-validering & Reflection**: Tilføjet en syntaks-test i `AIService.ts`. Hvis JSON-blokken er syntaktisk defekt, fanges fejlen, beskrives præcist, og sendes tilbage til LLM'en i et korrektions-prompt (Reflection Loop, max 3 forsøg).
2. **Standardiseret rensning**: Implementeret `AIService.cleanResponseText` som fjerner både afsluttede og eventuelle uafsluttede JSON-blokke samt tekniske kommando-overskrifter (fx `3. **JSON Kommando...**`).
3. **TypeScript Type-Narrowing i tests**: Ved test af `proposals` i `AIService.test.ts` må indexed array accesses (fx `result.proposals[0].name`) ikke typecastes usikkert med `as any`. I stedet gemmes referencen i en konstant (`const cmd = result[0]`), hvorefter der bruges standard type-narrowing (`if (cmd.action === 'addConcept')`). Dette løser IDE-typefejl på en sikker måde.

## Manglende synkronisering af forretningsmetadata på canvasset
**Problem**:
Når brugeren redigerede felter i egenskabs-panelet (Properties) såsom *Definition*, *Foretrukken term*, *Accepteret term* osv., blev teksten på canvassets noder (fx "Ingen definition angivet") ikke opdateret med det samme. Teksten blev først vist efter genindlæsning af visningen eller ved ændring af nodens position.

**Årsag**:
Reaktive opdateringer af noder på canvasset styres af en `useEffect`-hook i `ReactFlowCanvas.tsx`. Denne hook sammenligner den nuværende tilstand af noderne på canvasset med de beregnede noder (`computedNodes`) fra Zustand-storen.
Fejlen opstod, fordi sammenligningen (`changed` checket) ikke kiggede på ændringer i `concept.definition` eller andre metadata-felter, men kun sammenlignede position, parentId, størrelse og egenskabslisten/attributterne. Da der ikke blev registreret ændringer, blev den gamle node (med den forældede/tomme definition) genbrugt.

**Løsning**:
Udvidet ændringsdetektionen i `ReactFlowCanvas.tsx` til at udføre en fuldstændig sammenligning af koncept-objektets metadata-felter:
```typescript
const conceptChanged =
  conceptA.definition !== conceptB.definition ||
  conceptA.preferredTerm !== conceptB.preferredTerm ||
  conceptA.acceptedTerm !== conceptB.acceptedTerm ||
  conceptA.deprecatedTerm !== conceptB.deprecatedTerm ||
  conceptA.source !== conceptB.source ||
  conceptA.legalSource !== conceptB.legalSource ||
  conceptA.classification !== conceptB.classification ||
  conceptA.createdBy !== conceptB.createdBy ||
  conceptA.wasDerivedFrom !== conceptB.wasDerivedFrom ||
  (conceptA.aliases ?? []).join(',') !== (conceptB.aliases ?? []).join(',') ||
  propsFingerprint(conceptA) !== propsFingerprint(conceptB);
```
Dette sikrer, at ændringer i alle metadata-felter (inklusive Definition) straks udløser en re-render og opdaterer nodernes visning på canvasset.

