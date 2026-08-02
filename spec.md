# Specification: Notation-Specific Code Export Tabs & View Sync Fix

## Overview
This specification details:
1. Fixing the state sync bug in `CodeViewport` where switching views leaves stale YAML in "Aktuelt View".
2. Restricting export tabs (`OpenAPI`, `AsyncAPI`, `Arazzo`, `RDF/Turtle`) to be context-specific based on the active view's notation type (`activeView.type`).
3. Ensuring OpenAPI and AsyncAPI generators filter output strictly to the active view's concepts and relations when an `activeViewId` is supplied.

## Requirements

### 1. View Sync Fix in CodeViewport (`src/features/viewport/code/CodeViewport.tsx`)
- `localYaml` state must ONLY be populated when `activeCodeTab === 'full'` and the editor is not in read-only mode.
- `localYaml` must reset to `undefined` whenever `activeViewId` or `activeCodeTab` changes.
- Read-only tabs (`view`, `openapi`, `asyncapi`, `arazzo`, `rdf`) must always render dynamic `yamlContent` directly.

### 2. Contextual Export Tabs
- For `event_modeling` views:
  - Allowed tabs: `Hele Repositoriet`, `Aktuelt View`, `OpenAPI`, `AsyncAPI`, `Arazzo`.
- For `knowledge_graph`, `conceptual_model`, and `information_model` views:
  - Allowed tabs: `Hele Repositoriet`, `Aktuelt View`, `RDF / Turtle`.
- Default / no active view:
  - Allowed tabs: `Hele Repositoriet`, `Aktuelt View`.
- Automatic Tab Fallback: If switching to a view that does not support the current `activeCodeTab`, automatically fallback `activeCodeTab` to `'view'`.

### 3. View-Filtered Code Generators
- Update `generateOpenAPI(concepts, relations, views?, activeViewId?)`:
  - When `activeViewId` is provided, filter `concepts` and `relations` to only include elements present in `activeView.nodes`.
- Update `generateAsyncAPI(concepts, relations, views?, activeViewId?)`:
  - When `activeViewId` is provided, filter `concepts` and `relations` to only include elements present in `activeView.nodes`.
