import {
  type ConceptNode,
  type ConceptRelation,
  type ConceptProperty,
  type View,
} from '../../schema/graphSchema';
import { getDerivedFrom } from '../../utils/provenance';

function sanitizeIriIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

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

export interface RdfGeneratorOptions {
  baseIri?: string;
  namespacePrefix?: string;
  language?: string;
}

export function generateRDF(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: string | null,
  options: RdfGeneratorOptions = {}
): string {
  const activeView = views?.find((v) => v.id === activeViewId);
  const viewType = activeView?.type ?? 'information_model';

  let filteredConcepts = concepts;
  if (activeView && activeView.nodes) {
    const viewConceptIds = new Set(activeView.nodes.map((n) => n.conceptId));
    filteredConcepts = concepts.filter((c) => viewConceptIds.has(c.id));
  }

  let filteredRelations = relations;
  if (activeView) {
    const viewEdgeIds = new Set(activeView.edges ?? []);
    const filteredConceptIds = new Set(filteredConcepts.map((c) => c.id));
    filteredRelations = relations.filter(
      (rel) =>
        viewEdgeIds.has(rel.id) ||
        (filteredConceptIds.has(rel.sourceConceptId) && filteredConceptIds.has(rel.targetConceptId))
    );
  }

  if (viewType === 'logical_data_model') {
    return emitLogicalDataModelProfile(filteredConcepts, filteredRelations, activeView, options);
  }

  if (viewType === 'conceptual_model') {
    return emitConceptualModelProfile(filteredConcepts, activeView);
  }

  return emitInformationModelProfile(filteredConcepts, filteredRelations, concepts);
}

