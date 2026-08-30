import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ElementId, ConceptNode, PayloadAttribute, DataType } from '../../schema/graphSchema';

export interface PayloadSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: {
    id: ElementId;
    name: string;
    conceptType: string;
    payload: PayloadAttribute[];
  };
  allConcepts: ConceptNode[];
  activeViewId?: ElementId;
  updateConcept: (conceptId: ElementId, patch: Partial<ConceptNode>) => void;
  updateProperty?: (classId: ElementId, propertyId: any, patch: any) => void;
  addConcept?: (type: any, name: string, options?: any) => any;
  addProperty?: (classId: ElementId, name: string, type: DataType) => void;
  onOpenSyncModal?: () => void;
}

interface PropertyItem {
  classId: ElementId;
  className: string;
  propId: string;
  propName: string;
  propType: string;
}

function fuzzyScore(query: string, className: string, propName: string): number {
  const q = query.toLowerCase().trim();
  const c = className.toLowerCase();
  const p = propName.toLowerCase();
  const full = `${c}.${p}`;

  if (!q) return 1;
  if (full === q || p === q) return 100;
  if (full.startsWith(q) || p.startsWith(q)) return 80;
  if (c.startsWith(q)) return 60;
  if (full.includes(q) || p.includes(q)) return 40;
  return 0;
}

function isAlreadyInPayload(item: PropertyItem, payload: PayloadAttribute[]): boolean {
  return payload.some((attr) => {
    if (attr.classId && (attr.classId === item.classId || attr.classId === item.className)) {
      if (attr.propertyId && attr.propertyId === item.propId) return true;
      if (attr.name.toLowerCase().trim() === item.propName.toLowerCase().trim()) return true;
    }
    return false;
  });
}

