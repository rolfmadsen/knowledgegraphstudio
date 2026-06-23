import fs from 'fs';
import path from 'path';
import N3 from 'n3';

const ontologies = [
  {
    ttlPath: path.resolve('src/notations/archimate/ontology.ttl'),
    outputPath: path.resolve('src/notations/archimate/ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2024/11/archimate32#'
  },
  {
    ttlPath: path.resolve('src/notations/dcr/ontology.ttl'),
    outputPath: path.resolve('src/notations/dcr/ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/dcr#'
  },
  {
    ttlPath: path.resolve('src/notations/c4/ontology.ttl'),
    outputPath: path.resolve('src/notations/c4/ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/c4#'
  },
  {
    ttlPath: path.resolve('src/notations/core-model/conceptual-ontology.ttl'),
    outputPath: path.resolve('src/notations/core-model/conceptual-ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/conceptual#'
  },
  {
    ttlPath: path.resolve('src/notations/core-model/information-ontology.ttl'),
    outputPath: path.resolve('src/notations/core-model/information-ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/information#'
  },
  {
    ttlPath: path.resolve('src/notations/knowledge-graph/global-ontology.ttl'),
    outputPath: path.resolve('src/notations/knowledge-graph/global-ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/global#'
  },
  {
    ttlPath: path.resolve('src/notations/event-modeling/ontology.ttl'),
    outputPath: path.resolve('src/notations/event-modeling/ontology.json'),
    ns: 'http://www.semanticweb.org/v0cn037/ontologies/2026/05/event-modeling#'
  }
];

function compileOntology({ ttlPath, outputPath, ns }) {
  console.log(`[Ontology Compiler] Reading ontology from ${ttlPath}...`);

  if (!fs.existsSync(ttlPath)) {
    console.error(`[Ontology Compiler] ❌ Error: Turtle ontology file not found at ${ttlPath}`);
    process.exit(1);
  }

  const ttlContent = fs.readFileSync(ttlPath, 'utf8');
  const parser = new N3.Parser();

  function getLocalName(uri) {
    if (uri.startsWith(ns)) {
      return uri.substring(ns.length);
    }
    const hashIdx = uri.lastIndexOf('#');
    if (hashIdx !== -1) return uri.substring(hashIdx + 1);
    const slashIdx = uri.lastIndexOf('/');
    if (slashIdx !== -1) return uri.substring(slashIdx + 1);
    return uri;
  }

  const classes = {};
  const properties = {};

  try {
    const quads = parser.parse(ttlContent);

    for (const quad of quads) {
      const sub = getLocalName(quad.subject.value);
      const pred = quad.predicate.value;
      const objVal = quad.object.value;
      const obj = getLocalName(objVal);

      // 1. Class declarations
      if (pred === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' && objVal === 'http://www.w3.org/2002/07/owl#Class') {
        if (!classes[sub]) {
          classes[sub] = { parents: [], labels: {} };
        }
      }

      // 2. Class hierarchy (rdfs:subClassOf)
      if (pred === 'http://www.w3.org/2000/01/rdf-schema#subClassOf') {
        if (!classes[sub]) {
          classes[sub] = { parents: [], labels: {} };
        }
        if (!classes[sub].parents.includes(obj)) {
          classes[sub].parents.push(obj);
        }
        // Ensure target class exists in classes object
        if (!classes[obj]) {
          classes[obj] = { parents: [], labels: {} };
        }
      }

      // 3. Object Properties
      if (pred === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' && objVal === 'http://www.w3.org/2002/07/owl#ObjectProperty') {
        if (!properties[sub]) {
          properties[sub] = { labels: {} };
        }
      }

      // 4. Inverse properties
      if (pred === 'http://www.w3.org/2002/07/owl#inverseOf') {
        if (!properties[sub]) properties[sub] = { labels: {} };
        properties[sub].inverseOf = obj;

        if (!properties[obj]) properties[obj] = { labels: {} };
        properties[obj].inverseOf = sub;
      }

      // 5. Transitive properties
      if (pred === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' && objVal === 'http://www.w3.org/2002/07/owl#TransitiveProperty') {
        if (!properties[sub]) properties[sub] = { labels: {} };
        properties[sub].transitive = true;
      }

      // 6. Labels
      if (pred === 'http://www.w3.org/2000/01/rdf-schema#label') {
        const lang = quad.object.language || 'en';
        
        // Could be label for class or property
        if (classes[sub]) {
          classes[sub].labels[lang] = objVal;
        } else if (properties[sub]) {
          properties[sub].labels[lang] = objVal;
        } else {
          // Fallback: declare temporarily
          if (sub.charAt(0) === sub.charAt(0).toUpperCase()) {
            classes[sub] = { parents: [], labels: { [lang]: objVal } };
          } else {
            properties[sub] = { labels: { [lang]: objVal } };
          }
        }
      }
    }

    // Compute transitive superClasses for all classes (Transitive Closure)
    const computeAncestors = (className, visited = new Set()) => {
      if (visited.has(className)) return [];
      visited.add(className);

      const info = classes[className];
      if (!info || !info.parents) return [];

      let ancestors = [...info.parents];
      for (const parent of info.parents) {
        ancestors = [...ancestors, ...computeAncestors(parent, visited)];
      }

      return Array.from(new Set(ancestors));
    };

    const finalClasses = {};
    for (const className of Object.keys(classes)) {
      finalClasses[className] = {
        superClasses: computeAncestors(className),
        labels: classes[className].labels
      };
    }

    const outputData = {
      classes: finalClasses,
      properties
    };

    // Write to ontology.json
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`[Ontology Compiler] ✅ Success! Compiled ontology written to ${outputPath}`);
  } catch (err) {
    console.error('[Ontology Compiler] ❌ Parsing failed:', err);
    process.exit(1);
  }
}

// Compile all configured ontologies
ontologies.forEach(compileOntology);