// ──────────────────────────────────────────────────────────
// Profile 1: Logical Data Model (v1.0 Exchange Profile, DCAT-AP, SHACL & OWL)
// ──────────────────────────────────────────────────────────
function emitLogicalDataModelProfile(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  activeView?: View,
  options: RdfGeneratorOptions = {}
): string {
  let turtle = '';

  const modelTitle = activeView?.name || 'Logisk Datamodel';
  const baseUri = options.baseIri || 'https://example.dk/model/logical-data-model/';
  const prefix = options.namespacePrefix || 'ldm';
  const elementNamespaceUri = `${baseUri}element/`;

  // Check if any element in export has explicit provenance derivation
  const hasProvenance =
    concepts.some((c) => getDerivedFrom(c).length > 0 || ('properties' in c && c.properties && c.properties.some((p) => getDerivedFrom(p).length > 0))) ||
    relations.some((r) => getDerivedFrom(r).length > 0);

  // Standard Prefixes
  turtle += `@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
  turtle += `@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .\n`;
  turtle += `@prefix owl:     <http://www.w3.org/2002/07/owl#> .\n`;
  turtle += `@prefix sh:      <http://www.w3.org/ns/shacl#> .\n`;
  turtle += `@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .\n`;
  turtle += `@prefix dcat:    <http://www.w3.org/ns/dcat#> .\n`;
  turtle += `@prefix dcterms: <http://purl.org/dc/terms/> .\n`;
  turtle += `@prefix vann:    <http://purl.org/vocab/vann/> .\n`;
  if (hasProvenance) {
    turtle += `@prefix prov:    <http://www.w3.org/ns/prov#> .\n`;
  }
  turtle += `@prefix xar:     <https://xarchi.studio/vocab/rdf-exchange#> .\n`;
  turtle += `@prefix ${prefix}:      <${elementNamespaceUri}> .\n`;
  turtle += `@prefix shapes:   <${baseUri}shape/> .\n\n`;

  // 1. Model-level Resource Metadata
  turtle += `# =========================================================================\n`;
  turtle += `# Logisk datamodel — DCAT- og OWL-metadata (xArchi v1.0 Exchange Profile)\n`;
  turtle += `# =========================================================================\n\n`;

  turtle += `<${baseUri}>\n`;
  turtle += `    a dcat:Dataset, owl:Ontology ;\n`;
  turtle += `    dcterms:type xar:LogicalDataModel ;\n`;
  turtle += `    dcterms:conformsTo xar:RdfExchangeProfile-1.0 ;\n`;
  turtle += `    dcterms:title "${modelTitle}"@da ;\n`;
  turtle += `    dcterms:language "da" ;\n`;
  turtle += `    vann:preferredNamespaceUri "${elementNamespaceUri}"^^xsd:anyURI ;\n`;
  turtle += `    vann:preferredNamespacePrefix "${prefix}" .\n\n`;

  // 2. OWL Classes & Datatype Properties
  turtle += `# =========================================================================\n`;
  turtle += `# Logiske Datastrukturer & Egenskaber (OWL Classes & Datatype Properties)\n`;
  turtle += `# =========================================================================\n\n`;

  concepts.forEach((c) => {
    const classIri = `${prefix}:e_${sanitizeIriIdentifier(c.id)}`;
    turtle += `${classIri}\n`;
    turtle += `    a owl:Class ;\n`;
    turtle += `    dcterms:identifier "${c.id}" ;\n`;
    turtle += `    rdfs:label "${c.name}"@da ;\n`;
    turtle += `    rdfs:isDefinedBy <${baseUri}>`;

    const derived = getDerivedFrom(c);
    if (derived.length > 0) {
      turtle += ` ;\n    prov:wasDerivedFrom <${derived[0]}>`;
    }
    turtle += ` .\n\n`;

    if ('properties' in c && c.properties) {
      c.properties.forEach((p: ConceptProperty) => {
        const propIri = `${prefix}:prop_${sanitizeIriIdentifier(p.id)}`;
        const xsdType = mapXsdDataType(String(p.type));

        turtle += `${propIri}\n`;
        turtle += `    a owl:DatatypeProperty ;\n`;
        turtle += `    dcterms:identifier "${p.id}" ;\n`;
        turtle += `    rdfs:label "${p.name}"@da ;\n`;
        turtle += `    rdfs:domain ${classIri} ;\n`;
        turtle += `    rdfs:range ${xsdType} ;\n`;
        turtle += `    rdfs:isDefinedBy <${baseUri}>`;

        const propDerived = getDerivedFrom(p);
        if (propDerived.length > 0) {
          turtle += ` ;\n    prov:wasDerivedFrom <${propDerived[0]}>`;
        }
        turtle += ` .\n\n`;
      });
    }
  });

  // 3. OWL Object Properties (Relations)
  if (relations.length > 0) {
    turtle += `# =========================================================================\n`;
    turtle += `# Logiske Associationer (OWL Object Properties)\n`;
    turtle += `# =========================================================================\n\n`;

    relations.forEach((rel) => {
      const relIri = `${prefix}:rel_${sanitizeIriIdentifier(rel.id)}`;
      const srcIri = `${prefix}:e_${sanitizeIriIdentifier(rel.sourceConceptId)}`;
      const tgtIri = `${prefix}:e_${sanitizeIriIdentifier(rel.targetConceptId)}`;

      turtle += `${relIri}\n`;
      turtle += `    a owl:ObjectProperty ;\n`;
      turtle += `    dcterms:identifier "${rel.id}" ;\n`;
      turtle += `    rdfs:label "${rel.name || 'relatesTo'}"@da ;\n`;
      turtle += `    rdfs:domain ${srcIri} ;\n`;
      turtle += `    rdfs:range ${tgtIri} ;\n`;
      turtle += `    rdfs:isDefinedBy <${baseUri}>`;

      const relDerived = getDerivedFrom(rel);
      if (relDerived.length > 0) {
        turtle += ` ;\n    prov:wasDerivedFrom <${relDerived[0]}>`;
      }
      turtle += ` .\n\n`;
    });
  }

  // 4. SHACL Shapes (NodeShapes & PropertyShapes)
  turtle += `# =========================================================================\n`;
  turtle += `# SHACL Valideringsformer (NodeShapes & PropertyShapes)\n`;
  turtle += `# =========================================================================\n\n`;

  concepts.forEach((c) => {
    const classIri = `${prefix}:e_${sanitizeIriIdentifier(c.id)}`;
    const shapeIri = `shapes:e_${sanitizeIriIdentifier(c.id)}`;

    turtle += `${shapeIri}\n`;
    turtle += `    a sh:NodeShape ;\n`;
    turtle += `    rdfs:isDefinedBy <${baseUri}> ;\n`;
    turtle += `    sh:targetClass ${classIri} ;\n`;
    turtle += `    sh:name "${c.name} Shape"@da`;

    const propList: string[] = [];

    if ('properties' in c && c.properties) {
      c.properties.forEach((p: ConceptProperty) => {
        propList.push(`shapes:prop_${sanitizeIriIdentifier(p.id)}`);
      });
    }

    const relsForClass = relations.filter((r) => r.sourceConceptId === c.id);
    relsForClass.forEach((r) => {
      propList.push(`shapes:rel_${sanitizeIriIdentifier(r.id)}`);
    });

    if (propList.length > 0) {
      propList.forEach((propShape) => {
        turtle += ` ;\n    sh:property ${propShape}`;
      });
    }

    turtle += ` .\n\n`;

    // PropertyShapes for attributes
    if ('properties' in c && c.properties) {
      c.properties.forEach((p: ConceptProperty) => {
        const propIri = `${prefix}:prop_${sanitizeIriIdentifier(p.id)}`;
        const propShapeIri = `shapes:prop_${sanitizeIriIdentifier(p.id)}`;
        const xsdType = mapXsdDataType(String(p.type));

        let minCount: number | undefined = undefined;
        let maxCount: number | undefined = undefined;

        if (p.isRequired !== undefined) {
          minCount = p.isRequired ? 1 : 0;
        }

        if (p.multiplicity && p.multiplicity.trim() !== '') {
          const parts = p.multiplicity.split('..');
          if (parts.length === 2) {
            const min = parts[0].trim();
            const max = parts[1].trim();
            if (min === '1') minCount = 1;
            if (min === '0') minCount = 0;
            if (max === '1') maxCount = 1;
            if (max === '*') maxCount = undefined;
          } else if (p.multiplicity.trim() === '1') {
            minCount = 1;
            maxCount = 1;
          }
        }

        turtle += `${propShapeIri}\n`;
        turtle += `    a sh:PropertyShape ;\n`;
        turtle += `    rdfs:isDefinedBy <${baseUri}> ;\n`;
        turtle += `    sh:path ${propIri} ;\n`;
        turtle += `    sh:name "${p.name}"@da ;\n`;
        turtle += `    sh:datatype ${xsdType}`;

        if (minCount !== undefined) {
          turtle += ` ;\n    sh:minCount ${minCount}`;
        }
        if (maxCount !== undefined) {
          turtle += ` ;\n    sh:maxCount ${maxCount}`;
        }

        turtle += ` .\n\n`;
      });
    }

    // PropertyShapes for relations
    relsForClass.forEach((rel) => {
      const relIri = `${prefix}:rel_${sanitizeIriIdentifier(rel.id)}`;
      const relShapeIri = `shapes:rel_${sanitizeIriIdentifier(rel.id)}`;
      const tgtIri = `${prefix}:e_${sanitizeIriIdentifier(rel.targetConceptId)}`;

      turtle += `${relShapeIri}\n`;
      turtle += `    a sh:PropertyShape ;\n`;
      turtle += `    rdfs:isDefinedBy <${baseUri}> ;\n`;
      turtle += `    sh:path ${relIri} ;\n`;
      turtle += `    sh:name "${rel.name || 'relatesTo'}"@da ;\n`;
      turtle += `    sh:class ${tgtIri} ;\n`;
      turtle += `    sh:nodeKind sh:IRI .\n\n`;
    });
  });

  return turtle;
}

