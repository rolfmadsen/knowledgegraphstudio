import json
from pathlib import Path

def main():
    root = Path("/home/rolfmadsen/github/knowledgegraphstudio")
    graph_path = root / "graphify-out" / "graph.json"
    
    if not graph_path.exists():
        print("graph.json not found.")
        return
        
    with open(graph_path, "r", encoding="utf-8") as f:
        graph_data = json.load(f)
        
    nodes = graph_data.get("nodes", [])
    links = graph_data.get("links", [])
    
    print(f"Loaded graph with {len(nodes)} nodes and {len(links)} links.")
    
    # Map nodes by id for quick lookup
    node_map = {n["id"]: n for n in nodes}
    
    # Rule 1 Check: Methods/Files in src/services/ must NEVER import or reference src/store/useGraphStore
    # We check if any node originating from src/services/ has an outgoing edge to a node in src/store/
    services_to_store_violations = []
    
    # Rule 2 Check: UI/View components should invoke Zustand store actions, NOT call services directly
    # We check if any component (TSX/TS files in src/features/ or src/components/) has direct edges to src/services/
    ui_to_services_violations = []
    
    # Gather edge interactions
    for link in links:
        source_id = link.get("source")
        target_id = link.get("target")
        relation = link.get("relation", "")
        
        source_node = node_map.get(source_id)
        target_node = node_map.get(target_id)
        
        if not source_node or not target_node:
            continue
            
        src_file = source_node.get("source_file", "")
        tgt_file = target_node.get("source_file", "")
        
        if not src_file or not tgt_file:
            continue
            
        # Standardize paths
        try:
            src_rel = str(Path(src_file).relative_to(root))
        except ValueError:
            src_rel = src_file
            
        try:
            tgt_rel = str(Path(tgt_file).relative_to(root))
        except ValueError:
            tgt_rel = tgt_file
            
        # 1. Services importing store check
        if src_rel.startswith("src/services/") and ("src/store/" in tgt_rel or "useGraphStore" in tgt_rel):
            services_to_store_violations.append({
                "source_node": source_node["label"],
                "source_file": src_rel,
                "target_node": target_node["label"],
                "target_file": tgt_rel,
                "relation": relation
            })
            
        # 2. UI calling services check
        # UI components are typically in src/features/ or src/components/ (and are .tsx or under component folders)
        # Bypassing the store to call services directly:
        is_ui = ("src/features/" in src_rel or "src/components/" in src_rel) and (src_rel.endswith(".tsx") or "/components/" in src_rel)
        is_service = tgt_rel.startswith("src/services/")
        
        if is_ui and is_service:
            # Check if it's an allowed reference or a violation (e.g. calling service functions/classes)
            ui_to_services_violations.append({
                "source_node": source_node["label"],
                "source_file": src_rel,
                "target_node": target_node["label"],
                "target_file": tgt_rel,
                "relation": relation
            })

    # Output violations
    print("\n--- VIOLATION REPORT ---")
    
    print(f"\n1. Services referencing Zustand Store (Rule 1 Violation): {len(services_to_store_violations)}")
    for v in services_to_store_violations:
        print(f"  - {v['source_file']} ({v['source_node']}) -> {v['target_file']} ({v['target_node']}) via relation '{v['relation']}'")
        
    print(f"\n2. UI Component directly calling/referencing Services (Rule 3 Violation): {len(ui_to_services_violations)}")
    # Deduplicate by (source_file, target_file)
    seen_ui_v = set()
    for v in ui_to_services_violations:
        key = (v['source_file'], v['target_file'])
        if key not in seen_ui_v:
            seen_ui_v.add(key)
            print(f"  - {v['source_file']} -> {v['target_file']} (ref: {v['target_node']})")
            
    # Check for cyclic dependencies in the store/services
    print("\n3. Import Cycles in Report:")
    # We can read this from GRAPH_REPORT.md's ## Import Cycles section
    report_path = root / "graphify-out" / "GRAPH_REPORT.md"
    if report_path.exists():
        report_text = report_path.read_text(encoding="utf-8")
        cycles_section = False
        for line in report_text.split("\n"):
            if line.startswith("## Import Cycles"):
                cycles_section = True
                continue
            if cycles_section:
                if line.startswith("## "):
                    break
                if line.strip():
                    print("  " + line.strip())

if __name__ == "__main__":
    main()
