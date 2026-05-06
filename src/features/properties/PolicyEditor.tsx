/**
 * PolicyEditor — Gherkin / Constraint editor (Spec §5.4)
 *
 * Allows managing policies for a concept.
 * Supports Gherkin steps (Given, When, Then) with auto-expanding inputs.
 */
import { useState } from 'react';
import { GraphService } from '../../services/GraphService';
import type { ConceptNode, ConceptRelation } from '../../schema/graphSchema';

interface PolicyEditorProps {
  concept: ConceptNode | ConceptRelation;
}

export function PolicyEditor({ concept }: PolicyEditorProps) {
  // We still use store for selectors if needed, but here we only need GraphService for actions

  const [isAdding, setIsAdding] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');

  const handleAddPolicy = () => {
    if (!newPolicyName.trim()) return;
    GraphService.addPolicy(concept.id, {
      name: newPolicyName.trim(),
      type: 'gherkin',
      tags: [],
      given: [''],
      when: [''],
      then: [''],
    });
    setNewPolicyName('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Policy List */}
      <div className="space-y-4">
        {concept.policies.length === 0 && !isAdding ? (
          <p className="text-xs text-muted font-mono italic">No policies defined.</p>
        ) : (
          concept.policies.map((policy) => (
            <div key={policy.id} className="border border-border p-2 bg-background space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={policy.name}
                  onChange={(e) => GraphService.updatePolicy(concept.id, policy.id, { name: e.target.value })}
                  className="flex-1 bg-transparent border-none font-sans font-bold text-xs outline-none focus:text-primary"
                  placeholder="Policy Name"
                />
                <button
                  onClick={() => GraphService.deletePolicy(concept.id, policy.id)}
                  className="text-muted hover:text-danger text-[10px] font-mono"
                >
                  DELETE
                </button>
              </div>

              {/* Gherkin Steps */}
              <div className="space-y-2">
                <GherkinSection
                  label="GIVEN"
                  steps={policy.given || []}
                  onUpdate={(steps) => GraphService.updatePolicy(concept.id, policy.id, { given: steps })}
                />
                <GherkinSection
                  label="WHEN"
                  steps={policy.when || []}
                  onUpdate={(steps) => GraphService.updatePolicy(concept.id, policy.id, { when: steps })}
                />
                <GherkinSection
                  label="THEN"
                  steps={policy.then || []}
                  onUpdate={(steps) => GraphService.updatePolicy(concept.id, policy.id, { then: steps })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Policy Button/Form */}
      {isAdding ? (
        <div className="border border-border p-2 bg-surface space-y-2">
          <input
            autoFocus
            type="text"
            value={newPolicyName}
            onChange={(e) => setNewPolicyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPolicy();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            placeholder="New policy name..."
            className="field-input text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="toolbar-btn text-[9px]"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPolicy}
              className="toolbar-btn toolbar-btn--active text-[9px]"
            >
              Add Policy
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-1 border border-dashed border-border text-muted hover:text-text hover:border-border-strong text-[10px] font-mono transition-colors"
        >
          + ADD POLICY
        </button>
      )}
    </div>
  );
}

interface GherkinSectionProps {
  label: string;
  steps: string[];
  onUpdate: (steps: string[]) => void;
}

function GherkinSection({ label, steps, onUpdate }: GherkinSectionProps) {
  // Ensure we always have at least one empty row if none exist
  const displaySteps = steps.length === 0 ? [''] : steps;

  const handleStepChange = (idx: number, value: string) => {
    const newSteps = [...displaySteps];
    newSteps[idx] = value;
    onUpdate(newSteps);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newSteps = [...displaySteps];
      newSteps.splice(idx + 1, 0, '');
      onUpdate(newSteps);
      // Wait for re-render then focus next input
      setTimeout(() => {
        const inputs = (e.currentTarget.parentElement?.parentElement as HTMLElement).querySelectorAll('input');
        inputs[idx + 1]?.focus();
      }, 0);
    }
    if (e.key === 'Backspace' && displaySteps[idx] === '' && displaySteps.length > 1) {
      e.preventDefault();
      const newSteps = displaySteps.filter((_, i) => i !== idx);
      onUpdate(newSteps);
      // Focus previous input
      setTimeout(() => {
        const inputs = (e.currentTarget.parentElement?.parentElement as HTMLElement).querySelectorAll('input');
        inputs[idx - 1]?.focus();
      }, 0);
    }
  };

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-bold text-muted font-sans flex items-center gap-2">
        <span>{label}</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>
      <div className="space-y-1 pl-2">
        {displaySteps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-muted font-mono text-[10px] shrink-0">•</span>
            <input
              type="text"
              value={step}
              onChange={(e) => handleStepChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="w-full bg-transparent border-none text-[11px] font-mono outline-none focus:text-primary placeholder:italic placeholder:opacity-50"
              placeholder="..."
            />
          </div>
        ))}
      </div>
    </div>
  );
}
