import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as joint from '@joint/core';
import { mapGraphToJointCells, type JointMapperInput } from './jointMapper';
import { renderNodeHTML } from './renderNode';
import type { ConceptNode, ElementId } from '../../schema/graphSchema';

export interface JointReactCanvasWrapperProps {
  data: JointMapperInput;
  selectedConceptId?: ElementId | null;
  selectedRelationId?: ElementId | null;
  onSelectConcept?: (id: ElementId | null) => void;
  onSelectRelation?: (id: ElementId | null) => void;
  onNodeMove?: (id: ElementId, x: number, y: number) => void;
  className?: string;
}

export interface JointReactCanvasWrapperRef {
  paper: joint.dia.Paper | null;
  graph: joint.dia.Graph | null;
  panToNode: (nodeId: string) => void;
  setZoom: (zoomLevel: number) => void;
}

export const JointReactCanvasWrapper = forwardRef<JointReactCanvasWrapperRef, JointReactCanvasWrapperProps>(
  (
    {
      data,
      selectedConceptId,
      selectedRelationId,
      onSelectConcept,
      onSelectRelation,
      onNodeMove,
      className = '',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<joint.dia.Graph | null>(null);
    const paperRef = useRef<joint.dia.Paper | null>(null);

    // Provide methods via imperative handle
    useImperativeHandle(ref, () => ({
      get paper() {
        return paperRef.current;
      },
      get graph() {
        return graphRef.current;
      },
      panToNode: (nodeId: string) => {
        if (!graphRef.current || !paperRef.current) return;
        let cell = graphRef.current.getCell(nodeId);
        if (!cell) {
          cell = graphRef.current.getElements().find((el) => el.get('id') === nodeId || el.prop('conceptData')?.id === nodeId) || null;
        }
        if (cell && cell.isElement()) {
          const position = (cell as joint.dia.Element).position();
          const size = (cell as joint.dia.Element).size() || { width: 180, height: 100 };
          const paperSize = paperRef.current.getComputedSize() || { width: 800, height: 600 };
          const targetX = paperSize.width / 2 - (position.x + size.width / 2);
          const targetY = paperSize.height / 2 - (position.y + size.height / 2);
          paperRef.current.translate(targetX, targetY);
        }
      },
      setZoom: (zoomLevel: number) => {
        if (paperRef.current) {
          paperRef.current.scale(zoomLevel, zoomLevel);
        }
      },
    }));

    // Initialize JointJS Graph & Paper
    useEffect(() => {
      if (!containerRef.current) return;

      const graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });
      graphRef.current = graph;

      const paper = new joint.dia.Paper({
        el: containerRef.current,
        model: graph,
        width: '100%',
        height: '100%',
        gridSize: 10,
        drawGrid: { name: 'mesh', color: '#e2e8f0' },
        background: { color: '#f8fafc' },
        interactive: true,
        cellViewNamespace: joint.shapes,
        async: true,
        sorting: joint.dia.Paper.sorting.APPROX,
        defaultRouter: { name: 'manhattan' },
        defaultConnector: { name: 'rounded' },
      });

      paperRef.current = paper;

      // Event listeners
      paper.on('element:pointerclick', (elementView) => {
        const id = elementView.model.get('id') as ElementId;
        onSelectConcept?.(id);
      });

      paper.on('link:pointerclick', (linkView) => {
        const id = linkView.model.get('id') as ElementId;
        onSelectRelation?.(id);
      });

      paper.on('blank:pointerclick', () => {
        onSelectConcept?.(null);
        onSelectRelation?.(null);
      });

      paper.on('element:pointerup', (elementView) => {
        const id = elementView.model.get('id') as ElementId;
        const pos = elementView.model.position();
        onNodeMove?.(id, pos.x, pos.y);
      });

      return () => {
        paper.remove();
        graph.clear();
      };
    }, []);

    // Sync mapped graph data to JointJS graph
    useEffect(() => {
      if (!graphRef.current) return;

      const { elements, links } = mapGraphToJointCells(data);

      graphRef.current.clear();
      graphRef.current.addCells([...elements, ...links]);

      // Apply HTML views for elements if conceptData is present
      elements.forEach((el) => {
        const concept = el.prop('conceptData') as ConceptNode | undefined;
        if (concept && paperRef.current) {
          const view = paperRef.current.findViewByModel(el);
          if (view && view.el) {
            const htmlContent = renderNodeHTML(concept);
            const foreignObj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObj.setAttribute('width', `${el.size().width}`);
            foreignObj.setAttribute('height', `${el.size().height}`);
            foreignObj.innerHTML = htmlContent;

            const labelEl = view.el.querySelector('.joint-label');
            if (labelEl) labelEl.remove();
            view.el.appendChild(foreignObj);
          }
        }
      });
    }, [data]);

    // Update selection styling
    useEffect(() => {
      if (!graphRef.current) return;

      graphRef.current.getElements().forEach((el) => {
        const isSel = el.get('id') === selectedConceptId;
        el.attr('body/stroke', isSel ? '#2563eb' : (el.prop('conceptData')?.conceptType === 'class' ? '#0284c7' : '#ca8a04'));
        el.attr('body/strokeWidth', isSel ? 3 : 2);
      });

      graphRef.current.getLinks().forEach((link) => {
        const isSel = link.get('id') === selectedRelationId;
        link.attr('line/stroke', isSel ? '#2563eb' : '#475569');
        link.attr('line/strokeWidth', isSel ? 3 : 2);
      });
    }, [selectedConceptId, selectedRelationId]);

    return (
      <div className={`relative w-full h-full min-h-[400px] overflow-hidden ${className}`}>
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }
);

JointReactCanvasWrapper.displayName = 'JointReactCanvasWrapper';
