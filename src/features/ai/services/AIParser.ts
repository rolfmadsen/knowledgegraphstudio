import { type ElementId, type ConceptType } from '../../../schema/graphSchema';
import { useGraphStore } from '../../../store/useGraphStore';
import { type ProposedCommandInput } from '../store/useAIStore';

// ============================================================
// Types & Constants
// ============================================================

export interface PatternIntent {
  type: 'state_change' | 'state_view' | 'automation' | 'translation';
  screen?: string;
  command?: string;
  events?: string[];
  inputEvents?: string[];
  readModel?: string;
  automation?: string;
  outputEvents?: string[];
}

const VALID_CONCEPT_TYPES = [
  'domain', 'capability', 'bounded_context', 'entity', 'process', 'event', 'system', 'actor', 'other',
  'business_role', 'business_function', 'business_service', 'application_service', 'application_component',
  'business_object', 'node', 'artifact', 'requirement', 'goal',
  'resource', 'course_of_action', 'value_stream',
  'business_collaboration', 'business_interface', 'business_interaction', 'contract', 'representation', 'product',
  'application_collaboration', 'application_event', 'application_function', 'application_interaction', 'application_interface', 'application_process',
  'device', 'system_software', 'technology_collaboration', 'technology_interface', 'technology_function', 'technology_process', 'technology_interaction', 'technology_event', 'technology_service', 'communication_network', 'path', 'equipment', 'facility', 'distribution_network', 'material',
  'stakeholder', 'driver', 'assessment', 'outcome', 'principle', 'constraint', 'value', 'meaning',
  'work_package', 'deliverable', 'plateau', 'gap', 'implementation_event',
  'location', 'junction',
  'class', 'datatype', 'enumeration',
  'screen', 'command', 'read_model', 'integration_event', 'automation', 'em_chapter', 'em_slice'
];

// ============================================================
// ID Normalization Helpers
// ============================================================

