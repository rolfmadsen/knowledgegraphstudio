import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App.tsx'
import { PluginRegistry } from './plugins/PluginRegistry'
import { knowledgeGraphPlugin } from './plugins/knowledge-graph'
import { archimatePlugin } from './plugins/archimate'
import { dataModelPlugin } from './plugins/data-model'
import { c4Plugin } from './plugins/c4'

// Polyfill Buffer for isomorphic-git
(window as any).Buffer = Buffer;

// Register notation plugins before React mounts
PluginRegistry.register(knowledgeGraphPlugin);
PluginRegistry.register(archimatePlugin);
PluginRegistry.register(dataModelPlugin);
PluginRegistry.register(c4Plugin);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