export function PayloadSpecModal({
  isOpen,
  onClose,
  currentNode,
  allConcepts,
  activeViewId: _activeViewId,
  updateConcept,
  updateProperty,
  addConcept,
  addProperty,
  onOpenSyncModal,
}: PayloadSpecModalProps) {
  const conceptId = currentNode.id;
  const conceptType = currentNode.conceptType;

  const liveConcept = allConcepts.find((c) => c.id === conceptId);
  const payload: PayloadAttribute[] = (liveConcept as any)?.payload || currentNode.payload || [];

  const [isAdding, setIsAdding] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'class' | 'type' | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const classConcepts = useMemo(
    () => allConcepts.filter((c) => c.conceptType === 'class'),
    [allConcepts]
  );

  const sortedPayload = useMemo(() => {
    const list = [...payload];
    list.sort((a, b) => {
      const classA = a.classId
        ? (classConcepts.find((c) => c.id === a.classId || c.name === a.classId)?.name || String(a.classId))
        : '';
      const classB = b.classId
        ? (classConcepts.find((c) => c.id === b.classId || c.name === b.classId)?.name || String(b.classId))
        : '';

      if (classA && !classB) return -1;
      if (!classA && classB) return 1;

      const classCmp = classA.localeCompare(classB);
      if (classCmp !== 0) return classCmp;

      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }, [payload, classConcepts]);

  const availableProperties = useMemo(() => {
    const list: PropertyItem[] = [];
    for (const cls of classConcepts) {
      const props = (cls as any).properties || [];
      for (const p of props) {
        list.push({
          classId: cls.id,
          className: cls.name,
          propId: p.id,
          propName: p.name,
          propType: String(p.type || 'string'),
        });
      }
    }
    list.sort((a, b) => {
      const classCmp = a.className.localeCompare(b.className);
      if (classCmp !== 0) return classCmp;
      return a.propName.localeCompare(b.propName);
    });
    return list;
  }, [classConcepts]);

  const unaddedAvailableProperties = useMemo(() => {
    return availableProperties.filter((p) => !isAlreadyInPayload(p, payload));
  }, [availableProperties, payload]);

  const filteredProperties = useMemo(() => {
    const rawQuery = newAttrName.trim();
    if (!rawQuery) return unaddedAvailableProperties.slice(0, 8);

    const scored = unaddedAvailableProperties
      .map((p) => ({
        property: p,
        score: fuzzyScore(rawQuery, p.className, p.propName),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.property).slice(0, 8);
  }, [unaddedAvailableProperties, newAttrName]);

  const selectableOptions = useMemo(() => {
    const list: Array<{
      kind: 'existing' | 'create_class' | 'create_local';
      data?: PropertyItem;
      cls?: string;
      prop?: string;
    }> = [];

    filteredProperties.forEach((p) => {
      list.push({ kind: 'existing', data: p });
    });

    const raw = newAttrName.trim();
    if (raw) {
      const hasDot = raw.includes('.');
      const parts = raw.split('.');
      const cls = hasDot ? parts[0].trim() : undefined;
      const prop = hasDot ? parts.slice(1).join('.').trim() : raw;
      list.push({ kind: 'create_class', cls, prop });
      list.push({ kind: 'create_local', prop });
    }

    return list;
  }, [filteredProperties, newAttrName]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [newAttrName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectExistingProperty = (item: PropertyItem) => {
    if (!conceptId) return;
    const defaultOrigin = conceptType === 'read_model' ? 'derived' : 'ingress';
    const newAttr: PayloadAttribute = {
      id: `payload-${Date.now()}`,
      name: item.propName,
      type: item.propType as any,
      scope: 'class_attribute' as const,
      originType: defaultOrigin as any,
      classId: item.classId,
      propertyId: item.propId,
    };
    updateConcept(conceptId, { payload: [...payload, newAttr] });
    setNewAttrName('');
    setIsAdding(false);
  };

  const handleAddCustomAttribute = (scope: 'class_attribute' | 'event_local') => {
    const raw = newAttrName.trim();
    if (!raw || !conceptId) return;

    let targetClassName: string | undefined = undefined;
    let propName = raw;
    let type = 'string';

    if (raw.includes('.')) {
      const dotParts = raw.split('.');
      targetClassName = dotParts[0].trim();
      propName = dotParts.slice(1).join('.').trim();
    }

    if (propName.includes(':')) {
      const colonParts = propName.split(':');
      propName = colonParts[0].trim();
      type = colonParts[1].trim() || 'string';
    }

    let targetClassId: ElementId | undefined = undefined;

    if (scope === 'class_attribute' && targetClassName) {
      const existingClass = classConcepts.find(
        (c) => c.name.toLowerCase() === targetClassName!.toLowerCase()
      );

      if (existingClass) {
        targetClassId = existingClass.id;
        const hasProp = (existingClass.properties || []).some(
          (p: any) => p.name.toLowerCase() === propName.toLowerCase()
        );
        if (!hasProp && addProperty) {
          addProperty(existingClass.id, propName, type as DataType);
        }
      } else if (addConcept) {
        const createdConcept = addConcept('class', targetClassName);
        const createdId = typeof createdConcept === 'object' && createdConcept ? (createdConcept as any).id : (createdConcept as any);
        if (createdId) {
          targetClassId = createdId;
          if (addProperty) {
            addProperty(createdId, propName, type as DataType);
          }
        }
      }
    }

    const defaultOrigin = (conceptType === 'screen' || conceptType === 'integration_event') ? 'ingress' : 'derived';
    const newAttr: PayloadAttribute = {
      id: `payload-${Date.now()}`,
      name: propName,
      type: type as any,
      scope,
      originType: defaultOrigin as any,
      classId: targetClassId,
    };

    updateConcept(conceptId, { payload: [...payload, newAttr] });
    setNewAttrName('');
    setIsAdding(false);
  };

  const handleDeleteAttribute = (attrId: string) => {
    if (!conceptId) return;
    const nextPayload = payload.filter((a) => a.id !== attrId);
    updateConcept(conceptId, { payload: nextPayload });
  };

  const handleSetOrigin = (attrId: string, newOrigin: 'ingress' | 'derived' | 'auto') => {
    if (!conceptId) return;
    const isNonIngressNode = conceptType === 'command' || conceptType === 'event' || conceptType === 'read_model' || conceptType === 'automation';
    const effectiveOrigin: 'ingress' | 'derived' | 'auto' = (isNonIngressNode && newOrigin === 'ingress') ? 'derived' : newOrigin;
    const nextPayload = payload.map((a) => (a.id === attrId ? { ...a, originType: effectiveOrigin } : a));
    updateConcept(conceptId, { payload: nextPayload });
  };

  const handleSetType = (attr: PayloadAttribute, newType: string) => {
    if (!conceptId) return;
    if (attr.classId && attr.propertyId && updateProperty) {
      updateProperty(attr.classId as ElementId, attr.propertyId, { type: newType as any });
    }
    const nextPayload = payload.map((a) => (a.id === attr.id ? { ...a, type: newType as DataType } : a));
    updateConcept(conceptId, { payload: nextPayload });
  };

  const handleStartEdit = (attrId: string, field: 'name' | 'class' | 'type', initialValue: string) => {
    setEditingAttrId(attrId);
    setEditingField(field);
    setEditValue(initialValue);
  };

  const handleCommitAttributeRename = (attrId: string, newName: string) => {
    if (!conceptId) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditingAttrId(null);
      setEditingField(null);
      return;
    }

    const targetAttr = payload.find((a) => a.id === attrId);
    if (targetAttr) {
      if (targetAttr.classId && targetAttr.propertyId && updateProperty) {
        updateProperty(targetAttr.classId as ElementId, targetAttr.propertyId, { name: trimmed });
      }
      const nextPayload = payload.map((a) => (a.id === attrId ? { ...a, name: trimmed } : a));
      updateConcept(conceptId, { payload: nextPayload });
    }
    setEditingAttrId(null);
    setEditingField(null);
  };

  const handleCommitClassRename = (classId: ElementId, newClassName: string) => {
    const trimmed = newClassName.trim();
    if (trimmed && updateConcept) {
      updateConcept(classId, { name: trimmed });
    }
    setEditingAttrId(null);
    setEditingField(null);
  };

  const handleExecuteSelectedOption = (idx: number) => {
    const opt = selectableOptions[idx];
    if (!opt) return;
    if (opt.kind === 'existing' && opt.data) {
      handleSelectExistingProperty(opt.data);
    } else if (opt.kind === 'create_class') {
      handleAddCustomAttribute('class_attribute');
    } else if (opt.kind === 'create_local') {
      handleAddCustomAttribute('event_local');
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
              {conceptType}
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              Payload Specifikation for "{currentNode.name}"
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 font-bold transition-all text-sm"
            title="Luk"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Attributes Table */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
              <span>Definerede Attributter ({payload.length})</span>
              {onOpenSyncModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSyncModal();
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 normal-case text-xs"
                >
                  <span>⚡ Sync Data Lineage...</span>
                </button>
              )}
            </div>

            {sortedPayload.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {sortedPayload.map((attr, i) => {
                  const boundClass = attr.classId ? classConcepts.find((c) => c.id === attr.classId || c.name === attr.classId) : undefined;
                  const isNonIngressNode = conceptType === 'command' || conceptType === 'event' || conceptType === 'read_model' || conceptType === 'automation';
                  const origin = attr.originType === 'auto' ? 'auto' : (isNonIngressNode ? 'derived' : (attr.originType || 'ingress'));

                  return (
                    <div
                      key={attr.id || i}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-mono text-xs group transition-all shadow-2xs hover:border-indigo-200 hover:bg-slate-100/60"
                    >
                      {/* Class Name + Attribute Name */}
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {origin === 'ingress' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 shadow-2xs" title="Data Indgangspunkt" />
                        )}
                        {origin === 'auto' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 shadow-2xs" title="System Auto" />
                        )}
                        {origin === 'derived' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 shadow-2xs" title="Afledt Felt" />
                        )}

                        <span className="truncate flex items-center gap-1 font-bold text-slate-900">
                          {boundClass ? (
                            editingAttrId === attr.id && editingField === 'class' ? (
                              <input
                                autoFocus
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitClassRename(boundClass.id, editValue);
                                  if (e.key === 'Escape') {
                                    setEditingAttrId(null);
                                    setEditingField(null);
                                  }
                                }}
                                onBlur={() => handleCommitClassRename(boundClass.id, editValue)}
                                className="px-1.5 py-0.5 text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-300 rounded outline-none w-[110px]"
                              />
                            ) : (
                              <span
                                onClick={() => handleStartEdit(attr.id, 'class', boundClass.name)}
                                title="Klik for at redigere klasse"
                                className="text-indigo-600 font-black hover:bg-indigo-100/80 rounded px-1 cursor-pointer transition-all"
                              >
                                {boundClass.name}.
                              </span>
                            )
                          ) : null}

                          {editingAttrId === attr.id && editingField === 'name' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitAttributeRename(attr.id, editValue);
                                if (e.key === 'Escape') {
                                  setEditingAttrId(null);
                                  setEditingField(null);
                                }
                              }}
                              onBlur={() => handleCommitAttributeRename(attr.id, editValue)}
                              className="px-1.5 py-0.5 text-xs font-bold text-slate-900 bg-white border border-indigo-400 rounded outline-none w-[130px]"
                            />
                          ) : (
                            <span
                              onClick={() => handleStartEdit(attr.id, 'name', attr.name)}
                              title="Klik for at redigere attribut"
                              className="hover:bg-slate-200/80 rounded px-1 cursor-pointer transition-all"
                            >
                              {attr.name}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Origin & Datatype Selectors */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={origin}
                          onChange={(e) => handleSetOrigin(attr.id, e.target.value as 'ingress' | 'derived' | 'auto')}
                          className={`px-2.5 py-1 text-xs font-extrabold rounded-xl border outline-none cursor-pointer transition-all appearance-none shadow-2xs ${
                            origin === 'ingress'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : origin === 'derived'
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {!isNonIngressNode && <option value="ingress">📥 Input</option>}
                          <option value="derived">🔗 Afledt</option>
                          <option value="auto">⚡ Auto</option>
                        </select>

                        <select
                          value={String(attr.type || 'string').toLowerCase()}
                          onChange={(e) => handleSetType(attr, e.target.value)}
                          className="px-2.5 py-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl outline-none cursor-pointer transition-all appearance-none shadow-2xs"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="date">date</option>
                          <option value="object">object</option>
                          <option value="array">array</option>
                        </select>

                        <button
                          onClick={() => handleDeleteAttribute(attr.id)}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg font-extrabold text-sm transition-all"
                          title="Slet felt"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                Ingen felter defineret i payload endnu. Skriv eller tilføj et felt nedenfor.
              </div>
            )}
          </div>

          {/* Add Attribute Section */}
          {isAdding ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 relative">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  placeholder="Søg eller skriv felt (f.eks. OrgPerson.personnelId)..."
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev < selectableOptions.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectableOptions.length - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (selectableOptions.length > 0) {
                        handleExecuteSelectedOption(selectedIndex);
                      } else if (newAttrName.trim()) {
                        handleAddCustomAttribute('class_attribute');
                      }
                    } else if (e.key === 'Escape') {
                      setIsAdding(false);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold border border-indigo-300 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-xl bg-slate-100"
                >
                  Afbryd
                </button>
              </div>

              {/* Combobox Options */}
              {selectableOptions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[180px] overflow-y-auto p-1 font-sans">
                  {filteredProperties.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                        Eksisterende Klasse Attributter
                      </div>
                      {filteredProperties.map((prop, idx) => {
                        const isSelected = selectedIndex === idx;
                        return (
                          <button
                            key={`${prop.classId}-${prop.propId}`}
                            onClick={() => handleSelectExistingProperty(prop)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full px-3 py-1.5 text-left rounded-xl flex items-center justify-between transition-all ${
                              isSelected ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100 font-semibold'
                            }`}
                          >
                            <span className="truncate text-xs">
                              <span className={`font-extrabold mr-1 ${isSelected ? 'text-indigo-100' : 'text-indigo-600'}`}>
                                {prop.className}.
                              </span>
                              {prop.propName}
                            </span>
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {prop.propType}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {newAttrName.trim() && (
                    <div className="flex flex-col bg-slate-50 p-1 gap-1 rounded-xl mt-1">
                      {(() => {
                        const raw = newAttrName.trim();
                        const hasDot = raw.includes('.');
                        const parts = raw.split('.');
                        const cls = hasDot ? parts[0].trim() : undefined;
                        const prop = hasDot ? parts.slice(1).join('.').trim() : raw;

                        const createClassIdx = filteredProperties.length;
                        const createLocalIdx = filteredProperties.length + 1;

                        const isSelectedClass = selectedIndex === createClassIdx;
                        const isSelectedLocal = selectedIndex === createLocalIdx;

                        return (
                          <>
                            <button
                              onClick={() => handleAddCustomAttribute('class_attribute')}
                              onMouseEnter={() => setSelectedIndex(createClassIdx)}
                              className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                                isSelectedClass ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              + {cls ? `Opret Klasse "${cls}" & Attribut "${prop}"` : `Opret "${prop}" (Klasse Attribut)`}
                            </button>
                            <button
                              onClick={() => handleAddCustomAttribute('event_local')}
                              onMouseEnter={() => setSelectedIndex(createLocalIdx)}
                              className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                                isSelectedLocal ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              + Opret "{prop}" (Event-Lokal)
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center justify-center gap-2 p-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 rounded-2xl transition-all"
            >
              <span>+ Tilføj ny payload attribut...</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl shadow-2xs transition-all"
          >
            Færdig / Luk
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
}
