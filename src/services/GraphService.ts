/**
 * GraphService — Internal API for graph mutations (Spec §12)
 *
 * Handles business logic, validation, and orchestration of graph changes.
 * Updates the global store and triggers persistence.
 */
import { useGraphStore } from '../store/useGraphStore';
import { PersistenceService } from './PersistenceService';
import { generateId } from '../core/idGenerator';
import type { 
  ConceptType, 
  ElementId, 
  DataClassification, 
  ConceptNode,
  ConceptRelation,
  Domain
} from '../schema/graphSchema';

export class GraphService {
  /**
   * Create a new domain and add it to the graph.
   */
  static async addDomain(name: string, description?: string): Promise<Domain> {
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
    useGraphStore.setState((state) => ({ domains: [...state.domains, domain] }));
    PersistenceService.scheduleAutoSave();
    return domain;
  }

  /**
   * Update an existing domain.
   */
  static async updateDomain(id: ElementId, updates: Partial<Pick<Domain, 'name' | 'description' | 'lifecycleState'>>): Promise<void> {
    useGraphStore.setState((state) => ({
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
      ),
    }));
    PersistenceService.scheduleAutoSave();
  }

  /**
   * Delete a domain and clear references in concepts.
   */
  static async deleteDomain(id: ElementId): Promise<void> {
    useGraphStore.setState((state) => ({
      domains: state.domains.filter((d) => d.id !== id),
      concepts: state.concepts.map((c) =>
        c.domainId === id ? { ...c, domainId: undefined } : c
      ),
    }));
    PersistenceService.scheduleAutoSave();
  }

  /**
   * Create a new concept and add it to the graph.
   */
  static async addConcept(conceptType: ConceptType, name: string, options: {
    domainId?: ElementId;
    parentId?: ElementId;
    classification?: DataClassification;
    definition?: string;
    aliases?: string[];
  } = {}): Promise<ConceptNode> {
    const id = generateId(conceptType, name);
    const store = useGraphStore.getState();
    
    const now = Date.now();
    const concept: ConceptNode = {
      id,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active',
      conceptType,
      name,
      aliases: options.aliases ?? [],
      definition: options.definition,
      domainId: options.domainId || store.domains[0]?.id,
      parentId: options.parentId,
      classification: options.classification,
      properties: [],
      policies: [],
      fx: null,
      fy: null,
    };

    // Update store
    useGraphStore.setState((state) => ({
      concepts: [...state.concepts, concept],
    }));

    PersistenceService.scheduleAutoSave();
    return concept;
  }

  /**
   * Update an existing concept.
   */
  static async updateConcept(id: ElementId, updates: Partial<Pick<
    ConceptNode,
    'name' | 'definition' | 'aliases' | 'classification' | 'lifecycleState' | 'domainId' | 'parentId' | 'conceptType' | 'x' | 'y'
  >>): Promise<void> {
    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Delete a concept and perform orphan cleanup on relations.
   */
  static async deleteConcept(id: ElementId): Promise<void> {
    useGraphStore.setState((state) => ({
      concepts: state.concepts.filter((c) => c.id !== id),
      // Orphan Cleanup: delete all relations referencing this concept
      relations: state.relations.filter(
        (r) => r.sourceConceptId !== id && r.targetConceptId !== id,
      ),
      selectedConceptId: state.selectedConceptId === id ? null : state.selectedConceptId,
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Create a new relation with smart default naming.
   */
  static async addRelation(sourceId: ElementId, targetId: ElementId, name?: string, options: {
    multiplicity?: string;
    mappingPattern?: ConceptRelation['mappingPattern'];
    transformationDescription?: string;
    isDirected?: boolean;
  } = {}): Promise<ConceptRelation> {
    const state = useGraphStore.getState();
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
      multiplicity: options.multiplicity,
      mappingPattern: options.mappingPattern,
      transformationDescription: options.transformationDescription,
      isDirected: options.isDirected ?? true,
      policies: [],
    };

    useGraphStore.setState((state) => ({
      relations: [...state.relations, relation],
    }));

    PersistenceService.scheduleAutoSave();
    return relation;
  }

  /**
   * Update an existing relation.
   */
  static async updateRelation(id: ElementId, updates: Partial<Pick<
    ConceptRelation, 'name' | 'multiplicity' | 'mappingPattern' | 'transformationDescription' | 'isDirected' | 'sourceConceptId' | 'targetConceptId'
  >>): Promise<void> {
    useGraphStore.setState((state) => ({
      relations: state.relations.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Delete a relation from the graph.
   */
  static async deleteRelation(id: ElementId): Promise<void> {
    useGraphStore.setState((state) => ({
      relations: state.relations.filter((r) => r.id !== id),
      selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Add a property to a concept.
   */
  static async addProperty(conceptId: ElementId, name: string, type: string, isRequired?: boolean): Promise<void> {
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

    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? { ...c, properties: [...c.properties, property], updatedAt: now }
          : c,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Update a property on a concept.
   */
  static async updateProperty(conceptId: ElementId, propertyId: ElementId, updates: any): Promise<void> {
    const now = Date.now();
    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? {
              ...c,
              properties: c.properties.map((p) =>
                p.id === propertyId ? { ...p, ...updates, updatedAt: now } : p,
              ),
              updatedAt: now,
            }
          : c,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Delete a property from a concept.
   */
  static async deleteProperty(conceptId: ElementId, propertyId: ElementId): Promise<void> {
    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? {
              ...c,
              properties: c.properties.filter((p) => p.id !== propertyId),
              updatedAt: Date.now(),
            }
          : c,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Add a policy to a concept.
   */
  static async addPolicy(conceptId: ElementId, policyData: any): Promise<void> {
    const policyId = generateId('other', policyData.name);
    const now = Date.now();
    const policy = {
      ...policyData,
      id: policyId,
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'active' as const,
    };

    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? { ...c, policies: [...c.policies, policy], updatedAt: now }
          : c,
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Update a policy on a concept.
   */
  static async updatePolicy(conceptId: ElementId, policyId: ElementId, updates: any): Promise<void> {
    const now = Date.now();
    useGraphStore.setState((state) => ({
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
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Delete a policy from a concept.
   */
  static async deletePolicy(conceptId: ElementId, policyId: ElementId): Promise<void> {
    useGraphStore.setState((state) => ({
      concepts: state.concepts.map((c) =>
        c.id === conceptId
          ? {
              ...c,
              updatedAt: Date.now(),
              policies: c.policies.filter((p) => p.id !== policyId),
            }
          : c
      ),
    }));

    PersistenceService.scheduleAutoSave();
  }

  /**
   * Quick creation of a relation, optionally creating a new target concept.
   * Part of the Relationship Builder Palette (Spec §12.2)
   */
  static async createQuickRelation(params: {
    sourceId: ElementId;
    targetIdOrName: string;
    isNewTarget: boolean;
    targetType?: ConceptType; // Optional type for new targets
    label: string;
  }): Promise<void> {
    let targetId: ElementId;

    if (params.isNewTarget) {
      // Use provided type or default to 'entity'
      const newConcept = await this.addConcept(params.targetType || 'entity', params.targetIdOrName);
      targetId = newConcept.id;
    } else {
      targetId = params.targetIdOrName;
    }

    // Create the relation
    await this.addRelation(params.sourceId, targetId, params.label);
  }

  /**
   * Clear the entire graph (Destructive).
   */
  static async clearGraph(): Promise<void> {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
      selectedRelationId: null,
    });
    PersistenceService.scheduleAutoSave();
  }
}
