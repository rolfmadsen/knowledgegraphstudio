---
type: Architectural Decision Record
title: "ADR 0005: Secure Credentials Handling"
description: "Isolation of Git credentials in Dexie.js IndexedDB and restriction to HTTPS remote URLs"
status: stable
tags: [security, credentials, dexie, indexeddb, git, adr]
---

# 0005: Secure Credentials Handling

## Status
accepted

## Context
Our application needs to integrate with Git repositories (e.g. GitHub) to push and pull model changes directly from the browser. However, Git remote credentials—specifically Personal Access Tokens (PATs)—are sensitive and must be protected. Committing credentials to source files, or saving them inside workspace files like `model.xarchi.yaml`, exposes them to repository leaks and compromises security.

## Decision
We enforce the following rules for Remote URL and Credentials Security:

1. **Credentials Isolation:**
   * Personal Access Tokens (PATs) and repository authentication details must NEVER be stored in the virtual filesystem (VFS), inside modeling files (`model.xarchi.yaml` or `views.xarchi.yaml`), or in git commits.
   * Credentials must be saved exclusively inside an isolated browser-local database (`credentials` table) using **Dexie.js** (IndexedDB wrapper). This table is kept separate from the VFS namespace and is never staged or versioned.

2. **Remote URL Protocol Restriction:**
   * Remote configuration URLs (`RemoteConfig`) must be managed securely. Only HTTPS remote git repository URLs are supported; unencrypted HTTP links are strictly rejected.

## Consequences
* Protects user API tokens and passwords from being accidentally committed or leaked.
* Workspace files remain clean of user-specific configurations, ensuring portability.
* Users must enter credentials once per browser profile to access remote sync.
