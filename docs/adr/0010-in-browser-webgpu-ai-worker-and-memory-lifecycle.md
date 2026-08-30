---
type: Architectural Decision Record
title: "ADR 0010: In-Browser WebGPU AI Worker with Deterministic GPU-RAM Lifecycle"
description: "Local LLM inference via WebGPU in a dedicated Web Worker with automated GPU-RAM teardown timers"
status: stable
tags: [ai, webgpu, webllm, worker, lifecycle, memory, adr]
---

# 10. In-Browser WebGPU AI Worker with Deterministic GPU-RAM Lifecycle

* Status: Accepted
* Date: 2026-08-30

## Context

xArchi requires semantic assistance and AI-assisted concept extraction. Running an external AI daemon (like Ollama or Python server) breaks the zero-install local-first web experience. Conversely, calling cloud LLM APIs sends private domain knowledge over the network and requires user API keys. Furthermore, loading large LLM weights directly on the browser's main UI thread causes severe freezing during inference and model initialization, and retaining weights permanently in GPU memory consumes substantial system resources.

## Decision

We implement a dedicated, browser-local WebGPU AI architecture:

1. **WebGPU Local Inference (`@mlc-ai/web-llm`)**:
   - Executes open-weight models (e.g. `Qwen2.5-1.5B`) directly inside the browser using WebGPU acceleration without external network traffic.
   - Falls back gracefully to external API options if WebGPU (`navigator.gpu`) is unsupported in the user's browser.

2. **Dedicated Web Worker Isolation (`src/features/ai/workers/ai.worker.ts`)**:
   - All model initialization, tokenization, and streaming inference run in a dedicated Web Worker via `WebWorkerMLCEngineHandler`.
   - The main UI thread remains completely responsive and non-blocking during heavy AI generation.

3. **Deterministic GPU-RAM Teardown Timers**:
   - To prevent long-running GPU memory consumption on user devices, the worker lifecycle is governed by dual timers:
     - **Inactivity Timer**: If no inference requests are issued within 5 minutes, the worker is automatically terminated and resources released.
     - **Tab Switch / Panel Close Grace Timer**: When the user closes the AI panel or switches browser tabs, a 15-second grace timer is initiated. If the panel is not reopened before expiry, the worker is torn down, freeing 100% of GPU VRAM.

## Consequences

* **Positive**: 100% private, local-first zero-install AI capability.
* **Positive**: Butter-smooth 60fps canvas interactions during active model token streaming.
* **Positive**: Prevents GPU memory leaks and device battery drain through automated teardown timers.
* **Trade-off**: Requires WebGPU support in the browser and initial download of quantized model weights on first run.
