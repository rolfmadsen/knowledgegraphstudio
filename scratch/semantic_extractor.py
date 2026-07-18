import json
import re
from pathlib import Path

def normalize_name(s):
    # Keep alphanumeric and underscores, lowercase
    s = s.lower()
    s = re.sub(r'[^a-z0-9_]', '_', s)
    s = re.sub(r'_+', '_', s)
    return s.strip('_')

def get_file_stem(filepath, root_path):
    try:
        rel = Path(filepath).relative_to(root_path)
    except ValueError:
        rel = Path(filepath)
    stem = rel.with_suffix('')
    parts = [normalize_name(p) for p in stem.parts]
    return '_'.join(parts)

def parse_markdown(filepath, root_path):
    nodes = []
    edges = []
    
    path_obj = Path(filepath)
    if not path_obj.exists():
        return nodes, edges
        
    stem_id = get_file_stem(filepath, root_path)
    doc_node = {
        "id": stem_id,
        "label": path_obj.name,
        "file_type": "document",
        "source_file": str(path_obj.resolve()),
        "source_location": None,
        "source_url": None,
        "captured_at": None,
        "author": None,
        "contributor": None
    }
    nodes.append(doc_node)
    
    content = ""
    try:
        content = path_obj.read_text(encoding="utf-8")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return nodes, edges
        
    # Extract metadata/frontmatter if present
    frontmatter = {}
    fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if fm_match:
        fm_text = fm_match.group(1)
        for line in fm_text.split('\n'):
            if ':' in line:
                k, v = line.split(':', 1)
                frontmatter[k.strip().lower()] = v.strip().strip('"').strip("'")
        # Apply to doc node
        for key in ["source_url", "captured_at", "author", "contributor"]:
            if key in frontmatter:
                doc_node[key] = frontmatter[key]
                
    # Parse lines for headings, links, bold terms
    current_section_id = stem_id
    current_section_type = "document"
    
    lines = content.split('\n')
    for line_idx, line in enumerate(lines, 1):
        # Heading match
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            level = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()
            # Clean heading text from markdown formatting
            heading_text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', heading_text)
            heading_text = heading_text.replace('`', '').replace('*', '')
            
            heading_slug = normalize_name(heading_text)
            heading_id = f"{stem_id}_{heading_slug}"
            
            heading_node = {
                "id": heading_id,
                "label": heading_text,
                "file_type": "concept",
                "source_file": str(path_obj.resolve()),
                "source_location": line_idx,
                "source_url": doc_node["source_url"],
                "captured_at": doc_node["captured_at"],
                "author": doc_node["author"],
                "contributor": doc_node["contributor"]
            }
            nodes.append(heading_node)
            
            # Edge from document or parent section
            edges.append({
                "source": current_section_id,
                "target": heading_id,
                "relation": "conceptually_related_to",
                "confidence": "EXTRACTED",
                "confidence_score": 1.0,
                "source_file": str(path_obj.resolve()),
                "source_location": line_idx,
                "weight": 1.0
            })
            
            current_section_id = heading_id
            current_section_type = "concept"
            
        # Bold phrase extraction: e.g. **phrase**
        bold_phrases = re.findall(r'\*\*(.*?)\*\*', line)
        for phrase in bold_phrases:
            phrase = phrase.strip()
            if len(phrase) > 1 and len(phrase) < 40 and not phrase.startswith('http'):
                phrase_id = f"{stem_id}_{normalize_name(phrase)}"
                # Only add if not already in nodes
                if not any(n["id"] == phrase_id for n in nodes):
                    bold_node = {
                        "id": phrase_id,
                        "label": phrase,
                        "file_type": "concept",
                        "source_file": str(path_obj.resolve()),
                        "source_location": line_idx,
                        "source_url": doc_node["source_url"],
                        "captured_at": doc_node["captured_at"],
                        "author": doc_node["author"],
                        "contributor": doc_node["contributor"]
                    }
                    nodes.append(bold_node)
                
                # Add edge from current section/heading to this bold term
                edges.append({
                    "source": current_section_id,
                    "target": phrase_id,
                    "relation": "references",
                    "confidence": "INFERRED",
                    "confidence_score": 0.85,
                    "source_file": str(path_obj.resolve()),
                    "source_location": line_idx,
                    "weight": 1.0
                })
                
        # Link extraction: e.g. [label](target)
        links = re.findall(r'\[(.*?)\]\((.*?)\)', line)
        for label, target in links:
            label = label.strip()
            target = target.strip()
            
            # Ignore absolute web URLs, focus on local file references
            if not target.startswith(('http://', 'https://', 'mailto:', '#')):
                # Remove anchor if present
                target_clean = target.split('#')[0]
                if target_clean:
                    target_path = (path_obj.parent / target_clean).resolve()
                    if target_path.exists():
                        target_stem = get_file_stem(target_path, root_path)
                        edges.append({
                            "source": current_section_id,
                            "target": target_stem,
                            "relation": "references",
                            "confidence": "EXTRACTED",
                            "confidence_score": 1.0,
                            "source_file": str(path_obj.resolve()),
                            "source_location": line_idx,
                            "weight": 1.0
                        })
                        
    return nodes, edges

def main():
    root_path = Path("/home/rolfmadsen/github/knowledgegraphstudio")
    detect_path = root_path / "graphify-out" / ".graphify_detect.json"
    
    if not detect_path.exists():
        print(f"Error: {detect_path} does not exist.")
        return
        
    with open(detect_path, "r", encoding="utf-8") as f:
        detect = json.load(f)
        
    all_nodes = []
    all_edges = []
    
    # Process documents
    docs = detect.get("files", {}).get("document", [])
    for d in docs:
        nodes, edges = parse_markdown(d, root_path)
        all_nodes.extend(nodes)
        all_edges.extend(edges)
        
    # Process papers (e.g. PDF)
    papers = detect.get("files", {}).get("paper", [])
    for p in papers:
        p_path = Path(p)
        stem_id = get_file_stem(p, root_path)
        all_nodes.append({
            "id": stem_id,
            "label": p_path.name,
            "file_type": "paper",
            "source_file": str(p_path.resolve()),
            "source_location": None,
            "source_url": None,
            "captured_at": None,
            "author": None,
            "contributor": None
        })
        
    # Process images
    images = detect.get("files", {}).get("image", [])
    for img in images:
        img_path = Path(img)
        stem_id = get_file_stem(img, root_path)
        all_nodes.append({
            "id": stem_id,
            "label": img_path.name,
            "file_type": "image",
            "source_file": str(img_path.resolve()),
            "source_location": None,
            "source_url": None,
            "captured_at": None,
            "author": None,
            "contributor": None
        })
        
    # Deduplicate nodes by ID
    seen_nodes = set()
    deduped_nodes = []
    for n in all_nodes:
        if n["id"] not in seen_nodes:
            seen_nodes.add(n["id"])
            deduped_nodes.append(n)
            
    # Output file
    out_data = {
        "nodes": deduped_nodes,
        "edges": all_edges,
        "hyperedges": [],
        "input_tokens": 0,
        "output_tokens": 0
    }
    
    out_path = root_path / "graphify-out" / ".graphify_semantic.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)
        
    print(f"Extracted {len(deduped_nodes)} semantic nodes and {len(all_edges)} semantic edges.")

if __name__ == "__main__":
    main()
