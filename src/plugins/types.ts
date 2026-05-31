/**
 * Plugin System Types — Notation Plugin Interface
 *
 * A NotationPlugin encapsulates all rendering and layout logic for a
 * specific visual notation (e.g., Global Explorer / D3 force-directed,
 * ArchiMate, Entity-Relationship, etc.).
 *
 * The plugin is responsible for:
 *  - Declaring which ViewType(s) it handles
 *  - Providing a React component that renders the canvas for that notation
 *  - Optionally providing a layout engine that positions ViewNodes
 *
 * Rule: UI components MUST NOT instantiate plugins directly.
 * All plugin access goes through PluginRegistry.
 */

import type { ComponentType } from 'react';
import type { ViewType, View, ConceptType, ConceptRelation, ElementId } from '../schema/graphSchema';
import type { GraphStoreState } from '../store/useGraphStore';

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

export interface PluginCanvasProps {
  /** The view being rendered */
  view: View;
  /** Full store state — plugin reads concepts/relations for rendering */
  storeState: Pick<GraphStoreState, 'concepts' | 'relations' | 'selectedConceptId' | 'selectedRelationId'>;
  /** Callbacks the plugin uses to update the store */
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
// Plugin Definition
// ============================================================

export interface NotationPlugin {
  /** Unique identifier matching ViewType values this plugin handles */
  readonly id: string;
  /** Display name shown in the UI */
  readonly displayName: string;
  /** Icon name or emoji for the Views tab */
  readonly icon: string;
  /** Which ViewType(s) this plugin supports */
  readonly supportedViewTypes: ViewType[];
  /** The React component that renders the canvas for this notation */
  readonly CanvasComponent: ComponentType<PluginCanvasProps>;
  /**
   * Optional layout engine. If provided, the floating toolbar will offer
   * "Auto Layout" for this plugin's views.
   */
  readonly layoutEngine?: LayoutEngine;
  /**
   * Optional concept types supported/visible in this notation.
   * If omitted, all types are allowed.
   */
  readonly allowedConceptTypes?: ConceptType[];
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
   * Optional custom edge styler. Enables plugins to define their own visual edge line properties
   * (e.g. dashed vs solid, custom markers).
   */
  readonly getEdgeStyle?: (relation: ConceptRelation, isSelected: boolean) => EdgeStyle;
}

