/**
 * Event Modeling Notation
 *
 * Implements the full Event Modeling alphabet as a KGS notation plugin:
 *   - Screen        → yellow (UI Wireframe)
 *   - Command       → blue   (User Intent — Gherkin policies attached here)
 *   - event         → amber  (Domain Event — fact recorded in history)
 *   - read_model    → green  (View Projection)
 *   - integration_event → purple (External I/O)
 *   - automation    → rose   (Logic / Sagas)
 *   - em_chapter    → transparent dashed (horizontal chapter grouping)
 *   - em_slice      → light grey (vertical use-case slice with actor label)
 *
 * Layout: two-pass swimlane (see layout.ts).
 * Connections: strict EM alphabet rules via validator.ts.
 * Gherkin: exposed via InspectorComponent on Command nodes only.
 */

import { useMemo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Notation, NotationCanvasProps, QuickActionConfig } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { useGraphStore } from '../../store/useGraphStore';
import { eventModelingLayoutEngine } from './layout';
import { LineageSyncModal } from './LineageSyncModal';
import { PayloadSpecModal } from './PayloadSpecModal';
import { isValidRelation, getAvailableRelations } from './validator';
import { InspectorSection } from '../../features/properties/Inspector';
import { type Policy } from '../../schema/graphSchema';
import type {
  ConceptNode,
  ConceptProperty,
  ConceptRelation,
  ConceptType,
  DataType,
  ElementId,
} from '../../schema/graphSchema';

// ============================================================
// Shared type for node data
// ============================================================

interface EmNodeData extends Record<string, unknown> {
  name: string;
  type: string;
  concept: ConceptNode;
}

type EmNodeType = Node<EmNodeData, 'conceptNode'>;

// ============================================================
// Style map per EM type
// ============================================================

const EM_STYLES: Record<
  string,
  { bg: string; border: string; label: string; badge: string; badgeText: string }
> = {
  screen: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    label: 'text-yellow-700',
    badge: 'bg-yellow-100 border-yellow-300',
    badgeText: 'text-yellow-700',
  },
  command: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    label: 'text-blue-700',
    badge: 'bg-blue-100 border-blue-300',
    badgeText: 'text-blue-700',
  },
  event: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    label: 'text-amber-700',
    badge: 'bg-amber-100 border-amber-300',
    badgeText: 'text-amber-700',
  },
  read_model: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    label: 'text-emerald-700',
    badge: 'bg-emerald-100 border-emerald-300',
    badgeText: 'text-emerald-700',
  },
  integration_event: {
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    label: 'text-purple-700',
    badge: 'bg-purple-100 border-purple-300',
    badgeText: 'text-purple-700',
  },
  automation: {
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    label: 'text-rose-700',
    badge: 'bg-rose-100 border-rose-300',
    badgeText: 'text-rose-700',
  },
};

const EM_TYPE_LABELS: Record<string, string> = {
  screen: 'Screen',
  command: 'Command',
  event: 'Domain Event',
  read_model: 'Read Model',
  integration_event: 'Integration Event',
  automation: 'Automation',
  em_chapter: 'Chapter',
  em_slice: 'Slice',
};

// ============================================================
// em_chapter — horizontal chapter container
// ============================================================

