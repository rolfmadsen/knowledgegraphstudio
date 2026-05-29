import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App.tsx'
import { PluginRegistry } from './plugins/PluginRegistry'
import { knowledgeGraphPlugin } from './plugins/knowledge-graph'
import { archimatePlugin } from './plugins/archimate'
import { c4Plugin } from './plugins/c4'
import { conceptualPlugin } from './plugins/core-model/conceptualPlugin'
import { informationPlugin } from './plugins/core-model/informationPlugin'

// Polyfill Buffer for isomorphic-git
(window as any).Buffer = Buffer;

// Patch to suppress Chrome's non-passive event listener warnings for ReactFlow / D3.
// Browsers warn when scroll-blocking events (touchstart, touchmove, wheel, mousewheel)
// are registered without explicitly defining the 'passive' option. Since ReactFlow
// needs non-passive events to prevent default scroll behavior during zooming/dragging,
// we explicitly default them to 'passive: false' when no value is provided.
(function patchPassiveEvents() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: any,
    options?: boolean | AddEventListenerOptions
  ) {
    if (['touchstart', 'touchmove', 'wheel', 'mousewheel'].includes(type)) {
      if (options === undefined) {
        options = { passive: false };
      } else if (typeof options === 'boolean') {
        options = { capture: options, passive: false };
      } else if (typeof options === 'object' && options.passive === undefined) {
        options = { ...options, passive: false };
      }
    }
    return originalAddEventListener.call(this, type, listener, options as any);
  };
})();


// Register notation plugins before React mounts
PluginRegistry.register(knowledgeGraphPlugin);
PluginRegistry.register(archimatePlugin);
PluginRegistry.register(c4Plugin);
PluginRegistry.register(conceptualPlugin);
PluginRegistry.register(informationPlugin);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
