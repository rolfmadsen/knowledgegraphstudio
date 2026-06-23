import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App.tsx'
import { NotationRegistry } from './notations/NotationRegistry'
import { knowledgeGraphNotation } from './notations/knowledge-graph'
import { archimateNotation } from './notations/archimate'
import { c4Notation } from './notations/c4'
import { conceptualNotation } from './notations/core-model/conceptualNotation'
import { informationNotation } from './notations/core-model/informationNotation'
import { dcrNotation } from './notations/dcr'
import { eventModelingNotation } from './notations/event-modeling'

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


// Register notations before React mounts
NotationRegistry.register(knowledgeGraphNotation);
NotationRegistry.register(archimateNotation);
NotationRegistry.register(c4Notation);
NotationRegistry.register(conceptualNotation);
NotationRegistry.register(informationNotation);
NotationRegistry.register(dcrNotation);
NotationRegistry.register(eventModelingNotation);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
