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

## Konflikt-loop og tabte visninger (YAML Parser & Code Viewport)
**Problem**:
Når applikationen fejlede i at parse eller validere model-filen `model.typegraph.yaml` ved opstart (fx på grund af manglende metadata-felter som `createdAt`, `updatedAt` eller `lifecycleState` i en manuelt redigeret model), gik systemet i konflikt-tilstand (`isConflict: true`). Brugeren blev låst i "Code"-visningen, og de to faner "GRAPH" og "SPLIT" blev deaktiveret.
Ydermere var der tre kritiske problemer i denne tilstand:
1. Fejlbeskrivelsen fra bootstrap-fejlen blev kasseret, så brugeren så en tom konfliktskærm uden detaljer om syntaks- eller valideringsfejlen.
2. "Resolve & Restore"-knappen blev kun vist, hvis brugeren foretog en manuel ændring i editoren (hvilket satte `localYaml`).
3. Hvis brugeren klikkede på "Resolve & Restore", blev `resolveConflictFromYaml` udløst, hvilket kørte `PersistenceService.parse(yaml)`. Denne funktion returnerede altid et tomt `views`-array. Da disse tomme visninger blev gemt direkte i workspace, blev `views.typegraph.yaml` overskrevet med `[]`, hvilket slettede alle brugerens layout-koordinater og visninger.

**Løsning**:
1. **Robuste standardværdier**: Parseren (`yamlToState` i `yamlParser.ts`) er opdateret til automatisk at udfylde manglende valideringskrævende felter i det indlæste YAML med standardværdier (`createdAt`/`updatedAt` til nuværende tidspunkt, `lifecycleState` til `'active'`, `aliases` og `policies` til `[]`). Underelementer (nested relations) får også automatisk tildelt `sourceConceptId` baseret på forældre-nodens ID.
2. **Udbredelse og visning af fejl**: Zustand-storen har fået tilføjet en `conflictError`-tilstand, som gemmer den rå validerings-/syntaksfejl under bootstrap. Fejlen renderes nu i bunden af kodeeditoren i en kompakt, scrollbar og kopierbar fejltoast, så brugeren præcist ved, hvilken Zod- eller YAML-undtagelse der opstod.
3. **Fleksibel gendannelse**: Knappen "Resolve & Restore" vises nu altid under konflikter uden krav om, at editoren først skal redigeres. Hvis editoren ikke er ændret, falder systemet tilbage til editorens nuværende indhold.
4. **Bevaring af visninger**: Før en konflikt gemmes og løses i `resolveConflictFromYaml`, indlæses de eksisterende visninger direkte fra disken (`views.typegraph.yaml`) og flettes ind i den nyligt rekonstruerede tilstand. Dette forhindrer, at visninger og layoutkoordinater slettes ved konfliktløsning.

## Navnekollision ved hurtig-oprettelse af noder via NodeToolbar
**Problem**:
Når brugeren benyttede "+" ikonet under en aktiv node i canvassets `NodeToolbar` til hurtigt at oprette en ny, forbunden target-node, dukkede værktøjslinjen (menuen) ikke op, når den nye node blev valgt. Desuden blev relationen og layoutet fejlagtigt mappet tilbage til den oprindelige node.

**Årsag**:
1. **Navne-unikhed i model-store**: I vores domænemodel er begreber unikke pr. type + navn. Hvis vi forsøger at oprette et koncept med et navn, der allerede eksisterer (i dette tilfælde default-navnet `"Nyt Begreb"`), returnerer `GraphService.addConcept` det eksisterende koncept frem for et nyt.
2. **Dublerede React Flow node-ID'er**: Fordi det eksisterende koncept blev genbrugt, blev der tilføjet endnu en `ViewNode` til visningen med det samme koncept-ID. React Flow modtog derfor to noder med samme ID på canvasset. Dette forårsagede interne fejl i React Flow ved valg/interaktion, hvilket forhindrede `NodeToolbar` i at lokalisere den valgte node i DOM'en og vise menuen.

**Løsning**:
Opdateret `handleCreateTargetNodeClick` i [ReactFlowCanvas.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/viewport/graph/ReactFlowCanvas.tsx) til dynamisk at beregne et unikt standardnavn (fx `"Nyt Begreb"`, `"Nyt Begreb 2"`, `"Nyt Begreb 3"`, etc.) ved at tjekke mod eksisterende begreber af samme type, før `addConcept` kaldes. Dette sikrer unikke navne, unikke UUID-baserede node-ID'er og korrekt fungerende værktøjslinjer på alle noder.

## Fastlåste og hoppende edge-segmenter under trækning (Sticky Segment Snapping)
**Problem**:
Under trækning af et edge-segment i manuel layout-mode kunne segmentet sætte sig fast (blive "sticky") ved nodens hjørner og nægte at snappe til den tilstødende flade (fx Top/Bottom), før musen blev trukket ekstremt langt væk. Dette skete særligt, når man trak i et vandret segment for at flytte det lodret forbi en bred nodes top/bund-grænse.

