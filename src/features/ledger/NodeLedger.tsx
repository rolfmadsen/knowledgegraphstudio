import { useCallback } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { PolicyEditor } from './PolicyEditor';
import type { LifecycleState, ConceptType } from '../../schema/graphSchema';

const stateClass = (state: LifecycleState) => {
  const base = 'w-2 h-2 rounded-full shrink-0';
  switch (state) {
    case 'proposed':
      return `${base} bg-yellow-500`;
    case 'active':
      return `${base} bg-green-600`;
    case 'deprecated':
      return `${base} bg-orange-500`;
    case 'retired':
      return `${base} bg-red-600`;
    default:
      return `${base} bg-muted`;
  }
};

export function NodeLedger() {
  const {
    concepts,
    relations,
    selectedConceptId,
    selectedRelationId,
    updateConcept,
    updateRelation,
    deleteRelation,
    selectConcept,
    addProperty,
    updateProperty,
    deleteProperty,
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
      updateConcept: s.updateConcept,
      updateRelation: s.updateRelation,
      deleteRelation: s.deleteRelation,
      selectConcept: s.selectConcept,
      addProperty: s.addProperty,
      updateProperty: s.updateProperty,
      deleteProperty: s.deleteProperty,
    }))
  );

  const selectedConcept = concepts.find((c) => c.id === selectedConceptId);
  const selectedRelation = relations.find((r) => r.id === selectedRelationId);

  // --- Hooks must be at the top level ---
  const handleAddProperty = useCallback(() => {
    if (!selectedConcept) return;
    addProperty(selectedConcept.id, 'new_property', 'string');
  }, [selectedConcept?.id, addProperty]);

  // --- Auto-focus name field on selection ---
  const nameInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      // Focus and select text so user can immediately type
      node.focus();
      node.select();
    }
  }, [selectedConceptId, selectedRelationId]); // Trigger when selection changes

  if (!selectedConcept && !selectedRelation) {
    return (
      <div className="empty-state p-8 h-full flex items-center justify-center text-center">
        Select a concept or relation to view properties.
      </div>
    );
  }

  // --- Relation View ---
  if (selectedRelation) {
    const sourceNode = concepts.find(c => c.id === selectedRelation.sourceConceptId);
    const targetNode = concepts.find(c => c.id === selectedRelation.targetConceptId);
    
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-6 pb-20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider">Relation</h2>
          <button 
            onClick={() => deleteRelation(selectedRelation.id)}
            className="text-[10px] text-red-600 hover:underline uppercase font-bold"
          >
            Delete
          </button>
        </div>

        <div className="prop-section">
          <label className="field-label">Label / Name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={selectedRelation.name}
            onChange={(e) => updateRelation(selectedRelation.id, { name: e.target.value })}
            className="field-input"
          />
        </div>

        <div className="prop-section">
          <label className="field-label">Multiplicity</label>
          <input
            type="text"
            value={selectedRelation.multiplicity || ''}
            onChange={(e) => updateRelation(selectedRelation.id, { multiplicity: e.target.value })}
            placeholder="e.g. 1..*, 0..1"
            className="field-input"
          />
        </div>

        <div className="prop-section">
          <label className="field-label">Direction</label>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-muted flex items-center gap-2">
              <span className="truncate max-w-[80px]" title={sourceNode?.name}>{sourceNode?.name || 'Unknown'}</span>
              <span>→</span>
              <span className="truncate max-w-[80px]" title={targetNode?.name}>{targetNode?.name || 'Unknown'}</span>
            </div>
            <button 
              onClick={() => updateRelation(selectedRelation.id, { 
                sourceConceptId: selectedRelation.targetConceptId,
                targetConceptId: selectedRelation.sourceConceptId 
              })}
              className="text-[9px] font-mono border border-border px-1.5 py-0.5 rounded hover:bg-surface uppercase font-bold"
            >
              Swap
            </button>
          </div>
        </div>

        <div className="prop-section">
          <label className="field-label flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={selectedRelation.isDirected ?? true}
              onChange={(e) => updateRelation(selectedRelation.id, { isDirected: e.target.checked })}
            />
            Directed Relation
          </label>
        </div>

        <div className="prop-section">
          <label className="field-label font-bold mb-4 uppercase">Policies & Rules</label>
          <PolicyEditor concept={selectedRelation as any} />
        </div>
      </div>
    );
  }


  // --- Concept View (original) ---
  if (!selectedConcept) return null;

  const rels = relations.filter(
    (r) => r.sourceConceptId === selectedConcept!.id || r.targetConceptId === selectedConcept!.id
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-6 pb-20">
      <div>
        {/* Name */}
        <div className="prop-section">
          <label className="field-label">Name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={selectedConcept.name}
            onChange={(e) => updateConcept(selectedConcept.id, { name: e.target.value })}
            className="field-input"
          />
        </div>

        {/* Type */}
        <div className="prop-section">
          <label className="field-label">Type</label>
          <select
            value={selectedConcept.conceptType}
            onChange={(e) => updateConcept(selectedConcept.id, { conceptType: e.target.value as ConceptType })}
            className="field-select"
          >
            <option value="domain">Domain</option>
            <option value="capability">Capability</option>
            <option value="bounded_context">Context</option>
            <option value="entity">Entity</option>
            <option value="process">Process</option>
            <option value="event">Event</option>
            <option value="system">System</option>
            <option value="actor">Actor</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* ID */}
        <div className="prop-section">
          <label className="field-label">ID</label>
          <p className="prop-id truncate" title={selectedConcept.id}>{selectedConcept.id}</p>
        </div>

        {/* Definition */}
        <div className="prop-section">
          <label className="field-label">Definition</label>
          <textarea
            value={selectedConcept.definition ?? ''}
            onChange={(e) => updateConcept(selectedConcept.id, { definition: e.target.value || undefined })}
            placeholder="Enter a definition…"
            rows={3}
            className="field-input resize-y"
          />
        </div>

        {/* Lifecycle */}
        <div className="prop-section">
          <label className="field-label">Lifecycle State</label>
          <div className="flex items-center gap-2">
            <span className={stateClass(selectedConcept.lifecycleState)} />
            <select
              value={selectedConcept.lifecycleState}
              onChange={(e) => updateConcept(selectedConcept.id, { lifecycleState: e.target.value as LifecycleState })}
              className="field-select"
            >
              <option value="proposed">Proposed</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>

        {/* Properties */}
        <div className="prop-section">
          <div className="flex items-center justify-between mb-1">
            <label className="field-label mb-0">Properties</label>
            <button 
              onClick={handleAddProperty}
              className="text-[9px] font-mono text-muted hover:text-text"
            >
              + ADD
            </button>
          </div>
          {selectedConcept.properties.length === 0 ? (
            <p className="text-[10px] text-muted font-mono italic">None defined</p>
          ) : (
            <div className="space-y-2">
              {selectedConcept.properties.map((p) => (
                <div key={p.id} className="flex flex-col gap-1 p-2 bg-surface border border-border rounded-md">
                  <div className="flex items-center justify-between gap-2">
                    <input 
                      className="bg-transparent border-none text-[11px] font-bold outline-none flex-1"
                      value={p.name}
                      onChange={(e) => updateProperty(selectedConcept.id, p.id, { name: e.target.value })}
                    />
                    <button 
                      onClick={() => deleteProperty(selectedConcept.id, p.id)}
                      className="text-[9px] text-muted hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  <select 
                    className="bg-transparent border-none text-[10px] text-muted outline-none"
                    value={p.type}
                    onChange={(e) => updateProperty(selectedConcept.id, p.id, { type: e.target.value as any })}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="date">date</option>
                    {concepts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Policies */}
        <div className="prop-section">
          <label className="field-label">Policies</label>
          <PolicyEditor concept={selectedConcept} />
        </div>

        {/* Relations */}
        <div className="prop-section">
          <label className="field-label">Relations</label>
          {rels.length === 0 ? (
            <p className="text-[10px] text-muted font-mono italic">None defined</p>
          ) : (
            <ul className="space-y-1">
              {rels.map((r) => {
                const isSource = r.sourceConceptId === selectedConcept.id;
                const otherId = isSource ? r.targetConceptId : r.sourceConceptId;
                const other = concepts.find((c) => c.id === otherId);
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-1 text-[11px] font-mono cursor-pointer hover:text-primary group"
                    onClick={() => selectConcept(otherId)}
                  >
                    <span className="text-muted group-hover:text-primary">{isSource ? '→' : '←'}</span>
                    <span>{other?.name ?? otherId}</span>
                    {r.multiplicity && (
                      <span className="text-muted ml-auto text-[9px]">{r.multiplicity}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