export function normalizeIdForMatching(id: string): string {
  if (typeof id !== 'string') return '';
  return id.toLowerCase().replace(/[-_\s/\\'"\(\)\[\]]+/g, '');
}

export function normalizeConceptType(typeStr: string): ConceptType {
  if (typeof typeStr !== 'string') return 'other' as ConceptType;
  const clean = typeStr.trim().toLowerCase().replace(/[\s-]+/g, '_');
  
  if (VALID_CONCEPT_TYPES.includes(clean)) {
    return clean as ConceptType;
  }
  
  const aliasMap: Record<string, string> = {
    'person': 'actor',
    'user': 'actor',
    'component': 'application_component',
    'software_system': 'system',
    'boundary': 'bounded_context',
    'grouping': 'bounded_context',
    'class_model': 'class',
    'data_type': 'datatype',
  };
  
  if (aliasMap[clean] && VALID_CONCEPT_TYPES.includes(aliasMap[clean])) {
    return aliasMap[clean] as ConceptType;
  }
  
  return 'other' as ConceptType;
}

// ============================================================
// Pattern DSL Parser (Model A)
// ============================================================

export function hasPatternCommands(text: string): boolean {
  return text.toLowerCase().includes('pattern:');
}

export function parsePatternDsl(text: string): PatternIntent[] {
  const patterns: PatternIntent[] = [];
  const lines = text.split(/\r?\n/);
  
  let currentPattern: PatternIntent | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    const patternStartMatch = trimmed.match(/^PATTERN:\s*(.+)/i);
    if (patternStartMatch) {
      if (currentPattern) {
        patterns.push(currentPattern);
      }
      const rawType = patternStartMatch[1].trim().toLowerCase();
      let type: PatternIntent['type'] = 'state_change';
      if (rawType.includes('view')) type = 'state_view';
      else if (rawType.includes('automation')) type = 'automation';
      else if (rawType.includes('translation')) type = 'translation';

      currentPattern = { type };
      continue;
    }

    if (currentPattern) {
      const matchKeyVal = trimmed.match(/^([A-Z_]+):\s*(.+)/i);
      if (matchKeyVal) {
        const key = matchKeyVal[1].toUpperCase();
        const val = matchKeyVal[2].trim();

        if (key === 'SCREEN' || key === 'SKÆRM') {
          currentPattern.screen = val;
        } else if (key === 'COMMAND' || key === 'KOMMANDO') {
          currentPattern.command = val;
        } else if (key === 'EVENTS' || key === 'EVENT' || key === 'OUTPUT_EVENTS') {
          const evs = val.split(',').map(s => s.trim()).filter(Boolean);
          if (key === 'OUTPUT_EVENTS') {
            currentPattern.outputEvents = evs;
          } else if (currentPattern.type === 'automation' || currentPattern.type === 'translation') {
            if (!currentPattern.inputEvents) {
              currentPattern.inputEvents = evs;
            } else {
              currentPattern.outputEvents = evs;
            }
          } else {
            currentPattern.events = evs;
          }
        } else if (key === 'INPUT_EVENTS' || key === 'INPUT_EVENT') {
          currentPattern.inputEvents = val.split(',').map(s => s.trim()).filter(Boolean);
        } else if (key === 'READ_MODEL' || key === 'READMODEL' || key === 'LÆSEMODEL') {
          currentPattern.readModel = val;
        } else if (key === 'AUTOMATION') {
          currentPattern.automation = val;
        }
      }
    }
  }

  if (currentPattern) {
    patterns.push(currentPattern);
  }

  return patterns;
}

export function expandPatterns(patterns: PatternIntent[]): ProposedCommandInput[] {
  const commands: ProposedCommandInput[] = [];
  const now = Date.now();
  let index = 0;

  const nextId = () => `proposal-${now}-${index++}-${Math.random().toString(36).substring(2, 9)}`;

  const graphStore = useGraphStore.getState();
  const activeChapter = graphStore.concepts.find(c => c.conceptType === 'em_chapter');
  const activeChapterId = activeChapter ? activeChapter.id : undefined;

  patterns.forEach((pattern) => {
    const sliceName = pattern.command 
      ? `Slice ${pattern.command}` 
      : pattern.readModel 
      ? `Slice ${pattern.readModel}` 
      : `Slice ${pattern.type}`;
      
    const sliceSlug = `em_slice:${sliceName.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
    
    commands.push({
      id: nextId(),
      action: 'addConcept',
      conceptType: 'em_slice',
      name: sliceName
    });

    if (activeChapterId) {
      commands.push({
        id: nextId(),
        action: 'setParent',
        conceptId: sliceSlug as ElementId,
        parentConceptId: activeChapterId
      });
    }

    const createdConceptIds: string[] = [];

    const getOrAddConcept = (type: string, name: string): string => {
      const slug = `${type}:${name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
      const existing = graphStore.concepts.find(c => c.id === slug || normalizeIdForMatching(c.id) === normalizeIdForMatching(slug));
      if (existing) {
        return existing.id;
      }
      
      const proposed = commands.find(c => c.action === 'addConcept' && c.conceptType === type && c.name === name);
      if (proposed) {
        return slug;
      }

      commands.push({
        id: nextId(),
        action: 'addConcept',
        conceptType: type as any,
        name: name
      });
      createdConceptIds.push(slug);
      return slug;
    };

    if (pattern.type === 'state_change') {
      if (pattern.screen && pattern.command) {
        const screenId = getOrAddConcept('screen', pattern.screen);
        const commandId = getOrAddConcept('command', pattern.command);
        
        commands.push({
          id: nextId(),
          action: 'addRelation',
          sourceConceptId: screenId as ElementId,
          targetConceptId: commandId as ElementId,
          name: 'invokes',
          relationType: 'association'
        });

        if (pattern.events && pattern.events.length > 0) {
          pattern.events.forEach((ev) => {
            const eventId = getOrAddConcept('event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: commandId as ElementId,
              targetConceptId: eventId as ElementId,
              name: 'triggers',
              relationType: 'association'
            });
          });
        }
      }
    } else if (pattern.type === 'state_view') {
      if (pattern.readModel && pattern.screen) {
        const readModelId = getOrAddConcept('read_model', pattern.readModel);
        const screenId = getOrAddConcept('screen', pattern.screen);

        commands.push({
          id: nextId(),
          action: 'addRelation',
          sourceConceptId: readModelId as ElementId,
          targetConceptId: screenId as ElementId,
          name: 'displays',
          relationType: 'association'
        });

        if (pattern.events && pattern.events.length > 0) {
          pattern.events.forEach((ev) => {
            const eventId = getOrAddConcept('event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: eventId as ElementId,
              targetConceptId: readModelId as ElementId,
              name: 'feeds',
              relationType: 'association'
            });
          });
        }
      }
    } else if (pattern.type === 'automation') {
      if (pattern.readModel && pattern.automation && pattern.command) {
        const readModelId = getOrAddConcept('read_model', pattern.readModel);
        const automationId = getOrAddConcept('automation', pattern.automation);
        const commandId = getOrAddConcept('command', pattern.command);

        commands.push({
          id: nextId(),
          action: 'addRelation',
          sourceConceptId: readModelId as ElementId,
          targetConceptId: automationId as ElementId,
          name: 'triggers',
          relationType: 'association'
        });

        commands.push({
          id: nextId(),
          action: 'addRelation',
          sourceConceptId: automationId as ElementId,
          targetConceptId: commandId as ElementId,
          name: 'invokes',
          relationType: 'association'
        });

        if (pattern.inputEvents && pattern.inputEvents.length > 0) {
          pattern.inputEvents.forEach((ev) => {
            const eventId = getOrAddConcept('event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: eventId as ElementId,
              targetConceptId: readModelId as ElementId,
              name: 'feeds',
              relationType: 'association'
            });
          });
        }

        if (pattern.outputEvents && pattern.outputEvents.length > 0) {
          pattern.outputEvents.forEach((ev) => {
            const eventId = getOrAddConcept('event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: commandId as ElementId,
              targetConceptId: eventId as ElementId,
              name: 'triggers',
              relationType: 'association'
            });
          });
        }
      }
    } else if (pattern.type === 'translation') {
      if (pattern.automation && pattern.command) {
        const automationId = getOrAddConcept('automation', pattern.automation);
        const commandId = getOrAddConcept('command', pattern.command);

        commands.push({
          id: nextId(),
          action: 'addRelation',
          sourceConceptId: automationId as ElementId,
          targetConceptId: commandId as ElementId,
          name: 'invokes',
          relationType: 'association'
        });

        if (pattern.inputEvents && pattern.inputEvents.length > 0) {
          pattern.inputEvents.forEach((ev) => {
            const eventId = getOrAddConcept('integration_event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: eventId as ElementId,
              targetConceptId: automationId as ElementId,
              name: 'triggers',
              relationType: 'association'
            });
          });
        }

        if (pattern.outputEvents && pattern.outputEvents.length > 0) {
          pattern.outputEvents.forEach((ev) => {
            const eventId = getOrAddConcept('integration_event', ev);
            commands.push({
              id: nextId(),
              action: 'addRelation',
              sourceConceptId: commandId as ElementId,
              targetConceptId: eventId as ElementId,
              name: 'triggers',
              relationType: 'association'
            });
          });
        }
      }
    }

    createdConceptIds.forEach((cid) => {
      commands.push({
        id: nextId(),
        action: 'setParent',
        conceptId: cid as ElementId,
        parentConceptId: sliceSlug as ElementId
      });
    });
  });

  return commands;
}

