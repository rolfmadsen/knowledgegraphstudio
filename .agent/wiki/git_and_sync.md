# Versionering & Synkronisering

Dette dokument beskriver, hvordan TypeGraph integrerer med browserens filsystem, håndterer Git-operationer, gemmer adgangskoder sikkert og løser synkroniseringskonflikter.

## Virtuelt Filsystem (lightning-fs)

Eftersom TypeGraph er en browserbaseret applikation, gemmes data lokalt via et virtuelt filsystem (VFS) i browseren:

*   **`lightning-fs` & VFS Namespace:**
    *   Hvert workspace har sit eget unikke namespace i VFS for at holde data adskilt.
    *   Det primære fil-layout i VFS består af modelleringsfilen `model.typegraph.yaml` og layout/visningsfilen `views.typegraph.yaml`.
*   **Debounced Auto-Save:**
    *   For at sikre at brugerens arbejde ikke går tabt uden at blokere ydeevnen, gemmes ændringer i Zustand automatisk til VFS via en debounced funktion. Hver gang tilstanden ændres, skrives de nye data til VFS efter et kort tidsinterval (debouced lagring).

## Git Engine og Commits

TypeGraph understøtter indbygget versionsstyring direkte i browseren:

*   **isomorphic-git:**
    *   Alle Git-operationer (staging, commits, status, fetch, merge, push og pull) udføres via `isomorphic-git` mod VFS.
*   **Auto-Commit:**
    *   Inden der udføres en Git Push, laves der automatisk et commit af alle ændringer i arbejdsområdet med beskeden `"Auto-commit: [timestamp]"`.
*   **CORS Proxy:**
    *   Direkte HTTP/Git-kommunikation fra en browser er begrænset af CORS-sikkerhedsregler. Derfor foretages remote pushes/pulls via en CORS proxy (fx standarden `https://cors.isomorphic-git.org` eller en brugerkonfigureret proxy).

## Sikker Håndtering af Credentials

Sikkerhed er kritisk for at beskytte brugerens adgangskoder til GitHub, GitLab osv.:

*   **Dexie.js (IndexedDB):**
    *   Brugerens Personal Access Token (PAT) gemmes **aldrig** i VFS, i `.typegraph.yaml` eller i commits.
    *   PAT gemmes udelukkende i en særskilt IndexedDB tabel kaldet `credentials` ved hjælp af **Dexie.js**. Denne tabel er isoleret fra Git-versionsstyringen.
*   **Remote URL:**
    *   Modtager-URL'en for git-arkivet (`RemoteConfig`) gemmes ligeledes sikkert lokalt og committes ikke til kildekoden. Kun HTTPS-adresser accepteres.

## Semantisk Konfliktløsning

For at bevare en brugervenlig grænseflade, der er keyboard-first og nem at forstå for ikke-teknikere, viser TypeGraph aldrig rå Git-konfliktmarkører (`<<<<<<< HEAD`):

*   **Koncept-niveau Diff:**
    *   Hvis et Git pull resulterer i en non-fast-forward merge-konflikt, indlæser systemet både den lokale og den modtagne (remote) YAML-fil.
    *   Systemet udregner en semantisk diff på konceptniveau.
*   **Silent Auto-Merge:**
    *   Elementer, der ikke er i konflikt (fx en node der kun er tilføjet lokalt eller en egenskab der kun er ændret på remote), merges automatisk i baggrunden uden at spørge brugeren.
*   **Visuel Konfliktløser (`ConflictResolverModal.tsx`):**
    *   Ved konfliktende elementer (fx hvis det samme Concept er modificeret forskelligt på begge sider) præsenteres brugeren for et visuelt kortbaseret interface. Brugeren vælger her for hvert element, om de vil beholde "Din version" (lokal) eller "Remote version".
    *   Når valgene er truffet, sammensættes den nye YAML-fil, valideres via Zod schemas, gemmes til VFS, committes og indlæses i Zustand.
*   **Monaco Fallback (Conflict Mode):**
    *   Hvis en YAML-fil overhovedet ikke kan parses (fx ved korrupt syntaks), falder systemet tilbage til en manuel fejltilstand. Canvas deaktiveres, og Monaco Editor sættes midlertidigt i redigerbar tilstand, så brugeren manuelt kan rette fejlene direkte i YAML-koden.
