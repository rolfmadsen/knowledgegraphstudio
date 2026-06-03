/**
 * Notation Registry — Central registry for all visual notations.
 *
 * Usage:
 *   NotationRegistry.register(globalExplorerPlugin);
 *   const notation = NotationRegistry.forViewType(viewType);
 *
 * Rule: This is the ONLY place notations are registered or resolved.
 * UI components must not import notations directly.
 */

import type { Notation } from './types';
import type { ViewType } from '../schema/graphSchema';

class NotationRegistryClass {
  private notations = new Map<string, Notation>();
  private viewTypeIndex = new Map<ViewType, Notation>();

  /**
   * Register a notation. Throws if a notation for the same id is already registered.
   */
  register(notation: Notation): void {
    if (this.notations.has(notation.id)) {
      console.warn(`[NotationRegistry] Notation "${notation.id}" is already registered. Skipping.`);
      return;
    }
    this.notations.set(notation.id, notation);

    for (const viewType of notation.supportedViewTypes) {
      if (!this.viewTypeIndex.has(viewType)) {
        this.viewTypeIndex.set(viewType, notation);
      }
    }

    console.log(`[NotationRegistry] ✅ Registered notation: "${notation.displayName}" (${notation.supportedViewTypes.join(', ')})`);
  }

  /**
   * Get a notation by its exact ID.
   */
  get(id: string): Notation | undefined {
    return this.notations.get(id);
  }

  /**
   * Resolve the best notation for a given ViewType.
   * Falls back to the first registered notation if no exact match.
   */
  forViewType(viewType: ViewType): Notation | undefined {
    return this.viewTypeIndex.get(viewType) ?? this.firstNotation();
  }

  /**
   * All registered notations (for display in the Views tab picker).
   */
  all(): Notation[] {
    return Array.from(this.notations.values());
  }

  private firstNotation(): Notation | undefined {
    return this.notations.values().next().value;
  }
}

export const NotationRegistry = new NotationRegistryClass();