// ──────────────────────────────────────────────────────────
// Profile 2: Conceptual Model Profile (SKOS Only)
// ──────────────────────────────────────────────────────────
function emitConceptualModelProfile(concepts: ConceptNode[], activeView?: View): string {
  let turtle = '';

  turtle += `@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
  turtle += `@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .\n`;
  turtle += `@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .\n`;
  turtle += `@prefix prov:    <http://www.w3.org/ns/prov#> .\n`;
  turtle += `@prefix adms:    <http://www.w3.org/ns/adms#> .\n`;
  turtle += `@prefix begreb:  <http://voresvirksomhed.dk/begreb/> .\n\n`;

  turtle += `begreb:Katalog\n`;
  turtle += `    a skos:ConceptScheme ;\n`;
  turtle += `    rdfs:label "${activeView?.name || 'Forretningsordbog'}"@da ;\n`;
  turtle += `    skos:definition "Virksomhedens officielle begreber og terminologi"@da .\n\n`;

  concepts.forEach((c) => {
    const slug = toPascalCase(c.name) || `Begreb_${c.id}`;
    turtle += `begreb:${slug}\n`;
    turtle += `    a skos:Concept ;\n`;
    turtle += `    skos:inScheme begreb:Katalog ;\n`;
    turtle += `    skos:prefLabel "${c.name}"@da`;

    const aliases = c.aliases || [];
    if (aliases.length > 0) {
      const altLabels = aliases.map((s: string) => `"${s}"@da`).join(', ');
      turtle += ` ;\n    skos:altLabel ${altLabels}`;
    }

    if (c.definition) {
      const cleanDef = c.definition.replace(/"/g, '\\"');
      turtle += ` ;\n    skos:definition "${cleanDef}"@da`;
    }

    const derived = getDerivedFrom(c);
    if (derived.length > 0) {
      turtle += ` ;\n    prov:wasDerivedFrom <${derived[0]}>`;
    }

    turtle += ` .\n\n`;
  });

  return turtle;
}

// ──────────────────────────────────────────────────────────
// Profile 3: Information Model Profile (OWL Classes & Object/Datatype Properties)
// ──────────────────────────────────────────────────────────
function emitInformationModelProfile(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  allConcepts: ConceptNode[]
): string {
  let turtle = '';

  turtle += `@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
  turtle += `@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .\n`;
  turtle += `@prefix owl:     <http://www.w3.org/2002/07/owl#> .\n`;
  turtle += `@prefix prov:    <http://www.w3.org/ns/prov#> .\n`;
  turtle += `@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .\n`;
  turtle += `@prefix info:    <http://voresvirksomhed.dk/info/> .\n\n`;

  concepts.forEach((c) => {
    const slug = toPascalCase(c.name) || `Class_${c.id}`;
    turtle += `info:${slug}\n`;
    turtle += `    a owl:Class ;\n`;
    turtle += `    rdfs:label "${c.name}"@da`;

    const derived = getDerivedFrom(c);
    if (derived.length > 0) {
      turtle += ` ;\n    prov:wasDerivedFrom <${derived[0]}>`;
    }
    turtle += ` .\n\n`;

    if ('properties' in c && c.properties) {
      c.properties.forEach((p: ConceptProperty) => {
        const propSlug = toCamelCase(p.name);
        const xsdType = mapXsdDataType(String(p.type));

        turtle += `info:${propSlug}\n`;
        turtle += `    a owl:DatatypeProperty ;\n`;
        turtle += `    rdfs:label "${p.name}"@da ;\n`;
        turtle += `    rdfs:domain info:${slug} ;\n`;
        turtle += `    rdfs:range ${xsdType}`;

        const propDerived = getDerivedFrom(p);
        if (propDerived.length > 0) {
          turtle += ` ;\n    prov:wasDerivedFrom <${propDerived[0]}>`;
        }
        turtle += ` .\n\n`;
      });
    }
  });

  if (relations.length > 0) {
    relations.forEach((rel) => {
      const srcConcept = allConcepts.find((c) => c.id === rel.sourceConceptId);
      const tgtConcept = allConcepts.find((c) => c.id === rel.targetConceptId);

      if (srcConcept && tgtConcept) {
        const srcSlug = toPascalCase(srcConcept.name);
        const tgtSlug = toPascalCase(tgtConcept.name);
        const relSlug = toCamelCase(rel.name || 'relatesTo');

        turtle += `info:${relSlug}\n`;
        turtle += `    a owl:ObjectProperty ;\n`;
        turtle += `    rdfs:label "${rel.name || 'relatesTo'}"@da ;\n`;
        turtle += `    rdfs:domain info:${srcSlug} ;\n`;
        turtle += `    rdfs:range info:${tgtSlug}`;

        const relDerived = getDerivedFrom(rel);
        if (relDerived.length > 0) {
          turtle += ` ;\n    prov:wasDerivedFrom <${relDerived[0]}>`;
        }
        turtle += ` .\n\n`;
      }
    });
  }

  return turtle;
}

export default generateRDF;
