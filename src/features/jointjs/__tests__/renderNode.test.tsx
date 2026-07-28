import { describe, it, expect } from 'vitest';
import { renderNodeHTML } from '../renderNode';
import type { ConceptNode } from '../../../schema/graphSchema';

describe('renderNode - Phase 2 Custom Node Renderers', () => {
  it('renders UML class node content HTML', () => {
    const concept: ConceptNode = {
      id: 'class:ordre' as any,
      conceptType: 'class',
      name: 'Ordre',
      aliases: [],
      policies: [],
      definition: 'En kundebestilling',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      properties: [
        {
          id: 'prop:ordrenr' as any,
          name: 'ordrenummer',
          type: 'string',
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
        },
        {
          id: 'prop:total' as any,
          name: 'totalBeloeb',
          type: 'number',
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
        },
      ],
    };

    const html = renderNodeHTML(concept);

    expect(html).toContain('Ordre');
    expect(html).toContain('«class»');
    expect(html).toContain('ordrenummer');
    expect(html).toContain('totalBeloeb');
    expect(html).toContain('string');
    expect(html).toContain('number');
  });

  it('renders Begreb node content HTML', () => {
    const concept: ConceptNode = {
      id: 'domain:studie' as any,
      conceptType: 'bounded_context',
      name: 'Studieadmin',
      aliases: [],
      policies: [],
      definition: 'Begreb for studieadministration',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
    };

    const html = renderNodeHTML(concept);

    expect(html).toContain('Studieadmin');
    expect(html).toContain('«bounded_context»');
    expect(html).toContain('Begreb for studieadministration');
  });
});
