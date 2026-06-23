/**
 * Event Modeling Validator
 *
 * Enforces the strict Event Modeling alphabet connection rules:
 *   Screen   → Command
 *   Command  → DomainEvent (event), IntegrationEvent
 *   DomainEvent → ReadModel, Automation, IntegrationEvent
 *   ReadModel → Screen, Automation, IntegrationEvent
 *   IntegrationEvent → ReadModel, Automation
 *   Automation → Command
 *
 * Note: 'event' ConceptType is reused as DomainEvent in this notation context.
 * em_chapter and em_slice are grouping containers — not valid connection endpoints.
 */

import type { ConceptType } from '../../schema/graphSchema';

// ============================================================
// Valid connection matrix
// ============================================================

const VALID_EM_CONNECTIONS: Partial<Record<string, string[]>> = {
  screen:            ['command'],
  command:           ['event', 'integration_event'],
  event:             ['read_model', 'automation', 'integration_event'],
  read_model:        ['screen', 'automation', 'integration_event'],
  integration_event: ['read_model', 'automation'],
  automation:        ['command'],
};

/**
 * Returns true only if the source→target connection is valid per EM alphabet rules.
 * Containers (em_chapter, em_slice) cannot be source or target of semantic edges.
 */
export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
): boolean {
  const allowed = VALID_EM_CONNECTIONS[sourceType as string];
  if (!allowed) return false;
  return allowed.includes(targetType as string);
}

// ============================================================
// Smart relation label suggestions
// ============================================================

type RelationSuggestion = { id: string; label: string; description: string };

const RELATION_LABELS: Partial<Record<string, Partial<Record<string, RelationSuggestion>>>> = {
  screen: {
    command: {
      id: 'invokes',
      label: 'invokes',
      description: 'A Screen invokes a Command when the user submits intent',
    },
  },
  command: {
    event: {
      id: 'triggers',
      label: 'triggers',
      description: 'A Command triggers a Domain Event — the recorded fact',
    },
    integration_event: {
      id: 'emits',
      label: 'emits',
      description: 'A Command emits an Integration Event to external systems',
    },
  },
  event: {
    read_model: {
      id: 'feeds',
      label: 'feeds',
      description: 'A Domain Event feeds a Read Model (projection)',
    },
    automation: {
      id: 'triggers',
      label: 'triggers',
      description: 'A Domain Event triggers an Automation (saga/policy)',
    },
    integration_event: {
      id: 'emits',
      label: 'emits',
      description: 'A Domain Event emits an Integration Event',
    },
  },
  read_model: {
    screen: {
      id: 'displays',
      label: 'displays',
      description: 'A Read Model displays data on a Screen',
    },
    automation: {
      id: 'triggers',
      label: 'triggers',
      description: 'A Read Model triggers an Automation',
    },
    integration_event: {
      id: 'notifies',
      label: 'notifies',
      description: 'A Read Model notifies external systems via Integration Event',
    },
  },
  integration_event: {
    read_model: {
      id: 'feeds',
      label: 'feeds',
      description: 'An Integration Event feeds a Read Model',
    },
    automation: {
      id: 'triggers',
      label: 'triggers',
      description: 'An Integration Event triggers an Automation',
    },
  },
  automation: {
    command: {
      id: 'automates',
      label: 'automates',
      description: 'An Automation emits a Command (saga/policy effect)',
    },
  },
};

/**
 * Returns a list of suggested relation labels for the given source→target combination.
 * Used by the Relation Builder to pre-fill the relation name.
 */
export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType,
): RelationSuggestion[] {
  const suggestion = RELATION_LABELS[sourceType as string]?.[targetType as string];
  return suggestion ? [suggestion] : [];
}
