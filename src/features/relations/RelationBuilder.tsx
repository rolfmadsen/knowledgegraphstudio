import { useState, useRef, useEffect, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { ConceptType } from '../../schema/graphSchema';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { GraphService } from '../../services/GraphService';
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

    const results = q ? fuse.search(q).map(r => r.item) : notationFiltered.slice(0, 10);

    const finalOptions: RelationOption[] = results.map(c => ({
      id: c.id,
      label: c.name,
      description: c.conceptType,
      virtualType: GraphService.getVirtualType(c, views),
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

          const virtualType = GraphService.getVirtualType(c, views);

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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-12">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={() => setOpen(false)}
      />

      {/* Palette Container (Modern Pro) */}
      <div
        ref={containerRef}
        className={`relative w-full ${showRulesPanel ? 'max-w-[980px]' : 'max-w-[700px]'} h-[720px] max-h-[85vh] bg-slate-50/95 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-300 transition-all duration-500`}
      >
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header Section */}
          <div className="px-10 pt-10 pb-6 border-b border-slate-200/50">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <Workflow size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Relation Builder</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Graph</span>
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest italic">New Relation</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="flex gap-2">
              {[
                { id: 'target' as const, label: '01 Target' },
                { id: 'type' as const, label: '02 Archetype' },
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
                    className={`flex-1 h-1.5 rounded-full transition-all duration-500 outline-none ${isActive ? 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]' :
                      isPast ? 'bg-emerald-200 hover:bg-emerald-300' : 'bg-slate-200'
                      } ${canGoTo ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Context Bridge (Modern Pro Visualizer) */}
          <div className="px-10 py-6 bg-slate-100/50 border-b border-slate-200/30">
            <div className="flex items-center justify-between gap-4">
              {/* Source Side */}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 min-w-0 hover:bg-white/50 p-1 rounded-lg transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 shadow-sm group-hover:border-emerald-200 group-hover:text-emerald-500 transition-all">
                  {sourceNode.conceptType === 'actor' ? <User size={14} /> :
                    sourceNode.conceptType === 'process' ? <Activity size={14} /> :
                      <Box size={14} />}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Source</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-700 truncate uppercase">{sourceNode.name}</span>
                    <span className="px-1.5 py-0.5 bg-slate-200/50 text-slate-500 text-[8px] font-black rounded uppercase tracking-tighter border border-slate-200/30">{sourceNode.conceptType}</span>
                  </div>
                </div>
              </button>

              {/* Connecting Line / Label */}
              <div className="flex-1 flex flex-col items-center justify-center relative min-w-[120px]">
                <div className="w-full h-px bg-slate-300 relative">
                  <div className="absolute -top-1.5 -right-1.5 text-slate-300">
                    <ChevronRight size={14} />
                  </div>
                </div>
                <button
                  onClick={() => targetIdOrName && setStep('label')}
                  disabled={!targetIdOrName}
                  className={`mt-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${label ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-110' :
                    targetIdOrName ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-400 border-slate-200'
                    }`}>
                  {label || (step === 'label' ? 'Defining...' : '...')}
                </button>
              </div>

              {/* Target Side */}
              <button
                onClick={() => setStep('target')}
                className={`flex items-center gap-3 min-w-0 transition-all duration-500 hover:bg-white/50 p-1 rounded-lg group ${step === 'target' ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className="flex flex-col items-end min-w-0 text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target</span>
                  <div className="flex items-center gap-2">
                    {displayTargetType && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black rounded uppercase tracking-tighter border border-emerald-200/30">{displayTargetType}</span>
                    )}
                    <span className="text-[13px] font-bold text-slate-700 truncate uppercase">
                      {displayTarget}
                    </span>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 ${targetIdOrName ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-100 text-slate-200'
                  }`}>
                  {isNewTarget ? <Plus size={14} /> : targetNode ? <Box size={14} /> : <Search size={14} />}
                </div>
              </button>
            </div>
          </div>

          {/* Search / Input Area */}
          <div className="px-10 py-8">
            {step === 'target' ? (
              <div className="group relative flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all shadow-sm">
                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Find or propose target concept..."
                  className="flex-1 bg-transparent text-[15px] font-bold text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>
            ) : step === 'type' ? (
              baseAllowedTypes.length === 1 ? (
                <div className="group relative flex items-center gap-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl px-5 py-4 transition-all">
                  <div className="text-emerald-500"><Shield size={20} /></div>
                  <div className="text-[13px] font-bold text-emerald-700 uppercase tracking-wider">
                    Type er fastsat til {baseAllowedTypes[0].label} under denne notation
                  </div>
                </div>
              ) : (
                <div className="group relative flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all shadow-sm">
                  <div className="text-emerald-500 pr-1"><Plus size={20} strokeWidth={3} /></div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`What archetype is "${targetIdOrName}"?`}
                    className="flex-1 bg-transparent text-[15px] font-bold text-slate-800 outline-none placeholder:text-slate-300"
                  />
                </div>
              )
            ) : (
              <div className="group relative flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all shadow-sm">
                <ArrowRight className="w-5 h-5 text-emerald-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nature of relation? (Enter for 'relateret til')"
                  className="flex-1 bg-transparent text-[15px] font-bold text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden px-10 pb-10">
            <div className="flex-1 min-h-0">
              {step === 'target' ? (
                <div ref={listRef} className="h-full relative overflow-y-auto custom-scrollbar pr-2 pt-2 pb-6 flex flex-col gap-2">
                  {options.map((opt, idx) => (
                    <button
                      key={opt.id === 'new' ? `new-${query}` : opt.id}
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
                      className={`
                      w-full flex items-center justify-between p-4 rounded-[1.25rem] border transition-all duration-200 group outline-none
                      ${idx === selectedIndex
                          ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-200/20 translate-x-1 ring-1 ring-emerald-500/10'
                          : 'bg-transparent border-transparent hover:bg-white/50 hover:border-slate-200'}
                    `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-300'}`}>
                          {opt.isNew ? <Plus size={18} strokeWidth={2.5} /> : <Box size={18} />}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-slate-900' : 'text-slate-600'}`}>{opt.label}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${idx === selectedIndex ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {opt.isNew ? 'PROPOSE NEW' : getDisplayLabelForType(opt.virtualType || opt.description, activeNotation)}
                            </span>
                            {!opt.isNew && activeNotation?.getAvailableRelations && (
                              <>
                                <span className="text-[10px] text-slate-300">•</span>
                                <div className="flex flex-wrap gap-1">
                                  {activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).slice(0, 3).map(r => (
                                    <span key={r.id} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/50 text-slate-500 rounded text-[8px] font-black uppercase tracking-tight">
                                      {r.label}
                                    </span>
                                  ))}
                                  {activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).length > 3 && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/50 text-slate-400 rounded text-[8px] font-black uppercase tracking-tight">
                                      +{activeNotation.getAvailableRelations(sourceNode.conceptType, opt.description as ConceptType).length - 3} More
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {idx === selectedIndex && (
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest">Select</span>
                          <ChevronRight size={14} className="text-emerald-500" />
                        </div>
                      )}
                    </button>
                  ))}
                  {options.length > 0 && <div className="h-4 shrink-0" />}
                </div>
              ) : step === 'type' ? (
                baseAllowedTypes.length === 1 ? (
                  /* Single type fallback view */
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-md">
                      {baseAllowedTypes[0].icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">{baseAllowedTypes[0].label}</h3>
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-1">Automatisk valgt type</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedType(baseAllowedTypes[0].type);
                        setStep('label');
                      }}
                      className="mt-4 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all"
                    >
                      Fortsæt til relation
                    </button>
                  </div>
                ) : (
                  <div ref={listRef} className="h-full relative grid grid-cols-1 sm:grid-cols-2 content-start gap-3 overflow-y-auto custom-scrollbar pr-2 pt-2 pb-6">
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
                          className={`
                          flex flex-col gap-4 p-5 rounded-[1.25rem] border transition-all duration-300 group outline-none
                          ${idx === selectedIndex
                              ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-200/20 -translate-y-1 ring-1 ring-emerald-500/10'
                              : 'bg-white/40 border-slate-100 hover:bg-white hover:border-slate-200'}
                          ${!isCompatible ? 'opacity-40 cursor-not-allowed border-dashed' : ''}
                        `}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-300'}`}>
                              {ct.icon}
                            </div>
                            {isCompatible && allowedRels.length > 0 && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                                {allowedRels.length} {allowedRels.length === 1 ? 'Rule' : 'Rules'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col text-left w-full">
                            <span className={`text-[10px] uppercase font-black tracking-widest ${idx === selectedIndex ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {ct.type.replace('_', ' ')}
                            </span>
                            <span className="text-[13px] font-black text-slate-800 mt-0.5">{ct.label}</span>
                            {activeNotation?.getAvailableRelations && (
                              <div className="flex flex-wrap items-center gap-1 mt-2.5">
                                {allowedRels.length > 0 ? (
                                  allowedRels.slice(0, 3).map(r => (
                                    <span key={r.id} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tight">
                                      {r.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] font-bold text-rose-500 uppercase">
                                    No Valid Connections
                                  </span>
                                )}
                                {allowedRels.length > 3 && (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[8px] font-black uppercase tracking-tight">
                                    +{allowedRels.length - 3} More
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {filteredTypes.length > 0 && <div className="col-span-1 sm:col-span-2 h-4" />}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col gap-6">
                  <div ref={listRef} className="flex-1 relative overflow-y-auto custom-scrollbar pr-2 pt-2 pb-6 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Common Relations</div>
                    {filteredRelations.map((rel, idx) => (
                      <button
                        key={rel.id}
                        onClick={() => handleFinish(rel.label)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`
                        w-full flex items-center justify-between p-4 rounded-[1.25rem] border transition-all duration-200 group outline-none
                        ${idx === selectedIndex
                            ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-200/20 translate-x-1 ring-1 ring-emerald-500/10'
                            : 'bg-transparent border-transparent hover:bg-white/50 hover:border-slate-200'}
                      `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-300'}`}>
                            {rel.icon}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-slate-900' : 'text-slate-600'}`}>{rel.label}</span>
                          </div>
                        </div>
                        {idx === selectedIndex && (
                          <div className="flex items-center gap-2 pr-2">
                            <span className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest">Use</span>
                            <ChevronRight size={14} className="text-emerald-500" />
                          </div>
                        )}
                      </button>
                    ))}
                    {filteredRelations.length > 0 && <div className="h-4 shrink-0" />}
                    {filteredRelations.length === 0 && (
                      <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                        Ingen tilladte relationer under denne notation
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-6 pt-4 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
                        Connecting <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold uppercase text-[10px]">{sourceNode.name}</span>
                        <span className="mx-2 text-slate-300">→</span>
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold uppercase text-[10px]">{isNewTarget ? targetIdOrName : concepts.find(c => c.id === targetIdOrName)?.name}</span>
                      </p>
                    </div>
                    <button
                      ref={createBtnRef}
                      onClick={() => handleFinish()}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 font-bold text-[14px] shadow-xl shadow-slate-900/20 focus:ring-[6px] focus:ring-emerald-500 focus:scale-[1.01] outline-none transition-all flex items-center justify-center gap-2"
                    >
                      {label ? `Confirm "${label}"` : 'Confirm "relateret til"'}
                      <div className="w-5 h-5 bg-slate-700 rounded-lg flex items-center justify-center text-[10px] font-black">↵</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer / Shortcuts */}
          <div className="px-10 py-6 bg-white/50 border-t border-slate-200/50 flex items-center justify-between">
            <div className="flex gap-8 items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm">ESC</kbd>
                <span>Cancel</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm">↵</kbd>
                <span>Connect</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Active Session
            </div>
          </div>
        </div>

        {showRulesPanel && (
          <div className="w-full md:w-[350px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200/60 bg-white/60 backdrop-blur-sm p-8 flex flex-col overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[18px]">🏛️</span>
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">ArchiMate Rules</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Specification §12.2</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-5">
              {/* Context Summary */}
              <div className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200/30">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Active Context</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                    <span className="w-4 h-4 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center text-[10px] font-black shrink-0">S</span>
                    <span className="truncate max-w-[120px]">{sourceNode.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase font-black tracking-tighter shrink-0">{activeNotation?.conceptTypeLabels?.[sourceNode.conceptType] || sourceNode.conceptType}</span>
                  </div>
                  {targetNode || targetIdOrName ? (
                    <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                      <span className="w-4 h-4 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">T</span>
                      <span className="truncate max-w-[120px]">{targetNode?.name || targetIdOrName}</span>
                      {activeTargetType ? (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded uppercase font-black tracking-tighter shrink-0">
                          {activeNotation?.conceptTypeLabels?.[activeTargetType] || activeTargetType}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded uppercase font-black tracking-tighter shrink-0">
                          Not Selected
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] italic text-slate-400">Select target node to view active rules...</div>
                  )}
                </div>
              </div>

              {/* Rules List */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {activeTargetType ? 'Allowed Relationships' : `Relationships from ${activeNotation?.conceptTypeLabels?.[sourceNode.conceptType] || sourceNode.conceptType}`}
                </div>

                {(() => {
                  const targetT = activeTargetType;
                  if (targetT) {
                    const allowedRels = activeNotation.getAvailableRelations?.(sourceNode.conceptType, targetT) || [];
                    if (allowedRels.length === 0) {
                      return (
                        <div className="text-center py-6 bg-rose-50/50 border border-dashed border-rose-200 rounded-2xl p-4">
                          <span className="text-[13px] font-bold text-rose-600 block mb-1">No Valid Relations</span>
                          <span className="text-[10px] text-rose-500/80 leading-relaxed block">
                            ArchiMate specifications do not permit connections between these concept archetypes.
                          </span>
                        </div>
                      );
                    }
                    return allowedRels.map(r => {
                      const desc = RELATIONSHIP_DESCRIPTIONS[r.id] || { label: r.label, symbol: '—', desc: 'Relation' };
                      return (
                        <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-3.5 hover:border-emerald-200 transition-all shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[12px] font-black text-slate-800">{desc.label}</span>
                            <span className="text-[10px] font-black font-mono text-emerald-600 px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100/50 shrink-0">{desc.symbol}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 leading-relaxed">{desc.desc}</p>
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
                      <div className="text-[11px] text-slate-400 italic">No outgoing connections allowed for this archetype.</div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-2">
                      {optionsWithRules.map(o => (
                        <div key={o.type} className="flex items-start justify-between gap-3 text-[11px] py-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600 uppercase tracking-tight shrink-0">
                            {activeNotation?.conceptTypeLabels?.[o.type] || o.type}
                          </span>
                          <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                            {o.rels.map(r => (
                              <span key={r.id} className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded-[4px] text-[8px] font-bold uppercase tracking-tighter">
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
