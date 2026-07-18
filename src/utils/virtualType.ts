import type { ConceptNode, View, ConceptType } from '../schema/graphSchema';

export function getVirtualType(concept: ConceptNode, views: View[] = []): 'conceptual_class' | 'information_class' | ConceptType {
  if (concept.conceptType !== 'class') return concept.conceptType;
  const isInInformation = views.some(v => v.type === 'information_model' && v.nodes.some(vn => vn.conceptId === concept.id));
  
  const hasProps = 'properties' in concept && Array.isArray(concept.properties) && concept.properties.length > 0;
  if (isInInformation || concept.wasDerivedFrom || hasProps) {
    return 'information_class';
  }
  return 'conceptual_class';
}