**Årsag**:
Vores `getClosestPosition` anvendte en diagonalbaseret (og aspektforholds-normaliseret) opdeling af rummet omkring noden. For brede noder strækker disse diagonaler sig langt ud til siderne. Når et waypoint er placeret langt til venstre/højre for noden, bevirker diagonal-opdelingen, at den vertikale snap-tærskel vokser proportionalt med den horisontale afstand. Dette skabte en enorm "død zone", hvor det vandrette segment forblev låst til Left/Right-fladen (klemt til hjørnet), indtil man trak det langt forbi den reelle top/bund-flade.

**Løsning**:
Opdateret `getClosestPosition` i [edgeRouting.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/utils/edgeRouting.ts) til at anvende en mere intelligent og responsiv stribe-baseret snap-grænse i stedet for ubegrænsede diagonaler:
1. **Under aktiv trækning af et vandret segment (`dragDirection === 'horizontal'`)**: Segmentet tillades at bevæge sig frit og snappe til Top/Bottom-fladerne med det samme, det krydser henholdsvis nodens øvre (`yMin`) eller nedre (`yMax`) grænse, hvilket fuldstændigt eliminerer den sticky modstand.
2. **Under aktiv trækning af et lodret segment (`dragDirection === 'vertical'`)**: Segmentet snapper til Left/Right-fladerne med det samme, det krydser nodens venstre (`xMin`) eller højre (`xMax`) grænse.
3. **Når der ikke trækkes (standard/gemt tilstand)**: For at forhindre lodret overlap og tilbageløb ("Pinden") når et waypoint befinder sig over eller under noden, snapper systemet nu direkte til henholdsvis **Top** (når `y < yMin`) eller **Bottom** (når `y > yMax`) fladen. Hvis waypointet er inden for nodens lodrette grænser (`yMin <= y <= yMax`), snapper det til Left/Right-fladen.
Dette fjerner helt "Pinden" (det uønskede lodrette overlap) og sikrer, at trækning og fastholdelse af segmenter føles ekstremt responsivt og mekanisk flydende, præcis som i `diagram-js`.

## Lighthouse Performance & Animation Udfordringer
**Problem**:
Under kørsel af Google Chrome Lighthouse Performance-analyse opstod der uventede crashes og fejl:
1. `Minify CSS — Error!` og `Minify JavaScript — Error!` samt `Reduce unused JavaScript — Error!` (med rød `Error!` markering i stedet for talværdier).
2. `Avoid non-composited animations` advarsler på 9 interaktive elementer (såsom noder i canvasset, elementer i navigations-træet og layout-knapper).

**Årsag**:
1. **Lighthouse/Parser Crash**: Da Monaco Editor (ca. 3.6 MB) og WebLLM-workerne blev indlæst i baggrunden med det samme under opstart (fordi de blev renderet i DOM'en med `style={{ display: 'none' }}` i stedet for at være udeladt via konditionel rendering), forsøgte Lighthouse at downloade og compile disse gigantiske bundles under analysen. Dette fik Lighthouse-arbejderprocessen til at løbe tør for RAM (heap memory limit) eller CPU-timeout, hvilket resulterede i et generelt audit-crash.
2. **Ikke-komponerede CSS-Transitions**: Elementerne benyttede `transition-all` eller `transition-colors`, som animerede egenskaber der kræver repaint på browserens main-thread (såsom `border-color`, `box-shadow`, `color` og `background-color`). Da disse kørte transitions, loggede Chrome ikke-komponerede animationsadvarsler.

**Løsning**:
1. **Lazy Mounting (Mount-on-Demand)**: I `App.tsx` indførte vi lazy-mounting tilstande (`codeLoaded` og `diffLoaded`). Tunge komponenter som `CodeViewport` og `DiffViewport` indlæses og mountes nu udelukkende, når de rent faktisk vises for første gang (fx ved skift til Code/Diff-visning). Efter at være åbnet første gang, forbliver de mountede i hukommelsen for at forhindre Monaco-fejl ("TextModel got disposed"). Alle andre hjælpe-modaler renderes nu også rent konditionelt (fx `{isNodeCreatorOpen && <NodeCreator />}`). Dette fjerner 100% og de tunge scripts fra den initiale indlæsning, og løser derved parser-crashes i Lighthouse.
2. **Komponerede CSS-Transitions**:
   - I `GraphViewport.tsx` blev `transition-all` på noder erstattet med `transition-transform duration-300`, hvilket sikrer, at kun den GPU-accelererede `transform` (fx flytning/skalering) animeres jævnt, mens ramme- og skyggefarver ændres øjeblikkeligt uden repaint.
   - I `Navigator.tsx` og `ViewToolbar.tsx` blev `transition-all` og `transition-colors` fjernet fra listeknapper og ikoner. Hover-effekter sker nu øjeblikkeligt, hvilket fjerner animationsadvarslerne og gør brugerfladen mere responsiv.
