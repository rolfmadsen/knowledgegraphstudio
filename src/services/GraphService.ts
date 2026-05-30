/**
 * GraphService — Internal API for graph mutations (Spec §12)
 *
 * Computational Service: Pure synchronous data transformers with no side-effects.
 * Accepts GraphState as first argument and returns Partial<GraphState> (and element if created)
 * for the store to apply via set().
 */
import { generateId } from '../core/idGenerator';
import {
  type ConceptType,
  type ElementId,
  type DataClassification,
  type ConceptNode,
  type ConceptRelation,
  type Domain,
  type View,
  type DataType,
  type ConceptProperty,
  type BaseConceptNode,
} from '../schema/graphSchema';

export interface GraphStateWithSelection {
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  views?: View[];
  activeViewId?: ElementId | null;
  selectedConceptId?: ElementId | null;
  selectedRelationId?: ElementId | null;
}

export class GraphService {
  /**
   * Create a new domain.
   */
  static addDomain(state: GraphStateWithSelection, name: string, description?: string): { domain: Domain; nextState: Partial<GraphStateWithSelection> } {
    const id = generateId('bounded_context', name);
    const now = Date.now();
    const domain: Domain = {
      id,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active',
      name,
      description,
    };
    return {
      domain,
      nextState: {
        domains: [...state.domains, domain],
      },
    };
  }

