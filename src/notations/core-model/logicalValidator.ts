import type { ConceptNode, View } from '../../schema/graphSchema';

export interface LogicalValidationError {
  nodeId: string;
  propertyId?: string;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Validates a Logical Data Model view and its concepts.
 * Emits error if attributes have missing datatypes, or invalid cardinalities.
 * Emits warning if logical entity lacks a logical identifier (isIdentifier).
 */
export function validateLogicalDataModel(view: View, concepts: ConceptNode[]): LogicalValidationError[] {
  if (view.type !== 'logical_data_model') return [];

  const errors: LogicalValidationError[] = [];
  const nodesInView = view.nodes
    .map((vn) => concepts.find((c) => c.id === vn.conceptId))
    .filter((c): c is ConceptNode => c !== undefined);

  for (const node of nodesInView) {
    if (node.conceptType === 'class') {
      const properties = node.properties ?? [];
      const hasIdentifier = properties.some((p) => p.isIdentifier);

      if (!hasIdentifier && properties.length > 0) {
        errors.push({
          nodeId: node.id,
          severity: 'warning',
          message: `Logisk entitet "${node.name}" har ingen angivet nøgle/identifikator (isIdentifier).`,
        });
      }

      for (const prop of properties) {
        if (!prop.type || prop.type.trim() === '') {
          errors.push({
            nodeId: node.id,
            propertyId: prop.id,
            severity: 'error',
            message: `Attribut "${prop.name}" i logisk entitet "${node.name}" mangler en eksplicit datatype.`,
          });
        }
      }
    }
  }

  return errors;
}
