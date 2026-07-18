import json
from pathlib import Path
from collections import Counter
import re

def get_clean_name(name):
    # Capitalize words and replace underscores/hyphens with spaces
    name = re.sub(r'[^a-zA-Z0-9]', ' ', name)
    name = ' '.join(w.capitalize() for w in name.split())
    return name

def main():
    root_path = Path("/home/rolfmadsen/github/knowledgegraphstudio")
    analysis_path = root_path / "graphify-out" / ".graphify_analysis.json"
    extract_path = root_path / "graphify-out" / ".graphify_extract.json"
    
    if not analysis_path.exists() or not extract_path.exists():
        print("Required files do not exist.")
        return
        
    with open(analysis_path, "r", encoding="utf-8") as f:
        analysis = json.load(f)
        
    with open(extract_path, "r", encoding="utf-8") as f:
        extract = json.load(f)
        
    # Build node lookup table
    nodes_info = {n["id"]: n for n in extract.get("nodes", [])}
    
    communities = analysis.get("communities", {})
    labels_dict = {}
    
    for cid_str, node_ids in communities.items():
        cid = int(cid_str)
        # Gather information about nodes in this community
        c_nodes = [nodes_info[nid] for nid in node_ids if nid in nodes_info]
        
        if not c_nodes:
            labels_dict[cid] = f"Community {cid}"
            continue
            
        # Count dominant file types, folders, files
        folders = []
        filenames = []
        node_labels = []
        file_types = []
        
        for n in c_nodes:
            file_types.append(n.get("file_type", "unknown"))
            node_labels.append(n.get("label", ""))
            
            source_file = n.get("source_file")
            if source_file:
                p = Path(source_file)
                try:
                    rel_p = p.relative_to(root_path)
                except ValueError:
                    rel_p = p
                
                # Folder structure
                if len(rel_p.parts) > 1:
                    folders.append("/".join(rel_p.parts[:-1]))
                filenames.append(rel_p.name)
                
        # Determine dominant attributes
        most_common_folder = Counter(folders).most_common(1)
        most_common_file = Counter(filenames).most_common(1)
        most_common_type = Counter(file_types).most_common(1)
        
        folder_str = most_common_folder[0][0] if most_common_folder else ""
        file_str = most_common_file[0][0] if most_common_file else ""
        type_str = most_common_type[0][0] if most_common_type else "Concept"
        
        # Build a descriptive label
        label = ""
        if "monaco-editor" in folder_str or "monaco-editor" in file_str:
            label = "Monaco Editor Integration"
        elif "src/features/viewport" in folder_str:
            label = "Viewport Canvas & View"
        elif "src/features/ai" in folder_str:
            label = "AI Chat & Services"
        elif "src/services" in folder_str:
            label = "System Services"
        elif "src/store" in folder_str:
            label = "State Store Manager"
        elif "src/notations" in folder_str:
            if "archimate" in folder_str or "archimate" in file_str:
                label = "ArchiMate Notation"
            elif "c4" in folder_str or "c4" in file_str:
                label = "C4 Architecture Notation"
            elif "dcr" in folder_str or "dcr" in file_str:
                label = "DCR Graph Notation"
            elif "event-modeling" in folder_str or "event-modeling" in file_str:
                label = "Event Modeling Notation"
            else:
                label = "Visual Notations Registry"
        elif "src/core" in folder_str:
            label = "Core File & Git Systems"
        elif ".agent/wiki" in folder_str or ".agent/wiki" in file_str:
            label = "Ontology Documentation Wiki"
        elif folder_str:
            # Clean up the folder name
            last_folder = Path(folder_str).name
            label = f"{get_clean_name(last_folder)} Module"
        else:
            # Fall back to dominant node labels or filenames
            clean_file = get_clean_name(Path(file_str).stem)
            if clean_file:
                label = f"{clean_file} Concepts"
            else:
                label = f"Community {cid}"
                
        # Cap length and save
        labels_dict[cid] = label
        
    # Write output labels mapping file
    out_path = root_path / "graphify-out" / ".graphify_labels_raw.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(labels_dict, f, indent=2, ensure_ascii=False)
        
    print(f"Generated labels for {len(labels_dict)} communities.")

if __name__ == "__main__":
    main()
