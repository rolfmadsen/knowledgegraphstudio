#!/usr/bin/env node
/**
 * copy-monaco.js
 *
 * Copies Monaco Editor's pre-built min/vs assets from node_modules into
 * /public/monaco-editor/min/vs so the editor runs fully self-hosted,
 * eliminating the CDN dependency (cdn.jsdelivr.net) that adds ~200ms to load.
 *
 * Run automatically as part of the build pipeline (see package.json prebuild).
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'node_modules/monaco-editor/min/vs');
const dest = resolve(root, 'public/monaco-editor/min/vs');

if (!existsSync(src)) {
  console.error('[copy-monaco] ERROR: monaco-editor not found in node_modules.');
  console.error('  Run: npm install');
  process.exit(1);
}

console.log('[copy-monaco] Copying Monaco Editor assets to public/...');
mkdirSync(resolve(root, 'public/monaco-editor/min'), { recursive: true });

cpSync(src, dest, { recursive: true });

console.log('[copy-monaco] Done — Monaco Editor is now self-hosted at /monaco-editor/min/vs');
