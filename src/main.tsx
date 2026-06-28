import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App.tsx'
import { NotationRegistry } from './notations/NotationRegistry'

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


// Register notations before React mounts.
// Core notation (knowledge-graph) is loaded eagerly — it's the default and
// used immediately. All other notations are registered lazily via dynamic
// import so they don't contribute to the initial JS parse cost.
import('./notations/knowledge-graph').then(({ knowledgeGraphNotation }) => {
  NotationRegistry.register(knowledgeGraphNotation);
});

// Secondary notations — loaded in the background after the app boots
Promise.all([
  import('./notations/archimate').then(({ archimateNotation }) => archimateNotation),
  import('./notations/c4').then(({ c4Notation }) => c4Notation),
  import('./notations/core-model/conceptualNotation').then(({ conceptualNotation }) => conceptualNotation),
  import('./notations/core-model/informationNotation').then(({ informationNotation }) => informationNotation),
  import('./notations/dcr').then(({ dcrNotation }) => dcrNotation),
  import('./notations/event-modeling').then(({ eventModelingNotation }) => eventModelingNotation),
]).then((notations) => {
  notations.forEach((n) => NotationRegistry.register(n));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