// ============================================================
// DSL Command Parser
// ============================================================

export function hasDslCommands(text: string): boolean {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(?:CREATE|ADD|CONNECT|LINK|RELATE|NEST|PARENT|GROUP|DELETE|REMOVE|UPDATE|PROPERTY|POLICY)\s/i)) {
      return true;
    }
  }
  return false;
}

export function parseDsl(text: string): ProposedCommandInput[] {
  const commands: ProposedCommandInput[] = [];
  const lines = text.split(/\r?\n/);
  const now = Date.now();
  let index = 0;

  const nextId = () => `proposal-${now}-${index++}-${Math.random().toString(36).substring(2, 9)}`;

  let activePolicy: { name: string; conceptId: string; steps: string[] } | null = null;

  const flushActivePolicy = () => {
    if (activePolicy) {
      const graphStore = useGraphStore.getState();
      const existing = graphStore.concepts.find(c => c.id === activePolicy!.conceptId || normalizeIdForMatching(c.id) === normalizeIdForMatching(activePolicy!.conceptId));
      
      const prevPolicies = existing?.policies || [];
      const updatedPolicies = [
        ...prevPolicies.filter(p => p.name !== activePolicy!.name),
        {
          id: `policy:${activePolicy!.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}-${Date.now()}` as ElementId,
          name: activePolicy!.name,
          type: 'gherkin' as const,
          steps: activePolicy!.steps,
          createdAt: now,
          updatedAt: now,
          lifecycleState: 'active' as const
        }
      ];

      commands.push({
        id: nextId(),
        action: 'updateConcept',
        conceptId: (existing?.id || activePolicy!.conceptId) as ElementId,
        updates: {
          policies: updatedPolicies
        } as any,
        before: {
          name: existing?.name || '',
          conceptType: existing?.conceptType || 'other',
          definition: existing?.definition,
          policies: prevPolicies
        } as any
      });
      activePolicy = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    // Parse BDD steps if active policy block exists
    if (activePolicy) {
      if (trimmed.match(/^(?:GIVEN|WHEN|THEN|AND|BUT)\s/i)) {
        activePolicy.steps.push(trimmed);
        continue;
      } else {
        flushActivePolicy();
      }
    }

    const policyStartMatch = trimmed.match(/^POLICY\s+(?:"([^"]+)"|(\S+))\s+ON\s+(\S+)/i);
    if (policyStartMatch) {
      const policyName = policyStartMatch[1] || policyStartMatch[2];
      const conceptId = policyStartMatch[3];
      activePolicy = {
        name: policyName,
        conceptId: conceptId,
        steps: []
      };
      continue;
    }

    const createMatch = trimmed.match(/^CREATE\s+(\w+)\s+(?:"([^"]+)"|(\S+))/i);
    if (createMatch) {
      const nameVal = createMatch[2] || createMatch[3];
      commands.push({
        id: nextId(),
        action: 'addConcept',
        conceptType: normalizeConceptType(createMatch[1]),
        name: nameVal
      });
      continue;
    }

    const connectMatch = trimmed.match(/^(?:CONNECT|LINK|RELATE)\s+(\S+)\s+(?:->|➔|->)\s+(\S+)(?:\s*\|\s*(.*))?/i);
    if (connectMatch) {
      const sourceConceptId = connectMatch[1];
      const targetConceptId = connectMatch[2];
      const meta = connectMatch[3] || '';
      
      let relationType: string | undefined = undefined;
      let relationName: string = '';

      const segments = meta.split('|');
      segments.forEach((seg) => {
        const parts = seg.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          const val = parts.slice(1).join(':').trim();
          if (key === 'type') {
            relationType = val;
          } else if (key === 'name' || key === 'label') {
            relationName = val;
          }
        }
      });

      if (!relationName) {
        relationName = relationType || 'association';
      }

      commands.push({
        id: nextId(),
        action: 'addRelation',
        sourceConceptId: sourceConceptId as ElementId,
        targetConceptId: targetConceptId as ElementId,
        name: relationName,
        relationType: relationType
      });
      continue;
    }

    const nestMatch = trimmed.match(/^(?:NEST|PARENT|GROUP)\s+(\S+)\s+IN\s+(\S+)/i);
    if (nestMatch) {
      commands.push({
        id: nextId(),
        action: 'setParent',
        conceptId: nestMatch[1] as ElementId,
        parentConceptId: nestMatch[2] as ElementId
      });
      continue;
    }

    const deleteMatch = trimmed.match(/^(?:DELETE|REMOVE)\s+(\S+)/i);
    if (deleteMatch) {
      const isRel = deleteMatch[1].startsWith('relation') || deleteMatch[1].startsWith('other:rel');
      commands.push({
        id: nextId(),
        action: 'deleteElement',
        elementId: deleteMatch[1] as ElementId,
        elementType: isRel ? 'relation' : 'concept',
        elementName: ''
      });
      continue;
    }

    const updateMatch = trimmed.match(/^UPDATE\s+(\S+)\s+SET\s+(\w+)\s*=\s*(?:"([^"]+)"|(.+))/i);
    if (updateMatch) {
      const conceptId = updateMatch[1];
      const key = updateMatch[2];
      const val = (updateMatch[3] || updateMatch[4] || '').trim();
      const graphStore = useGraphStore.getState();
      const existing = graphStore.concepts.find(c => c.id === conceptId || normalizeIdForMatching(c.id) === normalizeIdForMatching(conceptId));
      commands.push({
        id: nextId(),
        action: 'updateConcept',
        conceptId: conceptId as ElementId,
        updates: {
          [key]: val
        },
        before: {
          name: existing?.name || '',
          conceptType: existing?.conceptType || 'other',
          definition: existing?.definition,
        }
      });
      continue;
    }

    const propertyMatch = trimmed.match(/^PROPERTY\s+(\S+)\s+ADD\s+(\w+)\s+AS\s+(\w+)/i);
    if (propertyMatch) {
      commands.push({
        id: nextId(),
        action: 'addProperty',
        conceptId: propertyMatch[1] as ElementId,
        propertyName: propertyMatch[2],
        propertyType: propertyMatch[3]
      });
      continue;
    }
  }

  flushActivePolicy();

  return commands;
}

