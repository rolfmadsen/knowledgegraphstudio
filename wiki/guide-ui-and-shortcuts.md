# Brugergrænseflade & Keyboard-First

Dette dokument beskriver opbygningen af xArchis brugerflade, tastaturgenveje samt integrationen af Monaco Editor.

## Skærmzoner (Zone 1-4)

Brugerfladen i xArchi er opdelt i fire definerede zoner for at understøtte en struktureret og datatæt arbejdsgang:

*   **Zone 1 (Index View):**
    *   Det venstre sidepanel. En høj-densitets tabelvisning og et begrebskatalog (katalog over Concepts og Domains), der giver hurtigt overblik.
*   **Zone 2 (Canvas View & Code View):**
    *   Det centrale område. Indeholder grafvisualiseringen baseret på React Flow samt en Monaco Editor, der viser live, read-only YAML af grafen. Zone 2 kan køre i tre tilstande: Graf-visning, Monaco YAML-kodevisning eller Split Mode (begge side-by-side).
*   **Zone 3 (Command Hub):**
    *   En centreret modal/overlay, der åbnes via genveje. Bruges til fuzzy-søgning (via Fuse.js) af noder samt lynhurtig oprettelse af relationer og kommandoer.
*   **Zone 4 (Node Properties):**
    *   Det højre detaljepanel. Her redigeres metadata, egenskaber (properties) samt forretningsregler (policies) for den valgte node eller relation.

## Keyboard Navigation & Genveje

xArchi er designet til at kunne betjenes 100% fra tastaturet. Genvejene er kontekstafhængige:

*   **Globale Genveje (altid aktive):**
    *   `Cmd/Ctrl + K` eller `/`: Åbn Command Hub (Zone 3).
    *   `Alt + N`: Opret nyt Concept.
    *   `Alt + B`: Toggle Node Properties sidepanelet (Zone 4).
    *   `Alt + 1` / `Alt + 2`: Skift fokus mellem kataloget (Zone 1) og lærredet (Zone 2).
    *   `Alt + 3`: Skift visningstype for Zone 2 (Graf $\rightarrow$ YAML $\rightarrow$ Split).
    *   `Alt + D`: Toggle Code Diff Mode i Zone 2 (sammenlign YAML mod Git HEAD).
    *   `Ctrl + Z` / `Ctrl + Shift + Z`: Undo / Redo af ændringer.
*   **Navigation & Handling (når intet tekstfelt er fokuseret):**
    *   `ArrowUp/Down`: Flyt fokus mellem elementer i lærredet eller kataloget.
    *   `Alt + Arrows`: Traverser relationer (spatial walking) mellem noder.
    *   `Enter`: Åbn det valgte element og ryk tastaturfokus direkte til egenskabspanelet (Zone 4).
    *   `Esc`: Universal escape. Lukker modals, fjerner listefokus og frigiver fokus, hvis Monaco Editor har "fanget" tastaturet.
    *   `Delete` / `Backspace`: Slet det valgte element (kræver bekræftelse via et tryk på `Enter`).
    *   `L`: Initier en ny relation fra det aktive element (åbner Zone 3).
    *   `A`: Opret en ny egenskab (property) på den fokuserede node.
    *   `F`: Slå Focus Mode til/fra (viser kun den valgte node samt dens direkte naboer).

## Monaco Editor Integration & Focus Escape

Monaco Editor er integreret som en live-visning af den underliggende YAML-model:

*   **Read-Only standard:**
    *   For at sikre envejs-datastrømmen (Zustand $\rightarrow$ YAML) er Monaco Editor som udgangspunkt skrivebeskyttet. Storen genererer YAML live ved ændringer.
*   **Esc-Trap og Focus Escape:**
    *   Monaco Editor har en tendens til at fange tabulator- og tastaturfokus, så man ikke kan navigere væk med tastaturet.
    *   xArchi implementerer en specifik keydown listener (`useKeyboard.ts`). Når Monaco er fokuseret, vil et tryk på `Esc` tvinge editoren til at slippe fokus og returnere det til det visuelle lærred eller Zone 1.

## Smart Semantisk Labeling System

For at øge hastigheden under modelleringen foreslår systemet automatisk relation-navne, når der oprettes en forbindelse mellem to noder. Forslagene er baseret på de involverede node-typer:

*   **Actor $\rightarrow$ Process:** *"performs"*
*   **Process $\rightarrow$ Event:** *"emits"*
*   **Event $\rightarrow$ Process:** *"triggers"*
*   **Process $\rightarrow$ Entity:** *"updates"*
*   **Actor $\rightarrow$ System:** *"uses"*
*   **Capability $\rightarrow$ Bounded Context:** *"supported by"*
*   **Bounded Context $\rightarrow$ Bounded Context:** *"depends on"*
*   **Entity $\rightarrow$ Capability:** *"enables"*

Disse defaults kan altid overskrives manuelt i Node Properties sidepanelet.

## Node Oprettelse (NodeCreator Modal)

Når brugeren opretter et nyt begreb/node via `Alt + N` (eller "+ Nyt Begreb" knappen), tilpasser modalen sig dynamisk til det aktive views notation/plugin:

*   **Enkelt Tilladt Type (Single Type Optimization):**
    *   Hvis notationen kun tillader én type (fx Begrebsmodel, som kun tillader `class`), skjules søgefeltet og type-listen automatisk. I stedet vises en ren, uforanderlig badge mærket **Auto-valgt** med typens ikon og navn.
*   **Flere Tilladte Typer (Dynamisk Type-synkronisering):**
    *   Hvis notationen tillader flere typer (fx ArchiMate), vises et søgefelt samt en rulleliste af typer.
    *   **Fuzzy søgning:** Skrivning i søgefeltet filtrerer listen med det samme og synkroniserer den aktive type til det øverste match.
    *   **Piletast-navigation:** Brug af pil op/ned ændrer aktiv type og markerer den på listen med det samme.
    *   **Mouse-hover:** At føre musen over en type i listen markerer og vælger den som den aktive type.
    *   Det betyder, at labellen **Type: <Navn>** øverst, listen over lignende noder samt advarsler om duplikerede navne altid afspejler det aktuelt markerede element i realtid uden at kræve eksplicit klik.
*   **Oprettelse af nye target-noder i Relation Builder (`Alt + E`):**
    *   Når der oprettes en relation til en ny node, der endnu ikke eksisterer, skal brugeren vælge typen (archetype) for denne target-node.
    *   Hvis notationen kun understøtter én tilladt type (fx `class` i Begrebsmodel), **springes trin 2 (valg af type) automatisk over**. Relation Builder går direkte til trin 3 (indtastning af relationens label).
    *   Det forhindrer unødvendige kliks og skærmskift. Hvis brugeren går baglæns ved at trykke på Backspace, springes det tomme trin 2 også over, og brugeren returneres direkte til trin 1 (søgning/oprettelse af target).
    *   Knappen til trin 2 i stepperen deaktiveres desuden helt.
    *   Skulle man alligevel lande på trin 2, vises en ren banner-meddelelse om at typen er fastsat, i stedet for det tomme søgefelt.
