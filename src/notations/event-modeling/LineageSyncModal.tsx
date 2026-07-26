import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GraphState, ElementId, ConceptNode, PayloadAttribute } from '../../schema/graphSchema';

export interface LineageSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: {
    id: ElementId;
    name: string;
    conceptType: string;
    payload: PayloadAttribute[];
  };
  allConcepts: ConceptNode[];
  graphState: GraphState;
  activeViewId: ElementId;
  updateConcept: (conceptId: ElementId, patch: Partial<ConceptNode>) => void;
}

const ALLOWED_EM_ELEMENT_TYPES = new Set([
  'screen',
  'command',
  'event',
  'read_model',
  'integration_event',
  'automation',
]);

export function LineageSyncModal({
  isOpen,
  onClose,
  currentNode,
  allConcepts,
  graphState,
  activeViewId,
  updateConcept,
}: LineageSyncModalProps) {
  if (!isOpen) return null;

  const activeView = (graphState.views || []).find((v) => v.id === activeViewId);
  const conceptMap = useMemo(() => new Map(allConcepts.map((c) => [c.id, c])), [allConcepts]);

  // Find ONLY DIRECT connected parent and child EM Element nodes in the ACTIVE view
  const { parents, children } = useMemo(() => {
    const parentMap = new Map<string, ConceptNode>();
    const childMap = new Map<string, ConceptNode>();

    if (!activeView) return { parents: [], children: [] };

    const activeViewNodeConceptIds = new Set((activeView.nodes || []).map((n) => n.conceptId));

    // 1. Inspect relations connecting concepts present in the active view
    (graphState.relations || []).forEach((rel) => {
      const isSourceInView = activeViewNodeConceptIds.has(rel.sourceConceptId);
      const isTargetInView = activeViewNodeConceptIds.has(rel.targetConceptId);
      if (!isSourceInView || !isTargetInView) return;

      if (rel.targetConceptId === currentNode.id) {
        const sourceConcept = conceptMap.get(rel.sourceConceptId);
        if (sourceConcept && ALLOWED_EM_ELEMENT_TYPES.has(sourceConcept.conceptType)) {
          parentMap.set(sourceConcept.id, sourceConcept);
        }
      }
      if (rel.sourceConceptId === currentNode.id) {
        const targetConcept = conceptMap.get(rel.targetConceptId);
        if (targetConcept && ALLOWED_EM_ELEMENT_TYPES.has(targetConcept.conceptType)) {
          childMap.set(targetConcept.id, targetConcept);
        }
      }
    });

    // 2. Fallback: If no direct relation edges are drawn for current node, find immediate timeline X neighbors in activeView
    if (parentMap.size === 0 && childMap.size === 0) {
      const currentViewNode = (activeView.nodes || []).find((n) => n.conceptId === currentNode.id);
      if (currentViewNode) {
        const viewElements = (activeView.nodes || [])
          .map((n) => ({ viewNode: n, concept: conceptMap.get(n.conceptId) }))
          .filter(
            (item) =>
              item.concept &&
              item.concept.id !== currentNode.id &&
              ALLOWED_EM_ELEMENT_TYPES.has(item.concept.conceptType)
          );

        // Immediate left neighbors
        const leftNeighbors = viewElements
          .filter((item) => item.viewNode.x < currentViewNode.x)
          .sort((a, b) => b.viewNode.x - a.viewNode.x);
        if (leftNeighbors.length > 0) {
          const closestX = leftNeighbors[0].viewNode.x;
          leftNeighbors
            .filter((item) => Math.abs(item.viewNode.x - closestX) < 100)
            .forEach((item) => parentMap.set(item.concept!.id, item.concept!));
        }

        // Immediate right neighbors
        const rightNeighbors = viewElements
          .filter((item) => item.viewNode.x > currentViewNode.x)
          .sort((a, b) => a.viewNode.x - b.viewNode.x);
        if (rightNeighbors.length > 0) {
          const closestX = rightNeighbors[0].viewNode.x;
          rightNeighbors
            .filter((item) => Math.abs(item.viewNode.x - closestX) < 100)
            .forEach((item) => childMap.set(item.concept!.id, item.concept!));
        }
      }
    }

    return {
      parents: Array.from(parentMap.values()),
      children: Array.from(childMap.values()),
    };
  }, [activeView, currentNode.id, conceptMap, graphState.relations]);

  // Helper to generate a unique key for an attribute (incorporating classId if bound)
  const getAttrKey = (attr: PayloadAttribute): string => {
    const name = attr.name.toLowerCase().trim();
    return attr.classId ? `${attr.classId}:${name}` : `local:${name}`;
  };

  // Helper to compute combined union candidate attributes for a target node
  const getCandidateAttrs = (target: ConceptNode): PayloadAttribute[] => {
    const sourcePayload: PayloadAttribute[] = currentNode.payload || [];
    const targetPayload: PayloadAttribute[] = (target as any).payload || [];

    const seen = new Set<string>();
    const candidates: PayloadAttribute[] = [];

    sourcePayload.forEach((a) => {
      const key = getAttrKey(a);
      seen.add(key);
      candidates.push(a);
    });

    targetPayload.forEach((a) => {
      const key = getAttrKey(a);
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(a);
      }
    });

    return candidates;
  };

  // Track selection state: Map<targetNodeId, Set<attributeKey>>
  const [selectedMap, setSelectedMap] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    const nextMap = new Map<string, Set<string>>();

    [...parents, ...children].forEach((target) => {
      const sourcePayload: PayloadAttribute[] = currentNode.payload || [];
      const targetPayload: PayloadAttribute[] = (target as any).payload || [];
      const sourceKeys = new Set(sourcePayload.map((a) => getAttrKey(a)));
      const targetKeys = new Set(targetPayload.map((a) => getAttrKey(a)));

      const candidates = getCandidateAttrs(target);
      const selectedKeys = new Set<string>();

      candidates.forEach((attr) => {
        const key = getAttrKey(attr);
        const isOnSource = sourceKeys.has(key);
        const isOnTarget = targetKeys.has(key);

        // Pre-select if present on BOTH nodes, OR if target node is completely empty
        if ((isOnSource && isOnTarget) || targetPayload.length === 0) {
          selectedKeys.add(key);
        }
      });

      nextMap.set(target.id, selectedKeys);
    });

    setSelectedMap(nextMap);
  }, [parents, children, currentNode.payload]);

  const toggleAttribute = (targetId: string, attrKey: string) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(targetId) || []);
      if (set.has(attrKey)) {
        set.delete(attrKey);
      } else {
        set.add(attrKey);
      }
      next.set(targetId, set);
      return next;
    });
  };

  const toggleAllForTarget = (targetId: string, candidates: PayloadAttribute[]) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const currentSet = next.get(targetId) || new Set();
      if (currentSet.size === candidates.length) {
        next.set(targetId, new Set());
      } else {
        next.set(targetId, new Set(candidates.map((a) => getAttrKey(a))));
      }
      return next;
    });
  };

  const handleSync = () => {
    const validTargets = [...parents, ...children];

    validTargets.forEach((targetConcept) => {
      const attrKeySet = selectedMap.get(targetConcept.id);
      if (!attrKeySet) return;

      const candidates = getCandidateAttrs(targetConcept);
      const targetPayload: PayloadAttribute[] = (targetConcept as any).payload || [];
      const isParent = parents.some((p) => p.id === targetConcept.id);

      // Attributes to keep on target: candidates that are checked in modal
      const nextTargetPayload = candidates
        .filter((a) => attrKeySet.has(getAttrKey(a)))
        .map((a) => {
          const existingAttr = targetPayload.find(
            (ta) => getAttrKey(ta) === getAttrKey(a)
          );
          if (existingAttr) return existingAttr;

          let syncedOrigin: 'ingress' | 'derived' | 'auto' = 'derived';
          if (
            targetConcept.conceptType === 'event' ||
            targetConcept.conceptType === 'read_model' ||
            targetConcept.conceptType === 'automation' ||
            targetConcept.conceptType === 'command'
          ) {
            syncedOrigin = 'derived';
          } else if (targetConcept.conceptType === 'screen' || targetConcept.conceptType === 'integration_event') {
            syncedOrigin = isParent ? 'ingress' : 'derived';
          }

          return {
            ...a,
            id: `payload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            originType: syncedOrigin,
          };
        });

      updateConcept(targetConcept.id, {
        payload: nextTargetPayload,
      } as any);
    });

    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-extrabold">
              ⚡
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 leading-tight">
                Data Lineage Synkronisering
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Kilde Node: <span className="font-bold text-slate-700">{currentNode.name}</span> ({currentNode.payload.length} felter)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 max-h-[60vh]">
          {parents.length === 0 && children.length === 0 ? (
            <div className="text-center py-8 text-slate-400 italic text-xs">
              Ingen direkte forbundne element-noder fundet. Forbind noder med pile for at synkronisere lineage.
            </div>
          ) : (
            <>
              {/* Direct Upstream Parent Nodes */}
              {parents.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <span>⬆ Direkte Opstrøms Noder (Forældre)</span>
                    <span className="text-[10px] font-normal text-slate-400">({parents.length})</span>
                  </h4>
                  <div className="flex flex-col gap-3">
                    {parents.map((target) => {
                      const candidates = getCandidateAttrs(target);
                      const selectedSet = selectedMap.get(target.id) || new Set();
                      const targetPayload: PayloadAttribute[] = (target as any).payload || [];
                      const sourceKeys = new Set((currentNode.payload || []).map((a) => getAttrKey(a)));
                      const targetKeys = new Set(targetPayload.map((a) => getAttrKey(a)));

                      return (
                        <div
                          key={target.id}
                          className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                              <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                {target.conceptType}
                              </span>
                              {target.name}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({targetPayload.length} felter på forældrenode)
                              </span>
                            </span>
                            <button
                              onClick={() => toggleAllForTarget(target.id, candidates)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              {selectedSet.size === candidates.length ? 'Afmarker alle' : 'Vælg alle'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {candidates.map((attr) => {
                              const attrKey = getAttrKey(attr);
                              const isChecked = selectedSet.has(attrKey);
                              const isOnSource = sourceKeys.has(attrKey);
                              const isOnTarget = targetKeys.has(attrKey);
                              const boundClass = attr.classId ? conceptMap.get(attr.classId as ElementId) : undefined;
                              const classNamePrefix = boundClass ? boundClass.name : (attr.classId ? String(attr.classId).replace(/^class:/, '') : undefined);

                              let badge = { text: '✓ På begge', cls: 'bg-emerald-100/90 text-emerald-800' };
                              if (isOnSource && !isOnTarget) {
                                badge = { text: '+ Mangler på forælder', cls: 'bg-amber-100/90 text-amber-800' };
                              } else if (!isOnSource && isOnTarget) {
                                badge = { text: '✓ Kun på forælder', cls: 'bg-indigo-100/90 text-indigo-800' };
                              }

                              return (
                                <label
                                  key={attr.id || attrKey}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 opacity-70'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleAttribute(target.id, attrKey)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="truncate">
                                    {classNamePrefix && (
                                      <span className="text-indigo-600 font-black mr-0.5">{classNamePrefix}.</span>
                                    )}
                                    {attr.name}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ml-auto font-sans ${badge.cls}`}>
                                    {badge.text}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Direct Downstream Child Nodes */}
              {children.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <span>⬇ Direkte Nedstrøms Noder (Børn)</span>
                    <span className="text-[10px] font-normal text-slate-400">({children.length})</span>
                  </h4>
                  <div className="flex flex-col gap-3">
                    {children.map((target) => {
                      const candidates = getCandidateAttrs(target);
                      const selectedSet = selectedMap.get(target.id) || new Set();
                      const targetPayload: PayloadAttribute[] = (target as any).payload || [];
                      const sourceKeys = new Set((currentNode.payload || []).map((a) => getAttrKey(a)));
                      const targetKeys = new Set(targetPayload.map((a) => getAttrKey(a)));

                      return (
                        <div
                          key={target.id}
                          className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                              <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {target.conceptType}
                              </span>
                              {target.name}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({targetPayload.length} felter på barnenode)
                              </span>
                            </span>
                            <button
                              onClick={() => toggleAllForTarget(target.id, candidates)}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800"
                            >
                              {selectedSet.size === candidates.length ? 'Afmarker alle' : 'Vælg alle'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {candidates.map((attr) => {
                              const attrKey = getAttrKey(attr);
                              const isChecked = selectedSet.has(attrKey);
                              const isOnSource = sourceKeys.has(attrKey);
                              const isOnTarget = targetKeys.has(attrKey);
                              const boundClass = attr.classId ? conceptMap.get(attr.classId as ElementId) : undefined;
                              const classNamePrefix = boundClass ? boundClass.name : (attr.classId ? String(attr.classId).replace(/^class:/, '') : undefined);

                              let badge = { text: '✓ På begge', cls: 'bg-emerald-100/90 text-emerald-800' };
                              if (isOnSource && !isOnTarget) {
                                badge = { text: '+ Mangler på barn', cls: 'bg-amber-100/90 text-amber-800' };
                              } else if (!isOnSource && isOnTarget) {
                                badge = { text: '✓ Kun på barn', cls: 'bg-indigo-100/90 text-indigo-800' };
                              }

                              return (
                                <label
                                  key={attr.id || attrKey}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 font-bold'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 opacity-70'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleAttribute(target.id, attrKey)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="truncate">
                                    {classNamePrefix && (
                                      <span className="text-emerald-600 font-black mr-0.5">{classNamePrefix}.</span>
                                    )}
                                    {attr.name}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ml-auto font-sans ${badge.cls}`}>
                                    {badge.text}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {parents.length === 0 && children.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  Ingen direkte forbundne element-noder fundet. Forbind noder med pile for at synkronisere lineage.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/80 rounded-xl transition-all"
          >
            Annuller
          </button>
          <button
            onClick={handleSync}
            className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <span>⚡ Synkroniser Lineage</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
