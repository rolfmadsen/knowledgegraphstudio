import type { InitialNodeGeometry, NodeGeometryContext } from './nodeGeometry';

export interface NodeContext {
  conceptId: string;
  conceptType?: string;
  isContainer?: boolean;
}

export interface RelationVisibilityContext {
  relationType: string;
  sourceType?: string;
  targetType?: string;
  viewType: string;
}

export interface NotationCanvasPolicy {
  getInitialNodeGeometry(context: NodeGeometryContext): InitialNodeGeometry;
  getNodeRole(context: NodeContext): 'leaf' | 'container' | 'annotation';
  shouldRenderRelation(context: RelationVisibilityContext): boolean;
}