function EmChapterNode({ data, selected }: NodeProps<EmNodeType>) {
  const order = (data as any).order;

  return (
    <div
      className={`
        w-full h-full border-2 border-dashed rounded-3xl transition-all duration-300 font-sans
        ${selected
          ? 'border-slate-500 bg-slate-50/10 ring-4 ring-slate-200 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      {/* Chapter header — sits at top-left corner */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 pointer-events-none select-none">
        <span className="px-3 py-0.5 bg-white border border-slate-300 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
          {order !== undefined ? `[${order}] Chapter` : 'Chapter'}
        </span>
        <span className="px-3 py-0.5 bg-slate-900 text-white rounded-full text-[10px] font-bold tracking-tight shadow-sm">
          {data.concept?.name || 'Untitled'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// em_slice — vertical use-case slice with actor label
// ============================================================

function EmSliceNode({ data, selected }: NodeProps<EmNodeType>) {
  // Actor is stored in the `definition` field of the concept
  const actor = data.concept?.definition || null;
  const order = (data as any).order;

  return (
    <div
      className={`
        w-full h-full rounded-2xl transition-all duration-300 font-sans relative
        ${selected
          ? 'bg-slate-100/80 ring-2 ring-slate-300 shadow-sm'
          : 'bg-slate-50/50 hover:bg-slate-100/40'}
      `}
      style={{ border: '1px solid #e2e8f0' }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      {/* Slice label + actor — sits at top of slice */}
      <div className="flex flex-col gap-0.5 px-3 pt-2 pointer-events-none select-none">
        <div className="flex items-center justify-between gap-1">
          {actor ? (
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">
              👤 {actor}
            </span>
          ) : <span />}
          {order !== undefined && (
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold font-mono">
              #{order}
            </span>
          )}
        </div>
        <span
          className={`text-[11px] font-bold tracking-tight truncate ${selected ? 'text-slate-900' : 'text-slate-600'}`}
        >
          {data.concept?.name || 'Untitled Slice'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Combobox Property Filtering & Fuzzy Logic Search Helpers
// ============================================================

export interface PropertyItem {
  classId: ElementId;
  className: string;
  propId: ElementId;
  propName: string;
  propType: string;
}

export function isAlreadyInPayload(p: PropertyItem, payload: any[]): boolean {
  const pClassIdLower = String(p.classId).toLowerCase();
  const pClassNameLower = p.className.toLowerCase();
  const pPropIdLower = String(p.propId).toLowerCase();
  const pPropNameLower = p.propName.toLowerCase();
  const pFullNameLower = `${pClassNameLower}.${pPropNameLower}`;

  return payload.some((attr: any) => {
    const attrClassIdLower = attr.classId ? String(attr.classId).toLowerCase() : '';
    const attrPropIdLower = attr.propertyId ? String(attr.propertyId).toLowerCase() : '';
    const attrNameLower = attr.name ? String(attr.name).toLowerCase() : '';

    // Match 1: Class ID or Class Name match AND Property ID or Property Name match
    if (attrClassIdLower && (attrClassIdLower === pClassIdLower || attrClassIdLower === pClassNameLower)) {
      if (attrPropIdLower && attrPropIdLower === pPropIdLower) return true;
      if (attrNameLower === pPropNameLower) return true;
    }

    // Match 2: Full "ClassName.propName" match in attr.name
    if (attrNameLower === pFullNameLower) return true;

    // Match 3: Direct Property ID match
    if (attrPropIdLower && attrPropIdLower === pPropIdLower) return true;

    return false;
  });
}

function isFuzzySubsequence(pattern: string, text: string): boolean {
  let pIdx = 0;
  for (let tIdx = 0; tIdx < text.length && pIdx < pattern.length; tIdx++) {
    if (pattern[pIdx] === text[tIdx]) {
      pIdx++;
    }
  }
  return pIdx === pattern.length;
}

function scoreFuzzySequence(pattern: string, text: string): number {
  let pIdx = 0;
  let score = 0;
  let consecutiveMatches = 0;

  for (let tIdx = 0; tIdx < text.length && pIdx < pattern.length; tIdx++) {
    if (pattern[pIdx] === text[tIdx]) {
      pIdx++;
      consecutiveMatches++;
      score += 10 + consecutiveMatches * 5;
      if (tIdx === 0 || text[tIdx - 1] === '.' || text[tIdx - 1] === ' ') {
        score += 20;
      }
    } else {
      consecutiveMatches = 0;
    }
  }

  return pIdx === pattern.length ? score : 0;
}

export function fuzzyScore(query: string, className: string, propName: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const cls = className.toLowerCase();
  const prop = propName.toLowerCase();
  const full = `${cls}.${prop}`;
  const spaced = `${cls} ${prop}`;

  // Exact matches
  if (full === q) return 1000;
  if (prop === q) return 900;
  if (cls === q) return 850;

  // Prefix matches
  if (full.startsWith(q)) return 800;
  if (prop.startsWith(q)) return 750;
  if (cls.startsWith(q)) return 700;

  // Dot query (e.g. "org.last", "p.first")
  if (q.includes('.')) {
    const dotIndex = q.indexOf('.');
    const qCls = q.slice(0, dotIndex).trim();
    const qProp = q.slice(dotIndex + 1).trim();

    const clsMatches = !qCls || cls.startsWith(qCls) || cls.includes(qCls);
    const propMatches = !qProp || prop.startsWith(qProp) || prop.includes(qProp) || isFuzzySubsequence(qProp, prop);

    if (clsMatches && propMatches) {
      let score = 750;
      if (cls.startsWith(qCls)) score += 50;
      if (prop.startsWith(qProp)) score += 50;
      return score;
    }
  }

  // Substring matches
  if (full.includes(q)) return 500;
  if (spaced.includes(q)) return 480;
  if (prop.includes(q)) return 450;
  if (cls.includes(q)) return 400;

  // Fuzzy sequence matches
  const seqFull = scoreFuzzySequence(q, full);
  if (seqFull > 0) return seqFull;

  const seqProp = scoreFuzzySequence(q, prop);
  if (seqProp > 0) return seqProp;

  return 0;
}

export function getNodeAbsolutePosition(
  rfNode: { position: { x: number; y: number }; parentId?: string },
  getNode: (id: string) => { position: { x: number; y: number }; parentId?: string } | undefined
): { x: number; y: number } {
  let absX = rfNode.position.x;
  let absY = rfNode.position.y;
  let currParentId = rfNode.parentId;
  while (currParentId) {
    const parentNode = getNode(currParentId);
    if (parentNode) {
      absX += parentNode.position.x;
      absY += parentNode.position.y;
      currParentId = parentNode.parentId;
    } else {
      break;
    }
  }
  return { x: absX, y: absY };
}

function EmElementNode({ data, selected }: NodeProps<EmNodeType>) {
  const conceptType = (data.concept?.conceptType as string) ?? 'other';
  const style = EM_STYLES[conceptType];
  const typeLabel = EM_TYPE_LABELS[conceptType] ?? conceptType.toUpperCase();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isPayloadSpecModalOpen, setIsPayloadSpecModalOpen] = useState(false);
  const setSelectedConceptIds = useGraphStore((s) => s.setSelectedConceptIds);

  const updateConcept = useGraphStore((s) => s.updateConcept);
  const updateProperty = useGraphStore((s) => s.updateProperty);
  const addConcept = useGraphStore((s) => s.addConcept);
  const addProperty = useGraphStore((s) => s.addProperty);
  const allConcepts = useGraphStore((s) => s.concepts || []);

  const conceptId = data.concept?.id || (data as any).conceptId;
  const liveConcept = allConcepts.find((c) => c.id === conceptId) || data.concept;
  const payload: any[] = (liveConcept as any)?.payload || [];

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conceptId) {
      setSelectedConceptIds([conceptId]);
    }
    setIsPayloadSpecModalOpen(true);
  };

  const views = useGraphStore((s) => s.views || []);
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const activeView = views.find((v) => v.id === activeViewId);

  const accumulatedPrecedingEventAttributes = useMemo(() => {
    const set = new Set<string>();
    if (!activeView || !conceptId) return set;

    const currentNodeInView = activeView.nodes.find((n) => n.conceptId === conceptId);
    if (!currentNodeInView) return set;

    const conceptMap = new Map(allConcepts.map((c) => [c.id, c]));
    const precedingNodes = (activeView.nodes || []).filter((n) => {
      if (n.conceptId === currentNodeInView.conceptId) return false;
      const dx = currentNodeInView.x - n.x;
      if (dx >= 350) return true;
      if (Math.abs(dx) < 350) return n.y < currentNodeInView.y;
      return false;
    });

    precedingNodes.forEach((n) => {
      const c = conceptMap.get(n.conceptId);
      if (c) {
        const payloadArr: any[] = (c as any).payload || [];
        payloadArr.forEach((attr) => {
          const origin = attr.originType === 'auto' ? 'auto' : (attr.originType || (c.conceptType === 'screen' || c.conceptType === 'integration_event' ? 'ingress' : 'derived'));

          let isValid = false;
          if (origin === 'auto') isValid = true;
          else if (c.conceptType === 'event' || c.conceptType === 'integration_event') isValid = true;
          else if (c.conceptType === 'command') isValid = conceptType === 'event' || conceptType === 'integration_event' || conceptType === 'command' || conceptType === 'automation';
          else if (c.conceptType === 'screen') isValid = conceptType === 'command';
          else if (c.conceptType === 'read_model') isValid = conceptType === 'screen' || conceptType === 'automation' || conceptType === 'command';
          else if (origin === 'ingress') isValid = conceptType === 'command';

          if (isValid) {
            const attrNameLower = attr.name.toLowerCase().trim();
            const keyWithClass = attr.classId ? `${attr.classId}:${attrNameLower}` : `local:${attrNameLower}`;
            set.add(keyWithClass);
            if (!attr.classId) {
              set.add(`name:${attrNameLower}`);
            }
          }
        });
      }
    });

    return set;
  }, [activeView, conceptId, allConcepts]);

  const hasMissingSource = useMemo(() => {
    if (payload.length === 0) return false;
    for (const attr of payload) {
      const isNonIngressNode = conceptType === 'command' || conceptType === 'event' || conceptType === 'read_model' || conceptType === 'automation';
      const origin = attr.originType === 'auto' ? 'auto' : (isNonIngressNode ? 'derived' : (attr.originType || 'ingress'));
      if (origin === 'ingress' || origin === 'auto') continue;

      if (origin === 'derived') {
        const attrNameLower = attr.name.toLowerCase().trim();
        const keyWithClass = attr.classId ? `${attr.classId}:${attrNameLower}` : `local:${attrNameLower}`;
        const isSatisfied = attr.classId
          ? accumulatedPrecedingEventAttributes.has(keyWithClass)
          : (accumulatedPrecedingEventAttributes.has(keyWithClass) || accumulatedPrecedingEventAttributes.has(`name:${attrNameLower}`));

        if (!isSatisfied) return true;
      }
    }
    return false;
  }, [payload, conceptType, accumulatedPrecedingEventAttributes]);

  return (
    <div
      className={`
        relative w-[260px] min-w-[260px] min-h-[90px] px-5 py-4 border-2 rounded-2xl
        shadow-sm hover:shadow-md transition-all duration-200 font-sans flex flex-col justify-between
        ${style.bg} ${style.border}
        ${selected ? 'ring-4 ring-emerald-200 scale-[1.02] shadow-lg' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badge} ${style.badgeText} select-none`}
        >
          «{typeLabel}»
        </span>
        {/* Gherkin indicator: show on Command if policies exist */}
        {conceptType === 'command' && (data.concept as any)?.policies?.length > 0 && (
          <span
            title="Has Gherkin specifications"
            className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 select-none"
          >
            ✓ Spec
          </span>
        )}
      </div>

      <div className={`text-[14px] font-black tracking-tight leading-snug mt-2 break-words ${style.label}`}>
        {data.name || 'Untitled'}
      </div>

      {/* Status Pill Bar - Selecting concept opens Egenskaber sidebar */}
      <div className="mt-2 pt-1 border-t border-slate-200/80 text-[11px] font-sans">
        {payload.length === 0 ? (
          <button
            onClick={handleToggleExpand}
            className={`w-full py-1 px-2.5 flex items-center justify-between bg-white/60 hover:bg-white/90 border border-dashed ${style.border} rounded-xl ${style.label} font-sans text-[10px] font-bold transition-all group/btn`}
            title="Klik for at åbne og tilføje payload i Egenskaber panelet"
          >
            <span>+ Tilføj Payload</span>
            <span className="text-[9px] opacity-60 group-hover/btn:opacity-100 font-mono transition-opacity">
              ⚙️
            </span>
          </button>
        ) : (
          <button
            onClick={handleToggleExpand}
            className={`w-full py-1 px-2.5 flex items-center justify-between bg-white/80 hover:bg-white/95 border ${style.border} rounded-xl ${style.label} font-sans text-[10px] font-bold transition-all shadow-2xs group/btn`}
            title="Klik for at se og redigere payload i Egenskaber panelet"
          >
            <div className="flex items-center gap-1.5 truncate">
              {hasMissingSource ? (
                <span
                  className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-2xs animate-pulse"
                  title="Manglende kilde: Intet forudgående Domain Event emitter 1 eller flere felter i tidslinjen!"
                />
              ) : (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-2xs"
                  title="Fuldstændig payload: Felter er valideret og klar på tidslinjen."
                />
              )}
              <span className="truncate">Payload ({payload.length})</span>
            </div>
            <span className="text-[9px] opacity-70 group-hover/btn:opacity-100 font-mono">
              ⚙️
            </span>
          </button>
        )}
      </div>

        {/* Lineage Sync Interactive Modal */}
        {isSyncModalOpen && (
          <LineageSyncModal
            isOpen={isSyncModalOpen}
            onClose={() => setIsSyncModalOpen(false)}
            currentNode={{
              id: conceptId || (data.concept?.id as ElementId),
              name: data.name || 'Untitled',
              conceptType,
              payload,
            }}
            allConcepts={allConcepts}
            graphState={useGraphStore.getState() as any}
            activeViewId={activeViewId || ('' as ElementId)}
            updateConcept={updateConcept}
          />
        )}

        {/* Payload Specification Modal */}
        {isPayloadSpecModalOpen && (
          <PayloadSpecModal
            isOpen={isPayloadSpecModalOpen}
            onClose={() => setIsPayloadSpecModalOpen(false)}
            currentNode={{
              id: conceptId || (data.concept?.id as ElementId),
              name: data.name || 'Untitled',
              conceptType,
              payload,
            }}
            allConcepts={allConcepts}
            activeViewId={activeViewId || ('' as ElementId)}
            updateConcept={updateConcept}
            updateProperty={updateProperty}
            addConcept={addConcept}
            addProperty={addProperty}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
          />
        )}
    </div>
  );
}

// ============================================================
// Dispatcher: routes to the right node renderer
// ============================================================

function EventModelingNodeComponent(props: NodeProps<EmNodeType>) {
  const conceptType = (props.data.concept?.conceptType as string) ?? 'other';
  if (conceptType === 'em_chapter') return <EmChapterNode {...props} />;
  if (conceptType === 'em_slice') return <EmSliceNode {...props} />;
  return <EmElementNode {...props} />;
}

// ============================================================
// Canvas
// ============================================================

function EventModelingCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(
    () => ({ conceptNode: EventModelingNodeComponent }),
    [],
  );
  return <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />;
}

// ============================================================
// Inspector — Command: Gherkin Specification panel
//           — em_slice: Actor field
// ============================================================

// ── Gherkin helper functions ───────────────────────────────

function formatPoliciesToGherkinString(policies: Policy[]): string {
  const gherkinPolicies = policies.filter((p) => p.type === 'gherkin');
  if (gherkinPolicies.length === 0) return '';
  return gherkinPolicies.map((spec) => {
    let result = `Scenario: ${spec.name}\n`;
    if (spec.given && spec.given.length > 0 && spec.given[0] !== '') {
      result += spec.given.map((g, idx) => `  ${idx === 0 ? 'Given' : 'And'} ${g}`).join('\n') + '\n';
    }
    if (spec.when && spec.when.length > 0 && spec.when[0] !== '') {
      result += spec.when.map((w, idx) => `  ${idx === 0 ? 'When' : 'And'} ${w}`).join('\n') + '\n';
    }
    if (spec.then && spec.then.length > 0 && spec.then[0] !== '') {
      result += spec.then.map((t, idx) => `  ${idx === 0 ? 'Then' : 'And'} ${t}`).join('\n') + '\n';
    }
    return result;
  }).join('\n');
}

function parseGherkinStringToPolicies(text: string): Policy[] {
  const lines = text.split('\n');
  const policies: Policy[] = [];
  let currentSpec: any = null;
  let currentStep: 'given' | 'when' | 'then' | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line === '') continue;

    if (line.toLowerCase().startsWith('scenario:')) {
      if (currentSpec) {
        policies.push(currentSpec);
      }
      const name = line.substring(9).trim() || 'Specification';
      currentSpec = {
        id: `gherkin:spec-${Date.now()}-${policies.length}` as ElementId,
        name,
        tags: [],
        type: 'gherkin' as const,
        given: [],
        when: [],
        then: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active' as const,
      };
      currentStep = null;
    } else {
      if (!currentSpec) {
        currentSpec = {
          id: `gherkin:spec-${Date.now()}` as ElementId,
          name: 'Implicit Scenario',
          tags: [],
          type: 'gherkin' as const,
          given: [],
          when: [],
          then: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active' as const,
        };
      }

      const lower = line.toLowerCase();
      if (lower.startsWith('given ')) {
        currentStep = 'given';
        currentSpec.given.push(line.substring(6).trim());
      } else if (lower.startsWith('when ')) {
        currentStep = 'when';
        currentSpec.when.push(line.substring(5).trim());
      } else if (lower.startsWith('then ')) {
        currentStep = 'then';
        currentSpec.then.push(line.substring(5).trim());
      } else if (lower.startsWith('and ')) {
        if (currentStep) {
          currentSpec[currentStep].push(line.substring(4).trim());
        }
      } else {
        if (currentStep && currentSpec[currentStep].length > 0) {
          const lastIdx = currentSpec[currentStep].length - 1;
          currentSpec[currentStep][lastIdx] += ' ' + line;
        }
      }
    }
  }

  if (currentSpec) {
    policies.push(currentSpec);
  }

  return policies;
}

// ── Gherkin text area editor ───────────────────────────────

function GherkinTextEditor({
  concept,
  updateConcept,
}: {
  concept: ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<ConceptNode>) => void;
}) {
  const policies = concept.policies ?? [];
  const initialText = useMemo(() => formatPoliciesToGherkinString(policies), [policies]);
  const [localText, setLocalText] = useState(initialText);

  useEffect(() => {
    setLocalText(formatPoliciesToGherkinString(policies));
  }, [policies]);

  const handleBlur = () => {
    const updatedPolicies = parseGherkinStringToPolicies(localText);
    const nonGherkin = policies.filter((p) => p.type !== 'gherkin');
    updateConcept(concept.id, { policies: [...nonGherkin, ...updatedPolicies] });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        rows={6}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-mono text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all resize-y"
        placeholder="Scenario: Godkend Gyldig Ordre&#10;  Given Ordre status er 'pending'&#10;  When Godkend Ordre udføres&#10;  Then Ordre status bliver 'approved'"
      />
    </div>
  );
}

// ── DCR Rule Multi-Select Widget ───────────────────────────

interface DcrRuleSelectProps {
  label: string;
  description: string;
  placeholder: string;
  options: Array<{ id: string; name: string; sliceName?: string }>;
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function DcrRuleSelect({
  label,
  description,
  placeholder,
  options,
  selectedIds,
  onAdd,
  onRemove,
}: DcrRuleSelectProps) {
  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const availableOptions = options.filter((o) => !selectedIds.includes(o.id));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
        <span className="text-[9px] text-slate-400 ml-1 leading-normal">{description}</span>
      </div>

      {/* Selected list */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-col gap-1.5 ml-1">
          {selectedOptions.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200/50 rounded-xl text-[11px] text-slate-700">
              <span className="font-semibold truncate max-w-[200px]">
                {o.sliceName ? `👤 ${o.name} (${o.sliceName})` : `⚙️ ${o.name}`}
              </span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                className="text-slate-400 hover:text-red-500 transition-colors px-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown to add */}
      {availableOptions.length > 0 ? (
        <div className="relative">
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) onAdd(val);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[11px] font-semibold text-slate-500 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
          >
            <option value="">{placeholder}</option>
            {availableOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.sliceName ? `${o.name} (${o.sliceName})` : o.name}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 italic ml-1">
          Ingen tilgængelige valgmuligheder
        </div>
      )}
    </div>
  );
}

// ── Event Modeling Main Inspector ─────────────────────────

function EventModelingInspector({
  concept,
  updateConcept,
  concepts,
}: {
  concept: ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<ConceptNode>) => void;
  addProperty: (conceptId: ElementId, name: string, type: DataType, isRequired?: boolean) => void;
  updateProperty: (
    conceptId: ElementId,
    propertyId: ElementId,
    updates: Partial<ConceptProperty>,
  ) => void;
  deleteProperty: (conceptId: ElementId, propertyId: ElementId) => void;
  concepts: ConceptNode[];
}) {
  const { conceptType, id } = concept;

  // Retrieve relations and modifiers directly from Zustand via stable scalar selectors
  const relations = useGraphStore((s) => s.relations);
  const addRelation = useGraphStore((s) => s.addRelation);
  const deleteRelation = useGraphStore((s) => s.deleteRelation);

  const getSliceName = (conceptId: ElementId) => {
    const node = concepts.find((c) => c.id === conceptId);
    if (!node) return undefined;
    if (node.parentId) {
      const parent = concepts.find((c) => c.id === node.parentId);
      if (parent && parent.conceptType === 'em_slice') {
        return parent.name;
      }
    }
    return undefined;
  };

  // ── em_slice: actor label editor ──────────────────────────
  if (conceptType === 'em_slice') {
    return (
      <InspectorSection title="Actor (Swimlane)">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Actor name
          </label>
          <input
            type="text"
            value={concept.definition ?? ''}
            placeholder="e.g. Customer, Admin, System"
            onChange={(e) => updateConcept(id, { definition: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
          />
          <p className="text-[10px] text-slate-400 ml-1 leading-relaxed">
            Displayed as a swimlane label above the slice on the canvas.
          </p>
        </div>
      </InspectorSection>
    );
  }

  // ── command: Gherkin specification panel ──────────────────
  if (conceptType === 'command') {
    return (
      <InspectorSection title="Gherkin Specifikation">
        <div className="flex flex-col gap-3">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Skriv forretningsscenarier i Gherkin-syntaks (Given-When-Then).
          </p>
          <GherkinTextEditor concept={concept} updateConcept={updateConcept} />
        </div>
      </InspectorSection>
    );
  }

  // ── event & integration_event: DCR rule panel ─────────────
  if (conceptType === 'event' || conceptType === 'integration_event') {
    // List of other events to choose from
    const eventOptions = concepts
      .filter((c) => (c.conceptType === 'event' || c.conceptType === 'integration_event') && c.id !== id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sliceName: getSliceName(c.id),
      }));

    // Helper to identify DCR relation by type or name (supports relations created in both DCR and EM views)
    const isDcrType = (r: ConceptRelation, typeKey: string) => {
      const relType = (r.relationType || '').toLowerCase().trim();
      const relName = (r.name || '').toLowerCase().trim();
      return relType === typeKey || relType.includes(typeKey) || relName.includes(typeKey);
    };

    // 1. Condition Options (Preceding Events)
    const selectedConditions = relations
      .filter((r) => r.targetConceptId === id && isDcrType(r, 'condition'))
      .map((r) => r.sourceConceptId);

    const onAddCondition = (eventId: string) => {
      addRelation(eventId as ElementId, id, 'Condition', { relationType: 'has_condition' });
    };

    const onRemoveCondition = (eventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === eventId && r.targetConceptId === id && isDcrType(r, 'condition')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 2. Response Options (Succeeding Events)
    const selectedResponses = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'response'))
      .map((r) => r.targetConceptId);

    const onAddResponse = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Response', { relationType: 'has_response' });
    };

    const onRemoveResponse = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'response')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 3. Exclude Options (Events excluded by this)
    const selectedExcludes = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'exclude'))
      .map((r) => r.targetConceptId);

    const onAddExclude = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Exclude', { relationType: 'excludes' });
    };

    const onRemoveExclude = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'exclude')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 4. Include Options (Events activated by this)
    const selectedIncludes = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'include'))
      .map((r) => r.targetConceptId);

    const onAddInclude = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Include', { relationType: 'includes' });
    };

    const onRemoveInclude = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'include')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 5. Milestone Options (Pending events that block this)
    const selectedMilestones = relations
      .filter((r) => r.targetConceptId === id && isDcrType(r, 'milestone'))
      .map((r) => r.sourceConceptId);

    const onAddMilestone = (eventId: string) => {
      addRelation(eventId as ElementId, id, 'Milestone', { relationType: 'has_milestone' });
    };

    const onRemoveMilestone = (eventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === eventId && r.targetConceptId === id && isDcrType(r, 'milestone')
      );
      if (rel) deleteRelation(rel.id);
    };

    return (
      <InspectorSection title="Forretningsregler (DCR Wizard)">
        <div className="flex flex-col gap-6">
          <DcrRuleSelect
            label="1. Hvilke hændelser skal være sket først?"
            description="Betingelser (Conditions): Denne hændelse kan ikke indtræffe, før følgende hændelser er indtruffet."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedConditions}
            onAdd={onAddCondition}
            onRemove={onRemoveCondition}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="2. Hvilke hændelser skal ske efterfølgende?"
            description="Respons (Responses): Når denne hændelse sker, skal følgende hændelser efterfølgende indtræffe."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedResponses}
            onAdd={onAddResponse}
            onRemove={onRemoveResponse}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="3. Hvilke hændelser udelukkes?"
            description="Udelukkelser (Excludes): Deaktiverer efterfølgende hændelser midlertidigt eller permanent."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedExcludes}
            onAdd={onAddExclude}
            onRemove={onRemoveExclude}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="4. Hvilke hændelser aktiveres?"
            description="Inkluderinger (Includes): Genaktiverer en hændelse, som tidligere er blevet udelukket."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedIncludes}
            onAdd={onAddInclude}
            onRemove={onRemoveInclude}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="5. Hvilke uafsluttede hændelser blokerer denne hændelse?"
            description="Milepæle (Milestones): Forhindrer denne hændelse i at indtræffe, hvis en af de valgte hændelser afventer en respons."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedMilestones}
            onAdd={onAddMilestone}
            onRemove={onRemoveMilestone}
          />
        </div>
      </InspectorSection>
    );
  }

  return null;
}

// ── Event Modeling Relation/Edge Inspector ─────────────────

function EventModelingRelationInspector({
  relation,
  updateRelation,
  concepts,
}: {
  relation: ConceptRelation;
  updateRelation: (id: ElementId, updates: Partial<ConceptRelation>) => void;
  concepts: ConceptNode[];
}) {
  const source = concepts.find((c) => c.id === relation.sourceConceptId);
  const target = concepts.find((c) => c.id === relation.targetConceptId);

  if (!source || !target) return null;

  const isProjection = source.conceptType === 'event' && target.conceptType === 'read_model';
  const isCommandTrigger =
    (source.conceptType === 'screen' || source.conceptType === 'automation') &&
    target.conceptType === 'command';

  if (!isProjection && !isCommandTrigger) return null;

  return (
    <InspectorSection title="Integrations-metadata">
      <div className="flex flex-col gap-4">
        {/* Pattern */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mønster</label>
          <div className="relative">
            <select
              value={relation.integrationPattern ?? 'Local'}
              onChange={(e) => updateRelation(relation.id, { integrationPattern: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
            >
              <option value="Local">Local (In-Memory)</option>
              <option value="PubSub">PubSub (Kafka, EventHubs)</option>
              <option value="RequestResponse">RequestResponse (REST API, gRPC)</option>
              <option value="OrchestratedPush">OrchestratedPush (ESB, Gravitee)</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
          </div>
        </div>

        {/* Technology */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Teknologi</label>
          <input
            type="text"
            value={relation.technology ?? ''}
            onChange={(e) => updateRelation(relation.id, { technology: e.target.value })}
            placeholder="f.eks. Kafka, Gravitee, Mule"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        {/* Topic Name (PubSub) */}
        {(relation.integrationPattern === 'PubSub' || !relation.integrationPattern) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kafka Topic</label>
            <input
              type="text"
              value={relation.topicName ?? ''}
              onChange={(e) => updateRelation(relation.id, { topicName: e.target.value })}
              placeholder="f.eks. ordre-oprettet-topic"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        )}

        {/* HTTP Method and Path (RequestResponse) */}
        {relation.integrationPattern === 'RequestResponse' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">HTTP Metode</label>
              <div className="relative">
                <select
                  value={relation.httpMethod ?? 'POST'}
                  onChange={(e) => updateRelation(relation.id, { httpMethod: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Endpoint Path</label>
              <input
                type="text"
                value={relation.endpointPath ?? ''}
                onChange={(e) => updateRelation(relation.id, { endpointPath: e.target.value })}
                placeholder="f.eks. /api/v1/orders"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </>
        )}
      </div>
    </InspectorSection>
  );
}

// ============================================================
// Edge styles per EM relation
// ============================================================

const EM_EDGE_COLORS: Record<string, string> = {
  invokes:   '#3B82F6', // blue
  triggers:  '#F59E0B', // amber
  feeds:     '#10B981', // emerald
  displays:  '#F59E0B', // amber
  emits:     '#A855F7', // purple
  automates: '#F43F5E', // rose
  notifies:  '#A855F7', // purple
};

// ============================================================
// Notation export
// ============================================================

export const eventModelingNotation: Notation = {
  id: 'event-modeling',
  displayName: 'Event Modeling',
  icon: '⚡',
  supportedViewTypes: ['event_modeling'],
  orthogonalEdges: true,
  CanvasComponent: EventModelingCanvas,
  layoutEngine: eventModelingLayoutEngine,
  defaultElements: [
    { conceptType: 'em_chapter', name: 'Start Chapter', xOffset: 100, yOffset: 80 },
    { conceptType: 'em_slice', name: 'Start Slice', parentIndex: 0, xOffset: 48, yOffset: 48 },
    { conceptType: 'event', name: 'Start Event', parentIndex: 1, xOffset: 30, yOffset: 140 },
  ],
  allowedConceptTypes: [
    'screen',
    'command',
    'event',             // Domain Event
    'read_model',
    'integration_event',
    'automation',
    'em_chapter',
    'em_slice',
  ],
  isValidRelation,
  getAvailableRelations,
  getQuickActions: (nodeType: ConceptType): QuickActionConfig[] => {
    switch (nodeType) {
      case 'screen':
        return [
          { conceptType: 'command', label: 'Ny Command', position: 'bottom', direction: 'source-to-target', createNewParent: 'same-parent' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' }
        ];
      case 'command':
        return [
          { conceptType: 'screen', label: 'Ny Screen', position: 'top', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'automation', label: 'Ny Automation (Left)', position: 'top', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'event', label: 'Ny Event', position: 'bottom', direction: 'source-to-target', createNewParent: 'same-parent' },
          { conceptType: 'integration_event', label: 'Ny Integration Event', position: 'right', direction: 'source-to-target', createNewParent: 'same-parent' }
        ];
      case 'event':
        return [
          { conceptType: 'command', label: 'Ny Command', position: 'top', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'bottom', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'source-to-target', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'event', label: 'Ny Event (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      case 'read_model':
        return [
          { conceptType: 'screen', label: 'Ny Screen', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'integration_event', label: 'Ny Integration Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' }
        ];
      case 'integration_event':
        return [
          { conceptType: 'command', label: 'Ny Command (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'bottom', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      case 'automation':
        return [
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'integration_event', label: 'Ny Integration Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'command', label: 'Ny Command', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      default:
        return [];
    }
  },
  InspectorComponent: EventModelingInspector,
  RelationInspectorComponent: EventModelingRelationInspector,
  hideViewsSection: false,
  conceptTypeLabels: {
    screen:            'Screen',
    command:           'Command',
    event:             'Domain Event',
    read_model:        'Read Model',
    integration_event: 'Integration Event',
    automation:        'Automation',
    em_chapter:        'Chapter',
    em_slice:          'Slice',
  },
  getEdgeStyle: (relation, isSelected) => {
    const relName = (relation.name ?? '').toLowerCase().trim();
    const color =
      EM_EDGE_COLORS[relName] ?? (isSelected ? '#10B981' : '#94A3B8');
    return {
      stroke: color,
      strokeDasharray: undefined,
      markerEnd: 'url(#arrow-closed)',
    };
  },
};

export default eventModelingNotation;
