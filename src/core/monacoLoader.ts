/**
 * monacoLoader.ts
 *
 * Configures Monaco Editor to use self-hosted assets from /public/monaco-editor/
 * instead of fetching from cdn.jsdelivr.net.
 *
 * This module must be imported once before any Monaco editor component renders.
 * Each Monaco component file imports this at the top to ensure the loader is
 * configured before the editor mounts.
 *
 * Performance gain: Eliminates ~200ms CDN round-trip and removes external
 * dependency on cdn.jsdelivr.net (identified in Lighthouse report).
 */
import { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    // Points to the self-hosted Monaco assets in /public/monaco-editor/min/vs
    // Copied there by scripts/copy-monaco.js during prebuild/predev
    vs: '/monaco-editor/min/vs',
  },
});
