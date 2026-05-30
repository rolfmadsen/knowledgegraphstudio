# Troubleshooting & Fejlfinding

Dette dokument beskriver kendte fejlscenarier, fejlfindingsmetoder og løsninger i TypeGraph (Knowledge Graph Studio).

## Kendte Fejl og Løsninger

### 1. TypeError: Cannot read properties of undefined (reading 'map') ved grupperingshandling

*   **Symptom:** Når brugeren vælger flere elementer på lærredet og klikker på "Group selection" i egenskabspanelet, crasher applikationen med `TypeError: Cannot read properties of undefined (reading 'map')` i `stateToYaml` under serialisering, og `Failed to save workspace` på grund af at `state.concepts` er `undefined`.
*   **Årsag:** Standardnavnet for en ny gruppe er "New Group". Hvis der i forvejen findes en gruppe (node af typen `bounded_context`) med navnet "New Group", finder `GraphService.addConcept` det eksisterende element og returnerer `{ concept: existing, nextState: {} }`. Da `nextState` er tomt, bliver `addConceptState.concepts` udefineret (`undefined`). I `GraphService.groupConcepts` blev denne udefinerede værdi sendt direkte tilbage til Zustand-storen som `concepts: addConceptState.concepts`. Dette overskrev `concepts`-arrayet i den globale tilstand med `undefined`, hvilket førte til crashes under efterfølgende renderinger og auto-gemninger.
*   **Løsning:**
    1.  **Navneuniksikring:** Før oprettelse af en ny gruppe, kontrolleres det i `groupConcepts`, om der allerede findes en gruppe med det ønskede navn. Hvis navnet er optaget, tilføjes en tæller (f.eks. "New Group 1", "New Group 2" osv.) for at sikre, at navnet er unikt, så `addConcept` altid opretter en ny node.
    2.  **Fallback-sikring:** I returværdien for `groupConcepts` tilføjes en fallback-sikring, så der returneres `addConceptState.concepts || state.concepts`. Dette forhindrer, at `concepts` nogensinde overskrives med `undefined` i storen, hvis oprettelsen af en eller anden grund fejler eller returnerer tomt.

### 2. Sårbarhedsadvarsler (npm audit) for `elliptic` og `vite-plugin-node-polyfills`

*   **Symptom:** Ved kørsel af `npm install` eller `npm audit` vises en sårbarhed af typen "Elliptic Uses a Cryptographic Primitive with a Risky Implementation" (GHSA-848j-6mx2-7j84) i pakken `elliptic`. `npm audit` foreslår at køre `npm audit fix --force` for at nedgradere `vite-plugin-node-polyfills` til version `0.2.0`.
*   **Årsag:** `elliptic` er en under-afhængighed til `vite-plugin-node-polyfills` (via `crypto-browserify`). Pr. januar 2026 er der ikke udgivet en rettet version af `elliptic` til denne sårbarhed.
*   **Løsning:** **Kør IKKE `npm audit fix --force`**. En nedgradering af `vite-plugin-node-polyfills` til version `0.2.0` vil ødelægge kompatibiliteten med Vite 8 og forhindre applikationen i at bygge. Sårbarheden er ufarlig for applikationen, da `elliptic` udelukkende anvendes under build-time / lokalt udviklingsmiljø, og applikationen ikke foretager følsomme kryptografiske signeringer i produktion.

### 3. Uoverskuelige og skråtstillede kant-labels (edge labels) samt overlap af pilehoveder

