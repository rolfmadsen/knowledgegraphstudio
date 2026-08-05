import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';

interface ReactFlowTestWrapperProps {
  children: React.ReactNode;
}

/**
 * React Flow Provider Wrapper Harness for Component Tests
 */
export function ReactFlowTestWrapper({ children }: ReactFlowTestWrapperProps) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '1000px', height: '800px' }}>
        {children}
      </div>
    </ReactFlowProvider>
  );
}
