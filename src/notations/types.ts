/**
 * Notation System Types — Notation Interface
 *
 * A Notation encapsulates all rendering and layout logic for a
 * specific visual notation (e.g., Global Explorer / D3 force-directed,
 * ArchiMate, Entity-Relationship, etc.).
 *
 * The notation is responsible for:
 *  - Declaring which ViewType(s) it handles
 *  - Providing a React component that renders the canvas for that notation
 *  - Optionally providing a layout engine that positions ViewNodes
 *
 * Rule: UI components MUST NOT instantiate notations directly.
 * All notation access goes through NotationRegistry.
 */

import type { ComponentType } from 'react';
import type { ViewType, View, ConceptType, ConceptRelation, ElementId, ConceptNode, ConceptProperty, DataType, LayoutAlgorithm } from '../schema/graphSchema';
import type { GraphStoreState } from '../store/useGraphStore';
import type { NotationCanvasPolicy } from '../features/viewport/graph/contracts/canvasPolicy';

// ============================================================
// Layout Engine
// ============================================================

export interface LayoutNode {
  id: string;  // conceptId
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
}

export interface LayoutLink {
  id: string;
  source: string; // conceptId
  target: string; // conceptId
}

export interface LayoutInput {
  nodes: LayoutNode[];
  links: LayoutLink[];
  layoutAlgorithm?: string;
}

export interface LayoutOutput {
  /** Updated positions for nodes — only include nodes whose position changed */
  positions: Array<{ conceptId: string; x: number; y: number }>;
}

/**
 * A layout engine takes a snapshot of the current view's nodes/links
 * and returns updated positions. Can be async (e.g., runs in a WebWorker).
 */
export type LayoutEngine = (input: LayoutInput) => Promise<LayoutOutput>;

// ============================================================
// Canvas Component Props
// ============================================================

export interface NotationCanvasProps {
  /** The view being rendered */
  view: View;
  /** Full store state — notation reads concepts/relations for rendering */
  storeState: Pick<GraphStoreState, 'concepts' | 'relations' | 'selectedConceptId' | 'selectedRelationId'>;
  /** Callbacks the notation uses to update the store */
  onNodePositionChange: (conceptId: ElementId, x: number, y: number) => void;
  onNodeSelect: (conceptId: ElementId | null) => void;
  onRelationSelect: (relationId: ElementId | null) => void;
  onConnect: (sourceConceptId: ElementId, targetConceptId: ElementId) => void;
}

export interface EdgeStyle {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
  stroke?: string;
}

// ============================================================
// Notation Definition
// ============================================================

export interface Notation {
  /** Unique identifier matching ViewType values this notation handles */
  readonly id: string;
  /** Display name shown in the UI */
  readonly displayName: string;
  /** Icon name or emoji for the Views tab */
  readonly icon: string;
  /** Which ViewType(s) this notation supports */
  readonly supportedViewTypes: ViewType[];
  /** Whether this notation uses orthogonal edge routing (90-degree lines) */
  readonly orthogonalEdges?: boolean;
  /** Canvas interaction and geometry policy */
  readonly canvasPolicy: NotationCanvasPolicy;
  /** The React component that renders the canvas for this notation */
  readonly CanvasComponent: ComponentType<NotationCanvasProps>;
  /**
   * Optional layout engine. If provided, the floating toolbar will offer
   * "Auto Layout" for this notation's views.
   */
  readonly layoutEngine?: LayoutEngine;
  /**
   * Optional layout algorithms supported by this notation.
   * If omitted, all generic layout options are shown.
   */
  readonly supportedLayoutAlgorithms?: LayoutAlgorithm[];
  /**
   * Optional default layout algorithm for this notation when a new view is created.
   */
  readonly defaultLayoutAlgorithm?: LayoutAlgorithm;
  /**
   * Optional localized labels for layout algorithms in this notation context.
   */
  readonly layoutAlgorithmLabels?: Partial<Record<LayoutAlgorithm, string>>;
  /**
   * Optional concept types supported/visible in this notation.
   * If omitted, all types are allowed.
   */
  readonly allowedConceptTypes?: ConceptType[];
  /**
   * Optional default element to automatically create when a new view is created for this notation
   */
  readonly defaultElement?: {
    conceptType: ConceptType;
    name: string;
  };
  /**
   * Optional list of nested default elements to automatically create when a new view is created for this notation.
   */
  readonly defaultElements?: Array<{
    conceptType: ConceptType;
    name: string;
    parentIndex?: number;
    xOffset?: number;
    yOffset?: number;
  }>;
  /**
   * Optional validator to check if a specific relationship type is allowed
   * between two concept types.
   */
  readonly isValidRelation?: (sourceType: ConceptType, targetType: ConceptType, label: string) => boolean;
  /**
   * Optional dynamic suggester for relationship types. If provided,
   * the Relation Builder will restrict options to these specific types.
   */
  readonly getAvailableRelations?: (sourceType: ConceptType, targetType: ConceptType) => Array<{ id: string; label: string; description: string }>;
  /**
   * Optional mapping of concept types to their localized notation-specific display names.
   */
  readonly conceptTypeLabels?: Partial<Record<ConceptType, string>>;
  /**
   * Optional custom edge styler. Enables notations to define their own visual edge line properties
   * (e.g. dashed vs solid, custom markers).
   */
  readonly getEdgeStyle?: (relation: ConceptRelation, isSelected: boolean) => EdgeStyle;
  /**
   * Optional custom properties Inspector component.
   */
  readonly InspectorComponent?: ComponentType<{
    concept: ConceptNode;
    updateProperty: (conceptId: ElementId, propertyId: ElementId, updates: Partial<ConceptProperty>) => void;
    deleteProperty: (conceptId: ElementId, propertyId: ElementId) => void;
    addProperty: (conceptId: ElementId, name: string, type: DataType, isRequired?: boolean) => void;
    updateConcept: (id: ElementId, updates: Partial<ConceptNode>) => void;
    concepts: ConceptNode[];
  }>;
  /**
   * Optional custom relation Inspector component.
   */
  readonly RelationInspectorComponent?: ComponentType<{
    relation: ConceptRelation;
    updateRelation: (id: ElementId, updates: Partial<ConceptRelation>) => void;
    concepts: ConceptNode[];
  }>;
  /**
   * Optional flag to suppress the generic views membership section in the properties inspector.
   */
  readonly hideViewsSection?: boolean;
  /**
   * Optional flag to suppress the parent group selection in the properties inspector.
   */
  readonly hideParentGroupSection?: boolean;
  /**
   * Optional quick actions for creating related nodes from the toolbar.
   */
  readonly getQuickActions?: (nodeType: ConceptType) => QuickActionConfig[];
}

export interface QuickActionConfig {
  conceptType: ConceptType;
  label: string;
  position: 'top' | 'right' | 'bottom' | 'left';
  direction: 'source-to-target' | 'target-to-source';
  createNewParent?: 'sibling-slice' | 'sibling-slice-left' | 'same-parent';
}

