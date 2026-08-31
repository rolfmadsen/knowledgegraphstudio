# Task 004: Forbedring af OpenAPI Specifikation, Fleksibilitet og Help Center Guide
Status: DONE
Intent: 🚀 NEW FEATURE

## 🎯 Formål
Forbedre OpenAPI- og specifikationsgenereringen i Knowledge Graph Studio, så den genererede kode er 100% syntaktisk valid, bygger på OpenAPI 3.1.0, fjerner hårdkodede værdier til fordel for bruger- og visningsfelter, og modellerer API'er via `Integration Event` og `Read Model` i overensstemmelse med Martin Dilgers Event Modeling-principper. Desuden opdateres Help Center med en udførlig guide til API- og integrationsmodellering.

## 📋 Acceptance Criteria
- [x] **AC1 (OpenAPI 3.1 & js-yaml Serialization)**: `openapiGenerator.ts` genererer valid OpenAPI 3.1.0 YAML via `js-yaml.dump` uden indentation- eller escaping-fejl.
- [x] **AC2 (Dynamisk Info Object)**: `info.title`, `info.version` og `info.description` udledes dynamisk fra den aktive visning (`View.name`, `View.description`) eller domæne i stedet for hårdkodede værdier.
- [x] **AC3 (Sti-Aggregering & Path Parameters)**: Flere operationer på samme `endpointPath` samles under samme sti-nøgle i `paths:`. Eventuelle `{param}` i stier udtrækkes automatisk til formelle OpenAPI path parameters.
- [x] **AC4 (Integration Event & Read Model Modellering)**:
  - `Read Model` genererer `GET` operationer med response payload schemas.
  - `Integration Event` kan fungere som synkrone Ingress-endpoints (`POST`/`PUT`/`Webhook`) i OpenAPI eller asynkrone topics i AsyncAPI.
  - Payload-egenskaber udtrækkes fra både `concept.payload` og `concept.properties` med fuld JSON Schema datatype-mapping og `required` felter.
- [x] **AC5 (Help Center Dokumentation)**: Help Center indeholder en dedikeret guide til API- og systemintegrationsmodellering under Event Modeling.
- [x] **AC6 (Gauntlet & Test Verifikation)**: Alle eksisterende og nye tests i testsuiten består (`npm test`).

## 🚫 Must NOT
- Must NOT bryde eksisterende Event Modeling visninger, layout eller store-handlinger.
- Must NOT introducere duplikerede nøgler i den genererede YAML.
- Must NOT have hardcodede API titler eller faste danske tekster som ufravigelige værdier i generatoren.

## 📝 Revisions
- 2026-08-31: Opgave initialiseret efter sparring om OpenAPI 3.1, Martin Dilgers integrationsmønstre og Help Center behov.

## 🧪 Verifikation
- `npm test`
- `npx tsc --noEmit`