// ============================================================
// JSON Command Parser Helpers
// ============================================================

export function extractJsonBlocks(text: string): string[] {
  const regex = /```(?:json|JSON|javascript|js|text)?([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const block = match[1].trim();
    if (block) {
      blocks.push(block);
    }
  }

  if (blocks.length === 0) {
    const unclosedMatch = text.match(/```(?:json|JSON|javascript|js|text)?\s*([\s\S]*)$/i);
    if (unclosedMatch) {
      const block = unclosedMatch[1].trim();
      if (block) {
        blocks.push(block);
      }
    }
  }

  if (blocks.length === 0) {
    const startObj = text.indexOf('{');
    const startArr = text.indexOf('[');
    
    let found = false;
    if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
      const endArr = text.lastIndexOf(']');
      if (endArr !== -1) {
        const potentialJson = text.substring(startArr, endArr + 1);
        if (potentialJson.includes('{') || potentialJson.includes('"')) {
          blocks.push(potentialJson);
          found = true;
        }
      }
    }
    
    if (!found && startObj !== -1) {
      const endObj = text.lastIndexOf('}');
      if (endObj !== -1) {
        blocks.push(text.substring(startObj, endObj + 1));
      }
    }
  }

  return blocks;
}

export function repairJson(str: string): string {
  let repaired = str.trim();
  repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
  repaired = repaired.replace(/\/\/.*/g, '');
  repaired = repaired.replace(/(?<=[{\s,])'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*:)/g, '"$1"');
  repaired = repaired.replace(/(?<=:\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,}\]])/g, '"$1"');
  repaired = repaired.replace(/(?<=[\[\s,])'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,\]])/g, '"$1"');
  repaired = repaired.replace(/(?<=[{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":');
  repaired = repaired.replace(/,\s*(?=[}\]])/g, '');
  return repaired;
}

export function normalizeCommand(cmd: any): any {
  if (!cmd || typeof cmd !== 'object') return cmd;
  const normalized = { ...cmd };
  const rawAction = typeof normalized.action === 'string' ? normalized.action.toUpperCase() : '';

  if (rawAction === 'CREATE_NODE' || rawAction === 'ADD_CONCEPT' || rawAction === 'ADDCONCEPT') {
    normalized.action = 'addConcept';
    normalized.conceptType = normalizeConceptType(normalized.type || normalized.conceptType);
    normalized.name = normalized.label || normalized.name || normalized.id;
  } else if (rawAction === 'CREATE_RELATION' || rawAction === 'ADD_RELATION' || rawAction === 'ADDRELATION') {
    normalized.action = 'addRelation';
    normalized.sourceConceptId = normalized.sourceId || normalized.source || normalized.from || normalized.sourceConceptId;
    normalized.targetConceptId = normalized.targetId || normalized.target || normalized.to || normalized.targetConceptId;
    normalized.relationType = normalized.type || normalized.relationType;
    normalized.name = normalized.label || normalized.name || normalized.type || normalized.relationType || 'association';
  } else if (rawAction === 'SET_PARENT' || rawAction === 'SETPARENT') {
    normalized.action = 'setParent';
    normalized.conceptId = normalized.childId || normalized.child || normalized.conceptId;
    normalized.parentConceptId = normalized.parentId || normalized.parent || normalized.parentConceptId;
  } else if (rawAction === 'DELETE_ELEMENT' || rawAction === 'DELETEELEMENT' || rawAction === 'DELETECONCEPT' || rawAction === 'DELETERELATION') {
    normalized.action = 'deleteElement';
    normalized.elementId = normalized.id || normalized.deleteId || normalized.elementId;
    normalized.elementType = normalized.elementType || normalized.type || (normalized.elementId?.includes('relation') ? 'relation' : 'concept');
  } else if (rawAction === 'UPDATE_CONCEPT' || rawAction === 'UPDATECONCEPT' || rawAction === 'RENAMECONCEPT' || rawAction === 'EDITCONCEPT') {
    normalized.action = 'updateConcept';
    normalized.conceptId = normalized.conceptId || normalized.id || normalized.conceptId;
    normalized.updates = normalized.updates || {};
    if (normalized.name && !normalized.updates.name) {
      normalized.updates.name = normalized.name;
    }
    if (normalized.definition && !normalized.updates.definition) {
      normalized.updates.definition = normalized.definition;
    }
  } else if (rawAction === 'ADD_PROPERTY' || rawAction === 'ADDPROPERTY') {
    normalized.action = 'addProperty';
    normalized.conceptId = normalized.id || normalized.conceptId;
    normalized.propertyName = normalized.propertyName || normalized.name;
    normalized.propertyType = normalized.propertyType || normalized.type || 'string';
  }

  if (normalized.type && !normalized.action) {
    const typeUpper = typeof normalized.type === 'string' ? normalized.type.toUpperCase() : '';
    if (['ADDCONCEPT', 'ADD_CONCEPT', 'CREATE_NODE'].includes(typeUpper)) {
      normalized.action = 'addConcept';
    } else if (['ADDRELATION', 'ADD_RELATION', 'CREATE_RELATION'].includes(typeUpper)) {
      normalized.action = 'addRelation';
    } else if (['SETPARENT', 'SET_PARENT'].includes(typeUpper)) {
      normalized.action = 'setParent';
    } else if (['DELETEELEMENT', 'DELETE_ELEMENT', 'DELETECONCEPT', 'DELETERELATION'].includes(typeUpper)) {
      normalized.action = 'deleteElement';
    } else if (['UPDATECONCEPT', 'UPDATE_CONCEPT', 'RENAMECONCEPT', 'EDITCONCEPT'].includes(typeUpper)) {
      normalized.action = 'updateConcept';
    } else if (['ADDPROPERTY', 'ADD_PROPERTY'].includes(typeUpper)) {
      normalized.action = 'addProperty';
    }

    if (normalized.conceptType && normalized.name) {
      normalized.action = 'addConcept';
    } else if (normalized.sourceConceptId && normalized.targetConceptId && normalized.name) {
      normalized.action = 'addRelation';
    }
  }

  if (normalized.action === 'addConcept' && normalized.conceptType) {
    normalized.conceptType = normalizeConceptType(normalized.conceptType);
  }

  if (normalized.action === 'addProperty') {
    if (normalized.type && !normalized.propertyType) {
      normalized.propertyType = normalized.type;
    }
  }

  return normalized;
}

export function parseProposedCommands(text: string): ProposedCommandInput[] {
  if (hasPatternCommands(text)) {
    try {
      const intents = parsePatternDsl(text);
      const expanded = expandPatterns(intents);
      if (expanded.length > 0) {
        return expanded;
      }
    } catch (e) {
      console.warn('[AIParser] Failed to parse Pattern DSL, falling back:', e);
    }
  }

  if (hasDslCommands(text)) {
    try {
      const dslCommands = parseDsl(text);
      if (dslCommands.length > 0) {
        return dslCommands;
      }
    } catch (e) {
      console.warn('[AIParser] Failed to parse DSL, falling back to JSON:', e);
    }
  }

  const blocks = extractJsonBlocks(text);
  const allProposals: ProposedCommandInput[] = [];

  const parseItem = (cmd: any, index: number): ProposedCommandInput[] => {
    if (!cmd || typeof cmd !== 'object') return [];

    const normalized = normalizeCommand(cmd);
    const id = `proposal-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;
    const results: ProposedCommandInput[] = [];

    let action = normalized.action;
    if (!action) {
      if (normalized.conceptType && normalized.name) {
        action = 'addConcept';
      } else if (normalized.sourceConceptId && normalized.targetConceptId && normalized.name) {
        action = 'addRelation';
      } else if (normalized.conceptId && normalized.parentConceptId) {
        action = 'setParent';
      } else if (normalized.elementId && normalized.elementType) {
        action = 'deleteElement';
      } else if (normalized.conceptId && normalized.updates) {
        action = 'updateConcept';
      } else if (normalized.conceptId && normalized.propertyName && normalized.propertyType) {
        action = 'addProperty';
      }
    }

    if (action === 'addConcept' && normalized.conceptType && normalized.name) {
      const conceptCmd: ProposedCommandInput = {
        id,
        action: 'addConcept',
        conceptType: normalized.conceptType,
        name: normalized.name,
      };
      results.push(conceptCmd);

      const parentId = normalized.parentId || normalized.parentConceptId;
      if (parentId) {
        const slug = `${normalized.conceptType}:${normalized.name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
        results.push({
          id: `${id}-parent`,
          action: 'setParent',
          conceptId: (normalized.id || slug) as ElementId,
          parentConceptId: parentId as ElementId,
        });
      }
    } else if (action === 'addRelation' && normalized.sourceConceptId && normalized.targetConceptId && normalized.name) {
      results.push({
        id,
        action: 'addRelation',
        sourceConceptId: normalized.sourceConceptId,
        targetConceptId: normalized.targetConceptId,
        name: normalized.name,
        relationType: normalized.relationType,
      });
    } else if (action === 'setParent' && normalized.conceptId && normalized.parentConceptId) {
      results.push({
        id,
        action: 'setParent',
        conceptId: normalized.conceptId,
        parentConceptId: normalized.parentConceptId,
      });
    } else if (action === 'deleteElement' && normalized.elementId) {
      const elType = normalized.elementType || (normalized.elementId.includes('relation') ? 'relation' : 'concept');
      const graphStore = useGraphStore.getState();
      let elName = '';
      if (elType === 'concept') {
        const resolveId = (aiId: string): string => {
          const slugMatch = graphStore.concepts.find((c) => {
            const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
            return slug === aiId;
          });
          if (slugMatch) return slugMatch.id;
          return aiId;
        };
        const existing = graphStore.concepts.find((c) => c.id === resolveId(normalized.elementId));
        elName = existing?.name || normalized.elementName || normalized.elementId;
      } else {
        const existing = graphStore.relations.find((r) => r.id === normalized.elementId);
        elName = existing?.name || normalized.elementName || 'Relation';
      }
      results.push({
        id,
        action: 'deleteElement',
        elementId: normalized.elementId,
        elementType: elType,
        elementName: elName,
      });
    } else if (action === 'updateConcept' && normalized.conceptId && normalized.updates) {
      const graphStore = useGraphStore.getState();
      const resolveId = (aiId: string): string => {
        const slugMatch = graphStore.concepts.find((c) => {
          const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
          return slug === aiId;
        });
        if (slugMatch) return slugMatch.id;
        return aiId;
      };
      const resolvedId = resolveId(normalized.conceptId);
      const existing = graphStore.concepts.find((c) => c.id === resolvedId);
      results.push({
        id,
        action: 'updateConcept',
        conceptId: normalized.conceptId,
        updates: normalized.updates,
        before: {
          name: existing?.name || '',
          conceptType: existing?.conceptType || 'other',
          definition: existing?.definition,
        },
      });
    } else if (action === 'addProperty' && normalized.conceptId && normalized.propertyName) {
      results.push({
        id,
        action: 'addProperty',
        conceptId: normalized.conceptId,
        propertyName: normalized.propertyName,
        propertyType: normalized.propertyType || 'string',
      });
    }

    return results;
  };

  const tryParseJson = (str: string): any => {
    try {
      return JSON.parse(str);
    } catch (e) {}

    try {
      return JSON.parse(repairJson(str));
    } catch (e) {}

    const startArr = str.indexOf('[');
    const endArr = str.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      const arrContent = str.substring(startArr, endArr + 1);
      try {
        return JSON.parse(arrContent);
      } catch (e) {}
      try {
        return JSON.parse(repairJson(arrContent));
      } catch (e) {}
    }

    const startObj = str.indexOf('{');
    const endObj = str.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
      const objContent = str.substring(startObj, endObj + 1);
      try {
        return JSON.parse(objContent);
      } catch (e) {}
      try {
        return JSON.parse(repairJson(repairJson(objContent)));
      } catch (e) {}
    }

    throw new Error('Not parseable');
  };

  blocks.forEach((jsonStr, blockIdx) => {
    try {
      const parsed = tryParseJson(jsonStr);
      if (parsed) {
        let arr: any[] = [];
        if (Array.isArray(parsed)) {
          arr = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.commands)) {
            arr = parsed.commands;
          } else {
            arr = [parsed];
          }
        }
        const parsedItems = arr
          .flatMap((item, itemIdx) => parseItem(item, blockIdx * 100 + itemIdx))
          .filter((p): p is ProposedCommandInput => p !== null);
        allProposals.push(...parsedItems);
      }
    } catch (e) {}
  });

  return allProposals;
}
