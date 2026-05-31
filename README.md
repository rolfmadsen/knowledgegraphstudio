# 🌐 Knowledge Graph Studio

A premium, local-first, and keyboard-navigable spatial modeling environment for structured knowledge.

![Knowledge Graph Studio](https://img.shields.io/badge/Status-Beta-emerald)
![Tech Stack](https://img.shields.io/badge/Stack-React_%7C_TS_%7C_Vite-blue)
![Design](https://img.shields.io/badge/Design-Modern_Pro-white)

## ✨ The Vision

Knowledge Graph Studio is designed for architects and modelers who value **speed**, **precision**, and **local-first privacy**. It transforms complex domain relationships into an elegant, navigable spatial graph, backed by a deterministic YAML schema and local Git versioning.

## 🚀 Key Features

### 🎮 Keyboard-First Modeling
*   **Spatial Walking**: Navigate concepts using `Arrow` keys; traverse relationships using `Alt + Arrows`.
*   **Command Hub**: Global fuzzy search and action palette via `Ctrl + K`.
*   **Drill & Edit**: `Enter` to instantly focus the Inspector; `Tab` to cycle through every property field.
*   **Universal Escape**: `Esc` reliably returns focus to the canvas from any panel or editor.

### 📐 Multi-Dimensional Viewports
*   **Graph View**: High-performance canvas powered by **React Flow** and **D3-Force** with Alpha Decay for battery-efficient layout.
*   **Code View**: Full-featured **Monaco Editor** for direct YAML manipulation.
*   **Split Mode**: Resizable side-by-side view for simultaneous visual and structural editing.
*   **Diff Mode**: Built-in Git diffing to track changes against the local HEAD.

### 💾 Local-First Persistence
*   **IndexedDB VFS**: A virtual file system running entirely in your browser via `lightning-fs`.
*   **Embedded Git**: Full version control history using `isomorphic-git`, enabling local commits and future remote synchronization.
*   **Auto-Save**: Debounced persistence ensures your work is always safe without interrupting your flow.

## 🛠 Tech Stack

- **Core**: React 19, TypeScript, Vite
- **Visuals**: React Flow, D3-Force, Tailwind CSS (Modern Pro Theme)
- **Editor**: Monaco Editor (YAML)
- **Persistence**: lightning-fs, isomorphic-git, Dexie (IndexedDB)
- **State**: Zustand (with Zundo for history)

## 🏁 Getting Started

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/rolfmadsen/knowledgegraphstudio.git
    cd knowledgegraphstudio
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Launch the Studio**:
    ```bash
    npm run dev
    ```


## 🔄 Remote Git Sync

Synchronize your local graph with external repositories (GitHub, GitLab, etc.) to collaborate with others or back up your data.

### 🔑 Authentication Guide

To enable synchronization, you need to provide a **Personal Access Token (PAT)** from your hosting provider.

#### GitHub (Fine-grained tokens)
1.  **Open Settings**: Click your avatar (top-right) → **Settings**.
2.  **Developer Settings**: Scroll down the left sidebar to **Developer settings**.
3.  **Generate Token**: Select **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
4.  **Repository Access**: Set **Repository access** to "Only select repositories" and choose your repo.
5.  **Add Permissions**: Click the **Permissions** dropdown (or **+ Add permissions**).
6.  **Selection**: Find **Contents** in the list and set its access level to **Read and write**.
7.  **Classic Alternative**: If using tokens (classic), ensure the `repo` scope is checked.

#### GitLab (Fine-grained tokens - Beta)
1.  **Open User Settings**: Click your avatar (top-right) → **Edit profile**.
2.  **Access Tokens**: Select **Access** → **Personal access tokens** in the left sidebar.
3.  **Generate**: Click **Generate token** → **Fine-grained token (beta)**.
4.  **Group and Project Access**: Select "Only specific groups or projects that I'm a member of" and add your target project.
5.  **Resource Permissions**: Scroll down to the list, find **Repository**, and click the arrow to expand it.
6.  **Resource Permissions**: In the sub-list under the expanded **Repository** category, check the boxes for:
    *   **Code** (Required for Pulling/Cloning)
    *   **Commit** (Required for Pushing)
7.  **Classic Alternative**: In the classic interface (not the beta one), you would instead check the `read_repository` and `write_repository` boxes.

### 📡 How to Sync
1.  **Configure**: Press `Ctrl + Shift + G` to open **Remote Sync Settings** in the Studio.
2.  **Credentials**: Enter your **Remote HTTPS URL** and your **PAT**.
3.  **Execute**: Use `Ctrl + Shift + P` to **Push** local changes or `Ctrl + Shift + L` to **Pull** remote updates.

---

# Architektur Notationer

## Begrebsmodel
WORK-IN-PROGRESS

## Informationsmodel
WORK-IN-PROGRESS

## Dynamic Response Condition Graph (DCR)

### BPMN er et flowchart (Imperativt)
BPMN er et imperativt sprog, hvor du dikterer præcis hvordan et mål nås gennem et eksplicit, centralstyret kontrolflow. Du tvinges til at kortlægge hver eneste mulige sti, forgrening og "happy path" fra start til slut. Denne tilgang er rigid og bliver lynhurtigt uoverskuelig, når du arbejder med sagsbehandling og vidensarbejde, hvor brugerne har brug for manøvrerum og fleksibilitet.

### DCR er et regelsæt (Deklarativt og Hændelsesdrevet)
DCR beskriver hvorfor og under hvilke begrænsninger (constraints) en proces kan eksekveres. I stedet for at tegne en dikteret køreplan, definerer du bare dine domænehændelser (Events) og lægger en logisk Declarativ Constraint af forretningsregler ned over dem. Inden for den Declarative Constraint er alt tilladt. Frem for at tvinge komplekse arbejdsgange ned i én standardiseret "happy path", omfavner DCR diversiteten i, hvordan processer faktisk udføres i den virkelige verden.

DCR i 4 fundamentale grundregler og 2 dynamiske relationer
Når du modellerer i DCR, starter du med at smide dine roller og hændelser ind på lærredet – helt uden forbindelser.

For at undgå, at folk forveksler reglerne med BPMN-flowpile (og fejlagtigt læser grafen som en sekvens), har nyere DCR-designs droppet pilehovederne fuldstændigt.
I stedet bruges:
- Cirkler til at angive betingelser
- Firkanter til at angive effekter

#### 4 fundamentale grundregler
De 4 fundamentale regler styrer den dynamiske tilstand af dine hændelser – altså om de er afventende, ekskluderede eller tilladte at udføre på et givent tidspunkt.

** Condition (Betingelse - markeret med en gul cirkel)**: En bagudrettet afhængighed (Forudsætning), der sikrer, at der ikke sker noget forkert. Reglen er: "A skal ske før B". Eksempelvis kan man ikke betale en faktura (B), før godkendelsen (A) er på plads. En Condition-relation betyder helt lavpraktisk, at B passivt kigger tilbage på A's tilstand: B kan kun eksekveres, hvis A allerede er eksekveret eller slet ikke er inkluderet i grafen.
- Logik: A 🠆● B
- Regel: "Du kan ikke udføre B, før du har udført A."
- Eksempel: Du kan ikke gå til eksamen (B), før du har afleveret de obligatoriske afleveringer (A).

**Response (Krav/Udestående - markeret med en blå firkant)**: En afledt fremadrettet forpligtelse (Udestående), der sikrer, at noget nødvendigt bliver gjort ude i fremtiden. Reglen er: "Når A sker, opstår der et udestående om, at B skal ske senere". Hvis en betaling godkendes (A), så skal overførslen også gennemføres (B) på et eller andet tidspunkt. En Response-relation betyder, at når A eksekveres, udløses et aktivt krav, og B bliver omgående markeret som 'afventende' (pending). Hele processen efterlades i en urolig tilstand og er blokeret fra at kunne afsluttes, indtil B er eksekveret eller ekskluderet.
- Logik: A ●🠆 B
- Regel: "Hvis du gør A, opstår der et krav om, at du på et tidspunkt skal gøre B."
- Eksempel: Hvis du bestiller en vare (A), opstår der et krav om, at du skal betale fakturaen (B), før forløbet kan afsluttes.

**Exclude (Ekskludér - markeret med en rød firkant)**: "Når A sker, fjerner vi B som en mulighed." En Exclude-relation betyder simpelthen, at A sletter B fra brættet, så den ikke længere kan ske (eller blokere processen). Hvis f.eks. ansøgeren afvises i Nyt SIS, ekskluderes alle hændelser omkring indskrivning.
- Logik: A 🠆% B
- Regel: "At gøre A fjerner muligheden for at gøre B."
- Eksempel: Hvis du melder dig ud af studiet (A), fjernes muligheden for at blive tilmeldt undervisning (B).

**Include (Inkludér - markeret med en grøn firkant)**: "Når A sker, bringer vi B tilbage i spil." En Include-relation gør en tidligere ekskluderet hændelse relevant og mulig igen. Hvis de studerende anker et afslag (A), geninkluderes muligheden for sagsbehandling (B).
- Logik: A 🠆+ B
- Regel: "At gøre A gør B til en mulighed igen."
- Eksempel: Hvis du dumper din eksamen (A), bliver det igen muligt at tilmelde dig reeksamen (B).

#### 2 dynamiske relationer

Den fulde DCR-standard indeholder yderligere to dynamiske relationer, som er afgørende for at håndtere komplekse forretningsregler og indlejrede sub-processer (Nested DCR):

**Milestone (Milepæl - markeret med en lilla ruder)**: "A må ikke være et udestående krav, når du udfører B". Hvor en Condition dikterer, at en hændelse skal være udført mindst én gang før B, dikterer en Milestone blot, at A ikke må være markeret som afventende (Pending Response) på det tidspunkt, B eksekveres. Hvis A er en milepæl for B, og A er skemalagt til udførelse, er B blokeret. Bliver A derimod ekskluderet eller udført (så den ikke længere afventer), frigives B.
- Logik: A 🠆♢ B
- Regel: "Du kan ikke udføre B, så længe A stadig afventer at blive løst."
- Eksempel: Du kan ikke udstede eksamensbeviset (B), så længe der afventer en aktiv klagesag (A). (Når klagesagen er afgjort eller afvist, frigives udstedelsen af beviset).

**Spawn / Replication (Kloning - dynamisk oprettelse)**: "Når A sker, oprettes en ny, uafhængig instans af sub-processen B". Dette bruges (ofte i udvidelsen DCR*) til at håndtere situationer, hvor en proces kan forekomme et ukendt antal gange parallelt. For eksempel kan modtagelsen af en ny ansøgning (A) "spawne" et helt nyt, lokalt behandlings-flow (B) dedikeret specifikt til den ene ansøgning med sin egen livscyklus.
- Logik: !A
- Regel: "Når A sker, oprettes en ny, uafhængig instans af sub-processen B."
- Eksempel: For hver gang der modtages en ny byggeansøgning (A), oprettes der et nyt sagsbehandlingsforløb (B), som har sin egen uafhængige livscyklus og skal behandles adskilt fra de andre ansøgninger.

Når man migrerer fra et on-prem legacy-system over i én samlet SaaS-løsning, er det næsten umuligt (og dyrt) at kortlægge og hardcode alle BPMN-undtagelser og undtagelser på forhånd. Med DCR kan I starte i det små med de absolutte kernekrav og digitalisere løbende, mens I lader den konkrete rækkefølge af handlinger være styret af den enkelte cases virkelighed.

## C4
WORK-IN-PROGRESS

## ArchiMate
WORK-IN-PROGRESS