*   **Symptom:** Kant-labels (især i ArchiMate-visningen, f.eks. `Serving (serves / used by)`) var meget lange, svære at læse, og fulgte pilens hældningsvinkel. De kunne strække sig helt til nodernes grænser og dermed dække for pilens start-/slutmarkeringer (f.eks. pilehoveder eller kompositionsdiamanter).
*   **Årsag:** Labelen blev udregnet ved simpel tekstsammenkædning af type og multiplicitet, og blev roteret efter pilens vinkel.
*   **Løsning:** 
    1.  **Tekstrensning:** En `parseRelationLabel`-hjælper renser parentetiske forklaringer fra navnet (så `Serving (serves / used by)` bliver til `Serving`), men bevarer multiplicitet (f.eks. `(1..*)`).
    2.  **Horisontal orientering:** Labelens rotation er fjernet, så den altid renderes vandret.
    3.  **Højde- og breddetilpasning (Multi-line):** Hvis der er en multiplicitet, placeres den på en ny linje under relationstypen. Pille-baggrunden (`<rect>`) tilpasser sig dynamisk i bredden og højden.
    4.  **Dynamisk afkortning (Truncation):** Labelens maksimale karaktergrænse udregnes baseret på kants-afstanden, men garanterer altid mindst 10 tegn (f.eks. `Composi...` eller `Assignm...`) for at forhindre for aggressiv afkortning på korte kanter, og tilpasser sig fuldt ud, når afstanden øges.

### 4. Overlappende selektion (både node og kant forbliver valgt)

*   **Symptom:** Når en bruger havde valgt en node og derefter klikkede på en edge, forblev noden markeret, så både noden og kanten fremstod som valgt i brugerfladen på samme tid.
*   **Årsag:** Zustand-storens action `selectRelation` opdaterede kun `selectedRelationId`, men nulstillede ikke `selectedConceptId` eller `selectedConceptIds`.
*   **Løsning:** Actionen `selectRelation` i `useGraphStore.ts` er blevet opdateret, så den automatisk nulstiller node-selektionen (`selectedConceptId: null`, `selectedConceptIds: []`), når en kant vælges. Dette sikrer gensidig udelukkelse af selektioner.

### 5. Scroll-into-view fejl i Relation Builder under valg af relationstype

*   **Symptom:** Når man brugte piletasterne til at vælge en relationstype (step `label`), rullede listen ikke for at holde det valgte element synligt. Det aktive element forsvandt ud af syne.
*   **Årsag:** Scroll-beregningen anvendte `listRef.current.children[selectedIndex]`. Men i step `label` er den første child en overskrifts-div (`Common Relations`), hvilket skabte en off-by-one fejl i indekseringen af knapperne.
*   **Løsning:** Rullelogikken i `RelationBuilder.tsx` er ændret til at hente det aktive element via `listRef.current.querySelectorAll('button')[selectedIndex]`. Dette sikrer, at overskrifts-div'en springes over, og at det altid er den korrekte knap, der rulles til. Samtidig er scroll-animationen ændret til `auto` for at give øjeblikkelig respons.

### 6. Afskæring (cut-off) af elementer i midterste rækker (step 'type') i Relation Builder

*   **Symptom:** Når man navigerede med piletasterne mellem forskellige nodetyper (step `type`), blev de nederste/midterste kort (cards) kun delvist vist. Bundområdet af kortene var afskåret (clippet), selvom rulleskaktens slider viste, at man var i bunden af sit scroll.
*   **Årsag:** Indholdsområdets wrapper-div havde en rigid min/max højde fastsat via Tailwind (`h-full min-h-[350px] max-h-[450px]`). Samtidig havde dens forælder-div `flex-1 overflow-hidden px-10 pb-10`. Når modalens højde var begrænset af skærmstørrelsen (`max-h-[85vh]`), overskred indholdsområdet (på grund af `min-h-[350px]`) den tilgængelige plads i flex-layoutet. Da forælderen havde `overflow-hidden`, klippede den bunden af indholdsområdet af, hvilket gjorde bunden af scroll-containeren helt usynlig for brugeren. Rulle-beregningen troede således fejlagtigt, at kortene var fuldt synlige inden for scroll-containerens højde, selvom de var visuelt afskåret.
*   **Løsning:** 
    1. Forælder-div'en blev ændret til en flex-container: `flex flex-col` ud over `flex-1 overflow-hidden px-10 pb-10`.
    2. Den rigide wrapper-klasse `h-full min-h-[350px] max-h-[450px]` blev erstattet med en fleksibel `flex-1 min-h-0`. Dette sikrer, at indholdsområdet altid tilpasser sig nøjagtigt til den resterende tilgængelige plads i modalen uden nogensinde at flyde over eller blive afskåret.
    3. En stavefejl i Tailwind-klassen `translate-y--1` blev rettet til `-translate-y-1` på kortets hover/focus-effekt.



