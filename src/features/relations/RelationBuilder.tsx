import { useState, useRef, useEffect, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { ConceptType } from '../../schema/graphSchema';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { getVirtualType } from '../../utils/virtualType';
import {
  Search,
  Plus,
  ArrowRight,
  Zap,
  User,
  Activity,
  Workflow,
  Database,
  Box,
  Layers,
  X,
  ChevronRight,
  Shield
} from 'lucide-react';
import Fuse from 'fuse.js';

interface RelationOption {
  id: string;
  label: string;
  description: string;
  isNew: boolean;
  virtualType?: string;
}

const CONCEPT_TYPES: Array<{ type: ConceptType; label: string; icon: React.ReactNode }> = ConceptType.options.map(t => {
  const isStrategyOrMotivation = [
    'capability', 'requirement', 'goal', 'resource', 'course_of_action', 'value_stream',
    'stakeholder', 'driver', 'assessment', 'outcome', 'principle', 'constraint', 'value', 'meaning'
  ].includes(t);
  let icon = <Layers size={20} />;
  if (isStrategyOrMotivation) icon = <Shield size={20} />;
  else if (['actor', 'business_role', 'business_collaboration', 'business_interface', 'business_interaction', 'contract', 'representation', 'product'].includes(t)) icon = <User size={20} />;
  else if (['process', 'application_process', 'technology_process', 'work_package'].includes(t)) icon = <Activity size={20} />;
  else if (['system', 'application_component', 'technology_interface', 'device', 'system_software'].includes(t)) icon = <Workflow size={20} />;
  else if (['domain', 'location'].includes(t)) icon = <Database size={20} />;
  else if (['entity', 'business_object', 'artifact', 'material'].includes(t)) icon = <Box size={20} />;

  return {
    type: t as ConceptType,
    label: t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '),
    icon
  };
});

const DEFAULT_RELATIONS = [
  { id: 'relateret_til', label: 'relateret til', icon: <ChevronRight size={14} /> },
  { id: 'triggere', label: 'triggere', icon: <Zap size={14} /> },
  { id: 'bruger', label: 'bruger', icon: <User size={14} /> },
  { id: 'består_af', label: 'består af', icon: <Layers size={14} /> },
  { id: 'ejer', label: 'ejer', icon: <Shield size={14} /> },
  { id: 'input_til', label: 'input til', icon: <ArrowRight size={14} /> },
  { id: 'del_af', label: 'del af', icon: <Box size={14} /> },
];

const CONTEXTUAL_RELATIONS: Record<string, string[]> = {
  'actor->process': ['udfører', 'ansvarlig for', 'deltager i'],
  'process->system': ['understøttes af', 'bruger', 'automatiseret i'],
  'system->system': ['afhænger af', 'kalder', 'integrerer med'],
  'domain->domain': ['del af', 'nabo til'],
  'domain->bounded_context': ['indeholder', 'realiseres i'],
  'bounded_context->bounded_context': ['afhænger af', 'partner med', 'kunde til'],
  'system->event': ['udsender', 'publicerer', 'triggere'],
  'event->process': ['triggere', 'starter', 'input til'],
  'capability->process': ['realiseres ved', 'understøtter'],
};

const RELATIONSHIP_DESCRIPTIONS: Record<string, { label: string; symbol: string; desc: string }> = {
  compositionrelationship: {
    label: 'Composition',
    symbol: '◆—',
    desc: 'Indicates that the source element consists of or contains the target element.'
  },
  aggregationrelationship: {
    label: 'Aggregation',
    symbol: '◇—',
    desc: 'Indicates that the source element groups or aggregates the target element.'
  },
  assignmentrelationship: {
    label: 'Assignment',
    symbol: '●→',
    desc: 'Expresses the allocation of responsibility or performance of behavior.'
  },
  realizationrelationship: {
    label: 'Realization',
    symbol: '⤏▷',
    desc: 'Indicates that the source entity achieves or realizes the target abstract entity.'
  },
  servingrelationship: {
    label: 'Serving',
    symbol: '—▷',
    desc: 'Describes that the source element provides its functionality to the target element.'
  },
  accessrelationship: {
    label: 'Access',
    symbol: '⤏',
    desc: 'Models the ability of behavioral elements to read, write, or access passive data.'
  },
  influencerelationship: {
    label: 'Influence',
    symbol: '⤏+',
    desc: 'Describes that the source element has a positive or negative influence on the target.'
  },
  flowrelationship: {
    label: 'Flow',
    symbol: '⤏➔',
    desc: 'Describes the exchange, transfer, or sequence of data, value, or energy.'
  },
  triggeringrelationship: {
    label: 'Triggering',
    symbol: '—➔',
    desc: 'Describes a temporal or causal trigger between behavioral elements.'
  },
  specializationrelationship: {
    label: 'Specialization',
    symbol: '—▷',
    desc: 'Indicates that the source element is a sub-class or specialization of the target.'
  },
  associationrelationship: {
    label: 'Association',
    symbol: '——',
    desc: 'Represents an unspecified or generic connection between elements.'
  }
};

const getDisplayLabelForType = (type: string, activeNotation?: any) => {
  if (type === 'conceptual_class') return 'Begreb';
  if (type === 'information_class') return 'Klasse';
  return activeNotation?.conceptTypeLabels?.[type as ConceptType] || type.toUpperCase().replace(/_/g, ' ');
};

export function RelationBuilder() {
  const {
    open,
    sourceId,
    concepts,
    setOpen,
    createQuickRelation,
    views,
    activeViewId
  } = useGraphStore(
    useShallow((s) => ({
      open: s.isRelationBuilderOpen,
      sourceId: s.relationBuilderSourceId,
      concepts: s.concepts,
      setOpen: s.setRelationBuilderOpen,
      createQuickRelation: s.createQuickRelation,
      views: s.views,
      activeViewId: s.activeViewId
    }))
  );

  const activeView = views.find(v => v.id === activeViewId);
  const activeNotation = activeView ? NotationRegistry.forViewType(activeView.type) : undefined;

  const baseAllowedTypes = useMemo(() => {
    const rawTypes = activeNotation?.allowedConceptTypes
      ? CONCEPT_TYPES.filter(ct => activeNotation.allowedConceptTypes!.includes(ct.type))
      : CONCEPT_TYPES;

    return rawTypes.map(ct => {
      const customLabel = activeNotation?.conceptTypeLabels?.[ct.type];
      return {
        ...ct,
        label: customLabel || ct.label
      };
    });
  }, [activeNotation]);

  const [step, setStep] = useState<'target' | 'type' | 'label'>('target');
  const [query, setQuery] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [targetIdOrName, setTargetIdOrName] = useState('');
  const [isNewTarget, setIsNewTarget] = useState(false);
  const [selectedType, setSelectedType] = useState<ConceptType>('entity');
  const [label, setLabel] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);

  const sourceNode = concepts.find(c => c.id === sourceId);
  const targetNode = !isNewTarget ? concepts.find(c => c.id === targetIdOrName) : null;

  // Focus input when opened or step changes
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, step]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep('target');
      setQuery('');
      setTypeSearch('');
      setLabel('');
      setSelectedIndex(0);
      setSelectedType('entity');
    }
  }, [open]);

  // Options for target selection
  const options = useMemo(() => {
    const q = query.trim();
    const sourceNode = concepts.find(c => c.id === sourceId);
    const filtered = concepts.filter(c => c.id !== sourceId);

    // Filter targets by notation allowed types and presence of valid relations
    const notationFiltered = filtered.filter(c => {
      if (activeNotation?.allowedConceptTypes && !activeNotation.allowedConceptTypes.includes(c.conceptType)) {
        return false;
      }
      if (sourceNode && activeNotation?.getAvailableRelations) {
        const allowedRels = activeNotation.getAvailableRelations(sourceNode.conceptType, c.conceptType);
        if (allowedRels.length === 0) {
          return false;
        }
      }
      return true;
    });

    const fuse = new Fuse(notationFiltered, {
      keys: ['name', 'conceptType'],
      threshold: 0.4,
    });

    const results = q ? fuse.search(q).map(r => r.item) : [];

    const finalOptions: RelationOption[] = results.map(c => ({
      id: c.id,
      label: c.name,
      description: c.conceptType,
      virtualType: getVirtualType(c, views),
      isNew: false
    }));

    if (q) {
      // Only offer to create new if the current view doesn't restrict concept types,
      // or if at least one concept type is supported by the active notation
      const hasAllowedTypes = !activeNotation?.allowedConceptTypes || activeNotation.allowedConceptTypes.length > 0;
      if (hasAllowedTypes) {
        finalOptions.unshift({
          id: 'new',
          label: `Create "${q}"`,
          description: 'New concept archetype',
          isNew: true
        });
      }
    }

    return finalOptions;
  }, [query, concepts, sourceId, activeNotation, views]);

  // Filtered archetypes for new node creation
  const filteredTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return baseAllowedTypes;
    return baseAllowedTypes.filter(ct =>
      ct.label.toLowerCase().includes(q) ||
      ct.type.toLowerCase().includes(q)
    );
  }, [typeSearch, baseAllowedTypes]);

  // Common relations filtered by label query AND context
  const filteredRelations = useMemo(() => {
    if (step !== 'label' || !sourceNode) return [];

    const sourceT = sourceNode.conceptType;
    const targetT = isNewTarget ? selectedType : targetNode?.conceptType;

    // Use notation allowed relations if defined
    if (activeNotation?.getAvailableRelations && targetT) {
      const pluginRelations = activeNotation.getAvailableRelations(sourceT, targetT);
      return pluginRelations
        .map(r => ({
          id: r.id,
          label: r.label,
          description: r.description,
          icon: <Zap size={14} className="text-emerald-500" />,
          isContextual: true
        }))
        .filter(r => r.label.toLowerCase().includes(label.toLowerCase()));
    }

    const contextKey = `${sourceT}->${targetT}`;
    const contextualLabels = CONTEXTUAL_RELATIONS[contextKey] || [];

    // Create base list: Contextual first, then defaults
    const baseList = [
      ...contextualLabels.map(l => ({
        id: `ctx-${l}`,
        label: l,
        description: undefined as string | undefined,
        icon: <Zap size={14} className="text-amber-500" />,
        isContextual: true
      })),
      ...DEFAULT_RELATIONS.filter(d => !contextualLabels.includes(d.label)).map(d => ({
        ...d,
        description: undefined as string | undefined
      }))
    ];

    return baseList.filter(r =>
      r.label.toLowerCase().includes(label.toLowerCase())
    );
  }, [label, step, sourceNode, targetNode, isNewTarget, selectedType, activeNotation]);

  // Reset selection when options/step change
  useEffect(() => {
    setSelectedIndex(0);
  }, [options.length, filteredRelations.length, filteredTypes.length, step]);

  // Scroll selected item into view with safety padding to prevent cut-off borders/shadows
  useEffect(() => {
    if (listRef.current) {
      const buttons = listRef.current.querySelectorAll('button');
      const selectedElement = buttons[selectedIndex] as HTMLElement;
      if (selectedElement) {
        const container = listRef.current;
        const elemTop = selectedElement.offsetTop;
        const elemBottom = elemTop + selectedElement.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        const padding = 12; // safety padding for borders, shadows and rings

        if (elemTop - padding < containerTop) {
          container.scrollTo({ top: elemTop - padding, behavior: 'auto' });
        } else if (elemBottom + padding > containerBottom) {
          container.scrollTo({ top: elemBottom + padding - container.clientHeight, behavior: 'auto' });
        }
      }
    }
  }, [selectedIndex, step]);

  const handleFinish = (finalLabel?: string) => {
    const defaultLabel = filteredRelations[0]?.label || 'relateret til';
    const actualLabel = finalLabel || label.trim() || defaultLabel;

    const matchedRelation = filteredRelations.find(
      r => r.label.toLowerCase() === actualLabel.toLowerCase()
    );
    const resolvedType = matchedRelation?.description || undefined;

    if (!sourceId || !targetIdOrName || !actualLabel) return;

    let finalIsNewTarget = isNewTarget;
    let finalTargetIdOrName = targetIdOrName;

    if (isNewTarget) {
      const trimmedName = targetIdOrName.trim().toLowerCase();
      const existing = concepts.find((c) => {
        if (c.conceptType !== selectedType) return false;
        if (c.name.trim().toLowerCase() !== trimmedName) return false;

        if (selectedType === 'class') {
          const isCreatingConceptual = activeView?.type === 'conceptual_model';
          const isCreatingInformation = activeView?.type === 'information_model';

          const virtualType = getVirtualType(c, views);

          if (isCreatingConceptual && virtualType === 'conceptual_class') return true;
          if (isCreatingInformation && virtualType === 'information_class') return true;
          if (!isCreatingConceptual && !isCreatingInformation) return true;
          return false;
        }

        return true;
      });

      if (existing) {
        finalIsNewTarget = false;
        finalTargetIdOrName = existing.id;
      }
    }

    createQuickRelation({
      sourceId,
      targetIdOrName: finalTargetIdOrName,
      isNewTarget: finalIsNewTarget,
      targetType: selectedType,
      label: actualLabel,
      relationType: resolvedType
    });

    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    // Circular Tab Navigation (Focus Trap)
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    if (step === 'target') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(1, options.length));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + options.length) % Math.max(1, options.length));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = options[selectedIndex];
        if (selected) {
          setTargetIdOrName(selected.isNew ? query.trim() : selected.id);
          setIsNewTarget(selected.isNew);
          if (selected.isNew) {
            if (baseAllowedTypes.length === 1) {
              setSelectedType(baseAllowedTypes[0].type);
              setStep('label');
            } else {
              setStep('type');
            }
          } else {
            setStep('label');
          }
        }
      }
    } else if (step === 'type') {
      const COLS = 2;
      const visibleTypes = filteredTypes;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + COLS) % Math.max(1, visibleTypes.length));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - COLS + visibleTypes.length) % Math.max(1, visibleTypes.length));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(1, visibleTypes.length));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + visibleTypes.length) % Math.max(1, visibleTypes.length));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = visibleTypes[selectedIndex];
        if (selected) {
          const allowedRels = activeNotation?.getAvailableRelations && sourceNode
            ? activeNotation.getAvailableRelations(sourceNode.conceptType, selected.type)
            : [];
          const isCompatible = !activeNotation?.getAvailableRelations || allowedRels.length > 0;
          if (isCompatible) {
            setSelectedType(selected.type);
            setStep('label');
          }
        }
      }
      if (e.key === 'Backspace' && !typeSearch) {
        setStep('target');
      }
    } else if (step === 'label') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(1, filteredRelations.length));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filteredRelations.length) % Math.max(1, filteredRelations.length));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // If we have a selection in the list, use it. Otherwise use input or default.
        const selectedRel = filteredRelations[selectedIndex];
        if (selectedRel && label.trim() === '') {
          handleFinish(selectedRel.label);
        } else {
          handleFinish();
        }
      }
      if (e.key === 'Backspace' && !label) {
        setStep(isNewTarget && baseAllowedTypes.length > 1 ? 'type' : 'target');
      }
    }
  };

  const displayTarget = useMemo(() => {
    if (step === 'target') {
      const currentSelection = options[selectedIndex];
      if (currentSelection) return currentSelection.label;
      if (query) return `Create "${query}"`;
      return 'Select Target';
    }
    return isNewTarget ? targetIdOrName : targetNode?.name || 'Select Target';
  }, [step, options, selectedIndex, query, isNewTarget, targetIdOrName, targetNode]);

  const activeTargetType = useMemo(() => {
    if (step === 'target') {
      const currentSelection = options[selectedIndex];
      if (currentSelection) {
        if (currentSelection.isNew) return null;
        return (currentSelection.virtualType || currentSelection.description) as ConceptType | null;
      }
      return null;
    }
    if (step === 'type') {
      if (baseAllowedTypes.length === 1) {
        return baseAllowedTypes[0].type;
      }
      const highlighted = filteredTypes[selectedIndex];
      return highlighted ? highlighted.type : selectedType;
    }
    return isNewTarget ? selectedType : (targetNode?.conceptType || null);
  }, [step, options, selectedIndex, filteredTypes, baseAllowedTypes, selectedType, isNewTarget, targetNode]);

  const displayTargetType = useMemo(() => {
    if (!activeTargetType) return null;
    return getDisplayLabelForType(activeTargetType, activeNotation);
  }, [activeTargetType, activeNotation]);

  if (!open || !sourceNode) return null;

  const showRulesPanel = !!activeNotation?.getAvailableRelations;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Palette Container */}
      <div
        ref={containerRef}
        className={`bg-white/95 backdrop-blur-2xl w-full ${showRulesPanel ? 'max-w-4xl' : 'max-w-xl'} ${step === 'target' && !query.trim() ? 'h-auto' : 'h-[580px]'} max-h-[85vh] rounded-[28px] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.25)] border border-white/60 flex flex-col md:flex-row overflow-hidden transition-all duration-300 animate-in zoom-in-95`}
      >
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header Section */}
          <div className="px-8 pt-8 pb-5 flex items-start justify-between border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                <Workflow size={20} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">Opret relation</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                  Forbind noder i grafen
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all active:scale-90 shrink-0"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper Indicator */}
          <div className="px-8 py-3 bg-slate-50/50 border-b border-slate-100 flex gap-2">
            {[
              { id: 'target' as const, label: '01 Mål-node' },
              { id: 'type' as const, label: '02 Type' },
              { id: 'label' as const, label: '03 Relation' }
            ].map((s) => {
              const isActive = step === s.id;
              const isPast = (step === 'type' && s.id === 'target') || (step === 'label' && s.id !== 'label');
              const canGoTo = (s.id === 'target') ||
                (s.id === 'type' && isNewTarget && baseAllowedTypes.length > 1) ||
                (s.id === 'label' && targetIdOrName);

              return (
                <button
                  key={s.id}
                  onClick={() => canGoTo && setStep(s.id)}
                  disabled={!canGoTo}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 outline-none ${
                    isActive ? 'bg-slate-900 shadow-sm' :
                    isPast ? 'bg-slate-300 hover:bg-slate-400' : 'bg-slate-200'
                  } ${canGoTo ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  title={s.label}
                />
              );
            })}
          </div>

          {/* Context Bridge Visualizer */}
          <div className="px-8 py-4 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              {/* Source Side */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                  {sourceNode.conceptType === 'actor' ? <User size={13} /> :
                    sourceNode.conceptType === 'process' ? <Activity size={13} /> :
                      <Box size={13} />}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Kilde</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-slate-800 truncate uppercase">{sourceNode.name}</span>
                    <span className="px-1.5 py-0.5 bg-slate-200/60 text-slate-600 text-[8px] font-bold rounded uppercase tracking-tight">{sourceNode.conceptType}</span>
                  </div>
                </div>
              </div>

              {/* Connecting Line / Label */}
              <div className="flex-1 flex flex-col items-center justify-center relative min-w-[100px]">
                <div className="w-full h-px bg-slate-200 relative">
                  <div className="absolute -top-1.5 -right-1 text-slate-300">
                    <ChevronRight size={13} />
                  </div>
                </div>
                <button
                  onClick={() => targetIdOrName && setStep('label')}
                  disabled={!targetIdOrName}
                  className={`mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                    label
                      ? 'bg-slate-900 text-white shadow-sm'
                      : targetIdOrName
                      ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {label || (step === 'label' ? 'Vælg...' : '...')}
                </button>
              </div>

              {/* Target Side */}
              <button
                onClick={() => setStep('target')}
                className={`flex items-center gap-2.5 min-w-0 text-right transition-opacity ${step === 'target' ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="flex flex-col items-end min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Mål</span>
                  <div className="flex items-center gap-1.5">
                    {displayTargetType && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[8px] font-bold rounded uppercase tracking-tight">{displayTargetType}</span>
                    )}
                    <span className="text-[12px] font-bold text-slate-800 truncate uppercase">
                      {displayTarget}
                    </span>
                  </div>
                </div>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-sm ${
                  targetIdOrName ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-300'
                }`}>
                  {isNewTarget ? <Plus size={13} /> : targetNode ? <Box size={13} /> : <Search size={13} />}
                </div>
              </button>
            </div>
          </div>

          {/* Search / Input Area */}
          <div className="px-8 py-5">
            {step === 'target' ? (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:bg-white focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all shadow-sm">
                <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={options.length > 0}
                  aria-autocomplete="list"
                  aria-controls="relation-combobox-list"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Søg eller opret mål-node..."
                  className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>
            ) : step === 'type' ? (
              baseAllowedTypes.length === 1 ? (
                <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5">
                  <Shield size={16} className="text-slate-600 shrink-0" />
                  <div className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">
                    Type er fastsat til {baseAllowedTypes[0].label} under denne notation
                  </div>
                </div>
              ) : (
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:bg-white focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all shadow-sm">
                  <Plus size={14} className="text-slate-400 mr-2 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Hvilken archetype er "${targetIdOrName}"?`}
                    className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-300"
                  />
                </div>
              )
            ) : (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:bg-white focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all shadow-sm">
                <ArrowRight size={14} className="text-slate-400 mr-2 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Relationstype? (Tryk Enter for 'relateret til')"
                  className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden px-8 pb-6">
            <div className="flex-1 min-h-0">
              {step === 'target' ? (
                !query.trim() ? (
                  <div className="py-4 px-2 flex flex-col items-center justify-center text-center gap-1.5 text-slate-400">
                    <Search size={18} className="text-slate-300 mb-0.5" />
                    <span className="text-[12px] font-bold text-slate-600">Søg eller opret en mål-node</span>
                    <span className="text-[10px] text-slate-400 max-w-xs leading-normal">
                      Begynd at skrive i søgefeltet ovenfor for at vælge eksisterende noder eller oprette en ny.
                    </span>
                  </div>
                ) : (
                  <div ref={listRef} role="listbox" id="relation-combobox-list" className="h-full relative overflow-y-auto custom-scrollbar pr-1 pt-1 pb-4 flex flex-col gap-2">
                    {options.map((opt, idx) => (
                      <button
                        key={opt.id === 'new' ? `new-${query}` : opt.id}
                        role="option"
                        aria-selected={idx === selectedIndex}
                        onClick={() => {
                          setTargetIdOrName(opt.isNew ? query.trim() : opt.id);
                          setIsNewTarget(opt.isNew);
                          if (opt.isNew) {
                            if (baseAllowedTypes.length === 1) {
                              setSelectedType(baseAllowedTypes[0].type);
                              setStep('label');
                            } else {
                              setStep('type');
                            }
                          } else {
                            setStep('label');
                          }
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98] outline-none ${
                          idx === selectedIndex
                            ? 'border-slate-300 bg-slate-100/90 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            idx === selectedIndex ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {opt.isNew ? <Plus size={16} strokeWidth={2.5} /> : <Box size={16} />}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-slate-900' : 'text-slate-800'}`}>
                              {opt.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${idx === selectedIndex ? 'text-slate-600' : 'text-slate-400'}`}>
                                {opt.isNew ? 'PROPOSER NY' : getDisplayLabelForType(opt.virtualType || opt.description, activeNotation)}
                              </span>
                              {!opt.isNew && activeNotation?.getAvailableRelations && (
                                <>
                                  <span className="text-[10px] text-slate-300">•</span>
                                  <div className="flex flex-wrap gap-1">
                                    {activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).slice(0, 3).map(r => (
                                      <span key={r.id} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/50 text-slate-500 rounded text-[8px] font-bold uppercase tracking-tight">
                                        {r.label}
                                      </span>
                                    ))}
                                    {activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).length > 3 && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/50 text-slate-400 rounded text-[8px] font-bold uppercase tracking-tight">
                                        +{activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).length - 3} Mere
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {idx === selectedIndex && (
                          <div className="shrink-0 ml-auto w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                            <ChevronRight size={12} strokeWidth={3} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    {options.length > 0 && <div className="h-2 shrink-0" />}
                  </div>
                )
              ) : step === 'type' ? (
                baseAllowedTypes.length === 1 ? (
                  /* Single type fallback view */
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-sm">
                      {baseAllowedTypes[0].icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">{baseAllowedTypes[0].label}</h3>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Automatisk valgt type</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedType(baseAllowedTypes[0].type);
                        setStep('label');
                      }}
                      className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all"
                    >
                      Fortsæt til relation
                    </button>
                  </div>
                ) : (
                  <div ref={listRef} className="h-full relative grid grid-cols-1 sm:grid-cols-2 content-start gap-2.5 overflow-y-auto custom-scrollbar pr-1 pt-1 pb-4">
                    {filteredTypes.map((ct, idx) => {
                      const allowedRels = activeNotation?.getAvailableRelations
                        ? activeNotation.getAvailableRelations(sourceNode.conceptType, ct.type)
                        : [];
                      const isCompatible = !activeNotation?.getAvailableRelations || allowedRels.length > 0;

                      return (
                        <button
                          key={ct.type}
                          disabled={!isCompatible}
                          onClick={() => {
                            setSelectedType(ct.type);
                            setStep('label');
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-150 outline-none ${
                            idx === selectedIndex
                              ? 'border-slate-300 bg-slate-100/90 shadow-sm'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'
                          } ${!isCompatible ? 'opacity-40 cursor-not-allowed border-dashed' : ''}`}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${idx === selectedIndex ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                              {ct.icon}
                            </div>
                            {isCompatible && allowedRels.length > 0 && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                {allowedRels.length} {allowedRels.length === 1 ? 'Regel' : 'Regler'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col text-left w-full">
                            <span className={`text-[9px] uppercase font-bold tracking-widest ${idx === selectedIndex ? 'text-slate-600' : 'text-slate-400'}`}>
                              {ct.type.replace('_', ' ')}
                            </span>
                            <span className="text-[13px] font-bold text-slate-800 mt-0.5">{ct.label}</span>
                          </div>
                        </button>
                      );
                    })}
                    {filteredTypes.length > 0 && <div className="col-span-1 sm:col-span-2 h-2" />}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col gap-4">
                  <div ref={listRef} className="flex-1 relative overflow-y-auto custom-scrollbar pr-1 pt-1 pb-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Almindelige relationer</div>
                    {filteredRelations.map((rel, idx) => (
                      <button
                        key={rel.id}
                        onClick={() => handleFinish(rel.label)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 text-left transition-all duration-150 outline-none ${
                          idx === selectedIndex
                            ? 'border-slate-300 bg-slate-100/90 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${idx === selectedIndex ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                            {rel.icon}
                          </div>
                          <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-slate-900' : 'text-slate-800'}`}>{rel.label}</span>
                        </div>
                        {idx === selectedIndex && (
                          <div className="shrink-0 ml-auto w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                            <ChevronRight size={12} strokeWidth={3} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    {filteredRelations.length > 0 && <div className="h-2 shrink-0" />}
                    {filteredRelations.length === 0 && (
                      <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                        Ingen tilladte relationer under denne notation
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex gap-6 items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500 shadow-sm">ESC</kbd>
                <span>Annuller</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500 shadow-sm">↑↓</kbd>
                <span>Naviger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500 shadow-sm">↵</kbd>
                <span>Vælg</span>
              </div>
            </div>

            <button
              ref={createBtnRef}
              onClick={() => handleFinish()}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
            >
              <Workflow size={15} />
              {label ? `Befæst "${label}"` : 'Bekræft relation'}
            </button>
          </div>
        </div>

        {showRulesPanel && (
          <div className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-slate-100 bg-slate-50/50 backdrop-blur-sm p-6 flex flex-col overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[16px]">🏛️</span>
              <div>
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wider">ArchiMate Regler</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Specifikation §12.2</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {/* Context Summary */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200/60 shadow-sm">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Aktiv Kontekst</div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <span className="w-4 h-4 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center text-[9px] font-black shrink-0">S</span>
                    <span className="truncate max-w-[110px]">{sourceNode.name}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase font-bold shrink-0">{activeNotation?.conceptTypeLabels?.[sourceNode.conceptType] || sourceNode.conceptType}</span>
                  </div>
                  {targetNode || targetIdOrName ? (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                      <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 flex items-center justify-center text-[9px] font-black shrink-0">T</span>
                      <span className="truncate max-w-[110px]">{targetNode?.name || targetIdOrName}</span>
                      {activeTargetType ? (
                        <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded uppercase font-bold shrink-0">
                          {activeNotation?.conceptTypeLabels?.[activeTargetType] || activeTargetType}
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded uppercase font-bold shrink-0">
                          Ikke valgt
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-slate-400">Vælg mål-node for at se aktive regler...</div>
                  )}
                </div>
              </div>

              {/* Rules List */}
              <div className="flex-1 flex flex-col gap-2.5">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  {activeTargetType ? 'Tilladte Relationer' : `Relationer fra ${activeNotation?.conceptTypeLabels?.[sourceNode.conceptType] || sourceNode.conceptType}`}
                </div>

                {(() => {
                  const targetT = activeTargetType;
                  if (targetT) {
                    const allowedRels = activeNotation.getAvailableRelations?.(sourceNode.conceptType, targetT) || [];
                    if (allowedRels.length === 0) {
                      return (
                        <div className="text-center py-4 bg-rose-50/50 border border-dashed border-rose-200 rounded-xl p-3">
                          <span className="text-[12px] font-bold text-rose-600 block mb-0.5">Ingen gyldige relationer</span>
                          <span className="text-[10px] text-rose-500/80 leading-relaxed block">
                            ArchiMate specifikationerne tillader ikke forbindelser mellem disse archetyper.
                          </span>
                        </div>
                      );
                    }
                    return allowedRels.map(r => {
                      const desc = RELATIONSHIP_DESCRIPTIONS[r.id] || { label: r.label, symbol: '—', desc: 'Relation' };
                      return (
                        <div key={r.id} className="bg-white border border-slate-200/60 rounded-xl p-3 hover:border-slate-300 transition-all shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold text-slate-800">{desc.label}</span>
                            <span className="text-[9px] font-bold font-mono text-slate-600 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 shrink-0">{desc.symbol}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{desc.desc}</p>
                        </div>
                      );
                    });
                  }

                  // If no target selected yet, summarize outgoing options from source type
                  const allTypes = activeNotation?.allowedConceptTypes || [];
                  const optionsWithRules = allTypes
                    .map(t => {
                      const rels = activeNotation.getAvailableRelations?.(sourceNode.conceptType, t) || [];
                      return { type: t, rels };
                    })
                    .filter(o => o.rels.length > 0);

                  if (optionsWithRules.length === 0) {
                    return (
                      <div className="text-[10px] text-slate-400 italic">Ingen udgående forbindelser tilladt for denne archetype.</div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-1.5">
                      {optionsWithRules.map(o => (
                        <div key={o.type} className="flex items-start justify-between gap-2 text-[10px] py-1.5 border-b border-slate-100">
                          <span className="font-bold text-slate-600 uppercase tracking-tight shrink-0">
                            {activeNotation?.conceptTypeLabels?.[o.type] || o.type}
                          </span>
                          <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                            {o.rels.map(r => (
                              <span key={r.id} className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-bold uppercase tracking-tighter">
                                {r.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