  /**
   * Update an existing domain.
   */
  static updateDomain(state: GraphStateWithSelection, id: ElementId, updates: Partial<Pick<Domain, 'name' | 'description' | 'lifecycleState'>>): Partial<GraphStateWithSelection> {
    const now = Date.now();
    return {
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: now } : d
      ),
      concepts: state.concepts.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: now } : c
      ),
    };
  }

  /**
   * Delete a domain and clear references in concepts.
   */
  static deleteDomain(state: GraphStateWithSelection, id: ElementId): Partial<GraphStateWithSelection> {
    return {
      domains: state.domains.filter((d) => d.id !== id),
      concepts: state.concepts
        .filter((c) => c.id !== id)
        .map((c) =>
          c.domainId === id ? { ...c, domainId: undefined } : c
        ),
    };
  }

  /**
   * Create a new concept.
   */
  static addConcept(state: GraphStateWithSelection, conceptType: ConceptType, name: string, options: {
    domainId?: ElementId;
    parentId?: ElementId;
    classification?: DataClassification;
    definition?: string;
    aliases?: string[];
  } = {}): { concept: ConceptNode; nextState: Partial<GraphStateWithSelection> } {
    const trimmedName = name.trim().toLowerCase();
    const views = state.views || [];
    const activeView = views.find((v) => v.id === state.activeViewId);

    const existing = state.concepts.find((c) => {
      if (c.conceptType !== conceptType) return false;
      if (c.name.trim().toLowerCase() !== trimmedName) return false;

      if (conceptType === 'class') {
        const isCreatingConceptual = activeView?.type === 'conceptual_model';
        const isCreatingInformation = activeView?.type === 'information_model';

        const virtualType = GraphService.getVirtualType(c, views);

        if (isCreatingConceptual && virtualType === 'conceptual_class') return true;
        if (isCreatingInformation && virtualType === 'information_class') return true;
        if (!isCreatingConceptual && !isCreatingInformation) return true;
        return false;
      }

      return true;
    });

    if (existing) {
      return {
        concept: existing,
        nextState: {},
      };
    }

    const id = generateId(conceptType, name);
    const now = Date.now();
    const base = {
      id,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active' as const,
      conceptType,
      name,
      aliases: options.aliases ?? [],
      definition: options.definition,
      domainId: options.domainId || state.domains[0]?.id,
      parentId: options.parentId,
      classification: options.classification,
      policies: [],
    };

    // Build type-correct concept: enumerations get enumerators,
    // domain/bounded_context get neither, all others get properties.
    let concept: ConceptNode;
    if (conceptType === 'enumeration') {
      concept = { ...base, enumerators: [] } as ConceptNode;
    } else if (conceptType === 'domain' || conceptType === 'bounded_context') {
      concept = base as ConceptNode;
    } else {
      concept = { ...base, properties: [] } as ConceptNode;
    }

    return {
      concept,
      nextState: {
        concepts: [...state.concepts, concept],
      },
    };
  }

  /**
   * Update an existing concept.
   */
  static updateConcept(state: GraphStateWithSelection, id: ElementId, updates: Partial<BaseConceptNode> & { conceptType?: ConceptType; properties?: ConceptProperty[]; enumerators?: string[] }): Partial<GraphStateWithSelection> {
    const now = Date.now();
    let newId = id;
    const targetConcept = state.concepts.find(c => c.id === id);

    // If the conceptType is changing, we must update the ID prefix to maintain semantic correctness
    if (updates.conceptType && targetConcept && targetConcept.conceptType !== updates.conceptType) {
      const parts = id.split(':');
      if (parts.length === 2) {
        const uuid = parts[1];
        newId = `${updates.conceptType}:${uuid}` as ElementId;
      }
    }

    const idChanged = newId !== id;

    return {
      concepts: state.concepts.map((c) => {
        let updatedConcept = c.id === id ? ({ ...c, ...updates, id: newId, updatedAt: now } as ConceptNode) : c;

        // If the ID changed, check and update any wasDerivedFrom reference
        if (idChanged) {
          let hasChanges = false;
          let nextWasDerivedFrom = updatedConcept.wasDerivedFrom;
          if (updatedConcept.wasDerivedFrom === id) {
            nextWasDerivedFrom = newId;
            hasChanges = true;
          }

          if ('properties' in updatedConcept && updatedConcept.properties) {
            const nextProperties = updatedConcept.properties.map((p) => {
              if (p.wasDerivedFrom === id) {
                return { ...p, wasDerivedFrom: newId };
              }
              return p;
            });
            if (nextProperties.some((p, idx) => p !== (updatedConcept as any).properties[idx])) {
              hasChanges = true;
            }

            if (hasChanges) {
              updatedConcept = {
                ...updatedConcept,
                wasDerivedFrom: nextWasDerivedFrom,
                properties: nextProperties,
                updatedAt: now,
              } as ConceptNode;
            }
          } else {
            if (hasChanges) {
              updatedConcept = {
                ...updatedConcept,
                wasDerivedFrom: nextWasDerivedFrom,
                updatedAt: now,
              } as ConceptNode;
            }
          }
        }
        return updatedConcept;
      }),
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, ...updates, id: newId, updatedAt: now } : d
      ),
      relations: idChanged
        ? state.relations.map((r) => ({
          ...r,
          sourceConceptId: r.sourceConceptId === id ? newId : r.sourceConceptId,
          targetConceptId: r.targetConceptId === id ? newId : r.targetConceptId
        }))
        : state.relations,
      views: idChanged && state.views
        ? state.views.map((v) => ({
          ...v,
          nodes: v.nodes.map((n) =>
            n.conceptId === id ? { ...n, conceptId: newId } : n
          )
        }))
        : state.views,
      selectedConceptId: state.selectedConceptId === id ? newId : state.selectedConceptId
    };
  }

  /**
   * Delete a concept and perform orphan cleanup on relations.
   */
  static deleteConcept(state: GraphStateWithSelection, id: ElementId): Partial<GraphStateWithSelection> {
    const now = Date.now();
    return {
      concepts: state.concepts
        .filter((c) => c.id !== id)
        .map((c) => {
          let hasChanges = false;
          let nextWasDerivedFrom = c.wasDerivedFrom;
          if (c.wasDerivedFrom === id) {
            nextWasDerivedFrom = null;
            hasChanges = true;
          }
          if ('properties' in c && c.properties) {
            const nextProperties = c.properties.map((p) => {
              if (p.wasDerivedFrom === id) {
                return { ...p, wasDerivedFrom: null };
              }
              return p;
            });
            if (nextProperties.some((p, idx) => p !== (c as any).properties[idx])) {
              hasChanges = true;
            }
            if (hasChanges) {
              return {
                ...c,
                wasDerivedFrom: nextWasDerivedFrom,
                properties: nextProperties,
                updatedAt: now,
              } as ConceptNode;
            }
          } else {
            if (hasChanges) {
              return {
                ...c,
                wasDerivedFrom: nextWasDerivedFrom,
                updatedAt: now,
              } as ConceptNode;
            }
          }
          return c;
        }),
      relations: state.relations.filter(
        (r) => r.sourceConceptId !== id && r.targetConceptId !== id,
      ),
      selectedConceptId: state.selectedConceptId === id ? null : state.selectedConceptId,
    };
  }

  /**
   * Create a new relation with smart default naming.
   */
  static addRelation(state: GraphStateWithSelection, sourceId: ElementId, targetId: ElementId, name?: string, options: {
    relationType?: string;
    category?: 'structural' | 'semantic';
    multiplicity?: string;
    mappingPattern?: ConceptRelation['mappingPattern'];
    transformationDescription?: string;
    isDirected?: boolean;
  } = {}): { relation: ConceptRelation; nextState: Partial<GraphStateWithSelection> } {
    const source = state.concepts.find(c => c.id === sourceId);
    const target = state.concepts.find(c => c.id === targetId);

    // Generate a smart default name if none provided
    let finalName = name;
    if (!finalName) {
      const sType = source?.conceptType;
      const tType = target?.conceptType;

      if (sType === 'actor' && tType === 'process') finalName = 'performs';
      else if (sType === 'process' && tType === 'event') finalName = 'emits';
      else if (sType === 'event' && tType === 'process') finalName = 'triggers';
      else if (sType === 'process' && tType === 'entity') finalName = 'updates';
      else if (sType === 'actor' && tType === 'system') finalName = 'uses';
      else if (sType === 'system' && tType === 'system') finalName = 'integrates';
      else if (sType === 'capability' && tType === 'bounded_context') finalName = 'supported by';
      else if (sType === 'bounded_context' && tType === 'bounded_context') finalName = 'depends on';
      else if (sType === 'entity' && tType === 'capability') finalName = 'enables';
      else finalName = 'relates to';
    }

    const id = generateId('other', finalName);
    const now = Date.now();
    const relation: ConceptRelation = {
      id,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active',
      sourceConceptId: sourceId,
      targetConceptId: targetId,
      name: finalName,
      category: options.category ?? 'semantic',
      relationType: options.relationType as any,
      multiplicity: options.multiplicity,
      mappingPattern: options.mappingPattern,
      transformationDescription: options.transformationDescription,
      isDirected: options.isDirected ?? true,
      policies: [],
    };

    return {
      relation,
      nextState: {
        relations: [...state.relations, relation],
      },
    };
  }

  /**
   * Update an existing relation.
   */
  static updateRelation(state: GraphStateWithSelection, id: ElementId, updates: Partial<ConceptRelation>): Partial<GraphStateWithSelection> {
    return {
      relations: state.relations.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r,
      ),
    };
  }

  /**
   * Delete a relation from the graph.
   */
  static deleteRelation(state: GraphStateWithSelection, id: ElementId): Partial<GraphStateWithSelection> {
    return {
      relations: state.relations.filter((r) => r.id !== id),
      selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
    };
  }

  /**
   * Add a property to a concept.
   */
  static addProperty(state: GraphStateWithSelection, conceptId: ElementId, name: string, type: DataType, isRequired?: boolean): Partial<GraphStateWithSelection> {
    const propId = generateId('other', name);
    const now = Date.now();
    const property = {
      id: propId,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active' as const,
      name,
      type,
      isRequired,
    };

    return {
      concepts: state.concepts.map((c) => {
        if (c.id === conceptId && 'properties' in c && c.properties) {
          return { ...c, properties: [...c.properties, property], updatedAt: now } as ConceptNode;
        }
        return c;
      }),
    };
  }

  /**
   * Update a property on a concept.
   */
  static updateProperty(
    state: GraphStateWithSelection,
    conceptId: ElementId,
    propertyId: ElementId,
    updates: Partial<ConceptProperty>
  ): Partial<GraphStateWithSelection> {
    const now = Date.now();
    return {
      concepts: state.concepts.map((c) => {
        if (c.id === conceptId && 'properties' in c && c.properties) {
          return {
            ...c,
            properties: c.properties.map((p) =>
              p.id === propertyId ? { ...p, ...updates, updatedAt: now } : p,
            ),
            updatedAt: now,
          } as ConceptNode;
        }
        return c;
      }),
    };
  }

  /**
   * Delete a property from a concept.
   */
  static deleteProperty(state: GraphStateWithSelection, conceptId: ElementId, propertyId: ElementId): Partial<GraphStateWithSelection> {
    return {
      concepts: state.concepts.map((c) => {
        if (c.id === conceptId && 'properties' in c && c.properties) {
          return {
            ...c,
            properties: c.properties.filter((p) => p.id !== propertyId),
            updatedAt: Date.now(),
          } as ConceptNode;
        }
        return c;
      }),
    };
  }

  /**
   * Add a policy to a concept.
   */
  static addPolicy(
    state: GraphStateWithSelection,
    conceptId: ElementId,
    policyData: Omit<ConceptNode['policies'][0], 'id' | 'createdAt' | 'updatedAt' | 'lifecycleState'>
  ): Partial<GraphStateWithSelection> {
    const policyId = generateId('other', policyData.name);
    const now = Date.now();
    const policy = {
      ...policyData,
      id: policyId,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active' as const,
    };

    return {
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? { ...c, policies: [...c.policies, policy], updatedAt: now }
          : c,
      ),
    };
  }

  /**
   * Update a policy on a concept.
   */
  static updatePolicy(
    state: GraphStateWithSelection,
    conceptId: ElementId,
    policyId: ElementId,
    updates: Partial<Omit<ConceptNode['policies'][0], 'id' | 'createdAt' | 'updatedAt'>>
  ): Partial<GraphStateWithSelection> {
    const now = Date.now();
    return {
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? {
            ...c,
            updatedAt: now,
            policies: c.policies.map((p) =>
              p.id === policyId ? { ...p, ...updates, updatedAt: now } : p
            ),
          }
          : c
      ),
    };
  }

  /**
   * Delete a policy from a concept.
   */
  static deletePolicy(state: GraphStateWithSelection, conceptId: ElementId, policyId: ElementId): Partial<GraphStateWithSelection> {
    return {
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? {
            ...c,
            updatedAt: Date.now(),
            policies: c.policies.filter((p) => p.id !== policyId),
          }
          : c
      ),
    };
  }

  /**
   * Quick creation of a relation, optionally creating a new target concept.
   * Part of the Relationship Builder Palette (Spec §12.2)
   */
  static createQuickRelation(state: GraphStateWithSelection, params: {
    sourceId: ElementId;
    targetIdOrName: string;
    isNewTarget: boolean;
    targetType?: ConceptType;
    label: string;
    relationType?: string;
  }): Partial<GraphStateWithSelection> {
    let targetId: ElementId;
    let intermediateState = state;
    let addedConcepts = [...state.concepts];

    if (params.isNewTarget) {
      const { concept, nextState } = this.addConcept(state, params.targetType || 'entity', params.targetIdOrName);
      targetId = concept.id;
      addedConcepts = nextState.concepts || addedConcepts;
      intermediateState = { ...state, concepts: addedConcepts };
    } else {
      targetId = params.targetIdOrName as ElementId;
    }

    const { nextState: finalState } = this.addRelation(intermediateState, params.sourceId, targetId, params.label, { relationType: params.relationType });
    return {
      ...finalState,
      concepts: addedConcepts,
      selectedConceptId: targetId,
    };
  }

  /**
   * Selection: Select a concept.
   */
  static selectConcept(id: ElementId | null): { selectedConceptId: ElementId | null; selectedRelationId: null } {
    return { selectedConceptId: id, selectedRelationId: null };
  }

  /**
   * Selection: Select a relation.
   */
  static selectRelation(id: ElementId | null): { selectedRelationId: ElementId | null; selectedConceptId: null } {
    return { selectedRelationId: id, selectedConceptId: null };
  }

  // NOTE: Node position/size methods removed — layout data now lives in
  // ViewNode inside a View. See store actions: updateViewNodePosition, updateViewNodeSize.

  /**
   * Navigation: Select the nearest node in a spatial direction.
   * Looks up coordinates from the active view's ViewNodes.
   */
  static selectNearestNode(state: GraphStateWithSelection, direction: 'up' | 'down' | 'left' | 'right'): { selectedConceptId: ElementId | null } {
    const currentId = state.selectedConceptId;
    const activeView = state.views?.find(v => v.id === state.activeViewId);
    if (!activeView) return { selectedConceptId: currentId ?? null };

    const posOf = (id: ElementId) => activeView.nodes.find(n => n.conceptId === id);

    if (!currentId) {
      if (activeView.nodes.length > 0) {
        return { selectedConceptId: activeView.nodes[0].conceptId };
      }
      return { selectedConceptId: null };
    }

    const currentPos = posOf(currentId);
    if (!currentPos) return { selectedConceptId: null };

    let candidates = activeView.nodes.filter(n => n.conceptId !== currentId);
    if (direction === 'up') candidates = candidates.filter(n => n.y < currentPos.y);
    if (direction === 'down') candidates = candidates.filter(n => n.y > currentPos.y);
    if (direction === 'left') candidates = candidates.filter(n => n.x < currentPos.x);
    if (direction === 'right') candidates = candidates.filter(n => n.x > currentPos.x);

    if (candidates.length === 0) return { selectedConceptId: currentId };

    const scored = candidates.map(n => {
      const dx = n.x - currentPos.x;
      const dy = n.y - currentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let penalty = 1;
      if (direction === 'left' || direction === 'right') {
        penalty = 1 + (Math.abs(dy) / (Math.abs(dx) || 1));
      } else {
        penalty = 1 + (Math.abs(dx) / (Math.abs(dy) || 1));
      }
      return { id: n.conceptId, score: dist * penalty };
    });
    scored.sort((a, b) => a.score - b.score);
    return { selectedConceptId: scored[0].id };
  }

  /**
   * Navigation: Select the nearest edge connected to the current node in a spatial direction.
   * Looks up coordinates from the active view's ViewNodes.
   */
  static selectNearestEdge(state: GraphStateWithSelection, direction: 'up' | 'down' | 'left' | 'right'): { selectedRelationId: ElementId | null } {
    let currentId = state.selectedConceptId;
    if (!currentId && state.selectedRelationId) {
      const rel = state.relations.find(r => r.id === state.selectedRelationId);
      if (rel) currentId = rel.sourceConceptId;
    }
    if (!currentId) return { selectedRelationId: state.selectedRelationId || null };

    const activeView = state.views?.find(v => v.id === state.activeViewId);
    if (!activeView) return { selectedRelationId: state.selectedRelationId || null };

    const posOf = (id: ElementId) => activeView.nodes.find(n => n.conceptId === id);
    const currentPos = posOf(currentId);
    if (!currentPos) return { selectedRelationId: state.selectedRelationId || null };

    const connectedEdges = state.relations.filter(r =>
      r.sourceConceptId === currentId || r.targetConceptId === currentId
    );
    if (connectedEdges.length === 0) return { selectedRelationId: state.selectedRelationId || null };

    const neighborData = connectedEdges.map(edge => {
      const neighborId = edge.sourceConceptId === currentId ? edge.targetConceptId : edge.sourceConceptId;
      const neighborPos = posOf(neighborId);
      return { edge, neighborPos };
    }).filter(d => !!d.neighborPos);

    let candidates = neighborData;
    if (direction === 'up') candidates = candidates.filter(d => d.neighborPos!.y < currentPos.y);
    if (direction === 'down') candidates = candidates.filter(d => d.neighborPos!.y > currentPos.y);
    if (direction === 'left') candidates = candidates.filter(d => d.neighborPos!.x < currentPos.x);
    if (direction === 'right') candidates = candidates.filter(d => d.neighborPos!.x > currentPos.x);

    if (candidates.length === 0) return { selectedRelationId: state.selectedRelationId || null };

    const scored = candidates.map(d => {
      const dx = d.neighborPos!.x - currentPos.x;
      const dy = d.neighborPos!.y - currentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let penalty = 1;
      if (direction === 'left' || direction === 'right') {
        penalty = 1 + (Math.abs(dy) / (Math.abs(dx) || 1));
      } else {
        penalty = 1 + (Math.abs(dx) / (Math.abs(dy) || 1));
      }
      return { edgeId: d.edge.id, score: dist * penalty };
    });
    scored.sort((a, b) => a.score - b.score);
    return { selectedRelationId: scored[0].edgeId };
  }

  /**
   * Delete the currently selected element (concept or relation).
   */
  static deleteSelected(state: GraphStateWithSelection): Partial<GraphStateWithSelection> {
    if (state.selectedConceptId) {
      return this.deleteConcept(state, state.selectedConceptId);
    } else if (state.selectedRelationId) {
      return this.deleteRelation(state, state.selectedRelationId);
    }
    return {};
  }

  /**
   * Clear the entire graph (Destructive).
   */
  static clearGraph(): Partial<GraphStateWithSelection> {
    return {
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
      selectedRelationId: null,
    };
  }

  /**
   * Group selected concepts into a new Grouping (bounded_context) concept.
   */
  static groupConcepts(state: GraphStateWithSelection, viewId: ElementId, conceptIds: ElementId[], groupName: string): Partial<GraphStateWithSelection> {
    const view = state.views?.find((v) => v.id === viewId);
    if (!view || conceptIds.length === 0) return {};

    // Generate unique name for the group to avoid clashes
    let uniqueGroupName = groupName;
    let counter = 1;
    while (state.concepts.some(c => c.conceptType === 'bounded_context' && c.name.trim().toLowerCase() === uniqueGroupName.trim().toLowerCase())) {
      uniqueGroupName = `${groupName} ${counter}`;
      counter++;
    }

    // 1. Create the new Grouping concept node (bounded_context)
    const { concept: groupConcept, nextState: addConceptState } = this.addConcept(state, 'bounded_context', uniqueGroupName);

    // Calculate the bounding box of selected nodes in the view to place the group container
    const viewNodes = view.nodes.filter((n) => conceptIds.includes(n.conceptId));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const defaultW = view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200;
    const defaultH = view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80;

    viewNodes.forEach((vn) => {
      minX = Math.min(minX, vn.x);
      minY = Math.min(minY, vn.y);
      const w = vn.width ?? defaultW;
      const h = vn.height ?? defaultH;
      maxX = Math.max(maxX, vn.x + w);
      maxY = Math.max(maxY, vn.y + h);
    });

    const padding = 40;
    const groupX = minX === Infinity ? 100 : minX - padding;
    const groupY = minY === Infinity ? 100 : minY - padding;
    const groupW = minX === Infinity ? 240 : (maxX - minX) + padding * 2;
    const groupH = minY === Infinity ? 140 : (maxY - minY) + padding * 2 + 30;

    // 2. Create the ViewNode for the group
    const groupViewNode = {
      conceptId: groupConcept.id,
      x: groupX,
      y: groupY,
      width: groupW,
      height: groupH,
      manualX: groupX,
      manualY: groupY,
    };

    // 3. Set parentId for selected child nodes to the new group node's id
    const nextViews = state.views?.map((v) => {
      if (v.id !== viewId) return v;
      return {
        ...v,
        nodes: [
          ...v.nodes.map((n) =>
            conceptIds.includes(n.conceptId) ? { ...n, parentId: groupConcept.id } : n
          ),
          groupViewNode,
        ],
      };
    });

    return {
      concepts: addConceptState.concepts || state.concepts,
      views: nextViews,
      selectedConceptId: groupConcept.id,
    };
  }

  /**
   * Ungroup a concept (remove parentId in the view).
   */
  static ungroupConcept(state: GraphStateWithSelection, viewId: ElementId, conceptId: ElementId): Partial<GraphStateWithSelection> {
    const nextViews = state.views?.map((v) => {
      if (v.id !== viewId) return v;
      return {
        ...v,
        nodes: v.nodes.map((n) =>
          n.conceptId === conceptId ? { ...n, parentId: undefined } : n
        ),
      };
    });
    return { views: nextViews };
  }

  /**
   * Dissolve a group, deleting the grouping concept and promoting nested nodes to top-level.
   */
  static dissolveGroup(state: GraphStateWithSelection, viewId: ElementId, groupId: ElementId): Partial<GraphStateWithSelection> {
    const nextViews = state.views?.map((v) => {
      if (v.id !== viewId) return v;
      return {
        ...v,
        nodes: v.nodes
          .filter((n) => n.conceptId !== groupId)
          .map((n) => (n.parentId === groupId ? { ...n, parentId: undefined } : n)),
      };
    });

    const nextConcepts = state.concepts.filter((c) => c.id !== groupId);
    const nextRelations = state.relations.filter(
      (r) => r.sourceConceptId !== groupId && r.targetConceptId !== groupId
    );

    return {
      concepts: nextConcepts,
      relations: nextRelations,
      views: nextViews,
      selectedConceptId: state.selectedConceptId === groupId ? null : state.selectedConceptId,
    };
  }

  /**
   * Update a ViewNode's parentId in the active view.
   */
  static updateViewNodeParentId(state: GraphStateWithSelection, viewId: ElementId, conceptId: ElementId, parentId: ElementId | undefined): Partial<GraphStateWithSelection> {
    const nextViews = state.views?.map((v) => {
      if (v.id !== viewId) return v;
      return {
        ...v,
        nodes: v.nodes.map((n) =>
          n.conceptId === conceptId ? { ...n, parentId } : n
        ),
      };
    });
    return { views: nextViews };
  }

  /**
   * Determine the virtual type of a concept.
   */
  static getVirtualType(concept: ConceptNode, views: View[] = []): 'conceptual_class' | 'information_class' | ConceptType {
    if (concept.conceptType !== 'class') return concept.conceptType;
    const isInInformation = views.some(v => v.type === 'information_model' && v.nodes.some(vn => vn.conceptId === concept.id));
    
    const hasProps = 'properties' in concept && Array.isArray(concept.properties) && concept.properties.length > 0;
    if (isInInformation || concept.wasDerivedFrom || hasProps) {
      return 'information_class';
    }
    return 'conceptual_class';
  }
}
