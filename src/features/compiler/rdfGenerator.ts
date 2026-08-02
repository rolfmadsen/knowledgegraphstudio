import { type ConceptNode, type ConceptRelation, type ConceptProperty, type View } from '../../schema/graphSchema';

function toPascalCase(str: string): string {
  return str
    .replace(/æ/g, 'Ae')
    .replace(/ø/g, 'Oe')
    .replace(/å/g, 'Aa')
    .replace(/Æ/g, 'Ae')
    .replace(/Ø/g, 'Oe')
    .replace(/Å/g, 'Aa')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  if (!pascal) return 'property';
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function mapXsdDataType(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === 'number' || t === 'decimal' || t === 'float') return 'xsd:decimal';
  if (t === 'integer' || t === 'int') return 'xsd:integer';
  if (t === 'boolean' || t === 'bool') return 'xsd:boolean';
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'xsd:date';
  return 'xsd:string';
}

export function generateRDF(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: string | null
): string {
  let turtle = '';

  // 1. Standard W3C Prefixes
  turtle += `@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
  turtle += `@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .\n`;
  turtle += `@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .\n`;
  turtle += `@prefix owl:     <http://www.w3.org/2002/07/owl#> .\n`;
  turtle += `@prefix prov:    <http://www.w3.org/ns/prov#> .\n`;
  turtle += `@prefix dcterms: <http://purl.org/dc/terms/> .\n`;
  turtle += `@prefix adms:    <http://www.w3.org/ns/adms#> .\n`;
  turtle += `@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .\n`;
  turtle += `@prefix begreb:  <http://voresvirksomhed.dk/begreb/> .\n`;
  turtle += `@prefix info:    <http://voresvirksomhed.dk/info/> .\n\n`;

  // 2. ConceptScheme (Begrebskatalog)
  turtle += `# =========================================================================\n`;
  turtle += `# 1. Begrebsmodellen (SKOS Forretningsordbog)\n`;
  turtle += `# =========================================================================\n\n`;

  turtle += `begreb:Katalog\n`;
  turtle += `    rdf:type skos:ConceptScheme ;\n`;
  turtle += `    rdfs:label "Forretningsordbog"@da ;\n`;
  turtle += `    skos:definition "Virksomhedens officielle begreber og terminologi"@da .\n\n`;

  // Filter concepts if active view is provided
  let filteredConcepts = concepts;
  if (activeViewId && views) {
    const activeView = views.find((v) => v.id === activeViewId);
    if (activeView && activeView.nodes) {
      const viewConceptIds = new Set(activeView.nodes.map((n) => n.conceptId));
      filteredConcepts = concepts.filter((c) => viewConceptIds.has(c.id));
    }
  }

  // Map Concepts -> SKOS Concepts
  filteredConcepts.forEach((c) => {
    const slug = toPascalCase(c.name) || `Begreb_${c.id}`;
    turtle += `begreb:${slug}\n`;
    turtle += `    rdf:type skos:Concept ;\n`;
    turtle += `    skos:inScheme begreb:Katalog ;\n`;
    turtle += `    skos:prefLabel "${c.name}"@da`;

    // Synonyms / Aliases -> skos:altLabel
    const aliases = c.aliases || (c as any).synonyms || [];
    if (aliases.length > 0) {
      const altLabels = aliases.map((s: string) => `"${s}"@da`).join(', ');
      turtle += ` ;\n    skos:altLabel ${altLabels}`;
    }

    // Definition -> skos:definition
    if (c.definition) {
      const cleanDef = c.definition.replace(/"/g, '\\"');
      turtle += ` ;\n    skos:definition "${cleanDef}"@da`;
    }

    // Status -> adms:status
    const statusVal = c.lifecycleState || (c as any).status || 'proposed';
    const statusLabel = statusVal === 'active' || (statusVal as string) === 'approved' ? 'Godkendt' : statusVal === 'deprecated' ? 'Udfaset' : 'Udkast';
    turtle += ` ;\n    adms:status "${statusLabel}"@da`;

    turtle += ` .\n\n`;
  });

  // 3. OWL Informationsmodel (IT Classes & Attributes)
  turtle += `# =========================================================================\n`;
  turtle += `# 2. Informationsmodellen (OWL Datastrukturer & Data Lineage)\n`;
  turtle += `# =========================================================================\n\n`;

  filteredConcepts.forEach((c) => {
    const slug = toPascalCase(c.name) || `Class_${c.id}`;
    turtle += `info:${slug}\n`;
    turtle += `    rdf:type owl:Class ;\n`;
    turtle += `    rdfs:label "${c.name}" ;\n`;
    turtle += `    prov:wasDerivedFrom begreb:${slug} .\n\n`;

    // Datatype properties
    if ('properties' in c && c.properties && c.properties.length > 0) {
      c.properties.forEach((p: ConceptProperty) => {
        const propSlug = toCamelCase(p.name);
        const xsdType = mapXsdDataType(String(p.type));

        turtle += `info:${propSlug}\n`;
        turtle += `    rdf:type owl:DatatypeProperty ;\n`;
        turtle += `    rdfs:label "${p.name}" ;\n`;
        turtle += `    rdfs:domain info:${slug} ;\n`;
        turtle += `    rdfs:range ${xsdType} ;\n`;
        turtle += `    prov:wasDerivedFrom begreb:${slug} .\n\n`;
      });
    }
  });

  // 4. Object Properties (Relations)
  if (relations.length > 0) {
    turtle += `# =========================================================================\n`;
    turtle += `# 3. Domænerelationer (OWL Object Properties)\n`;
    turtle += `# =========================================================================\n\n`;

    relations.forEach((rel) => {
      const srcConcept = concepts.find((c) => c.id === rel.sourceConceptId);
      const tgtConcept = concepts.find((c) => c.id === rel.targetConceptId);

      if (srcConcept && tgtConcept) {
        const srcSlug = toPascalCase(srcConcept.name);
        const tgtSlug = toPascalCase(tgtConcept.name);
        const relSlug = toCamelCase(rel.name || 'relatesTo');

        turtle += `info:${relSlug}\n`;
        turtle += `    rdf:type owl:ObjectProperty ;\n`;
        turtle += `    rdfs:label "${rel.name || 'relatesTo'}" ;\n`;
        turtle += `    rdfs:domain info:${srcSlug} ;\n`;
        turtle += `    rdfs:range info:${tgtSlug} .\n\n`;
      }
    });
  }

  return turtle;
}

export default generateRDF;
