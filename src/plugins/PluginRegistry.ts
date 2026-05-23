/**
 * Plugin Registry — Central registry for all notation plugins.
 *
 * Usage:
 *   PluginRegistry.register(globalExplorerPlugin);
 *   const plugin = PluginRegistry.forView(view);
 *
 * Rule: This is the ONLY place plugins are registered or resolved.
 * UI components must not import plugins directly.
 */

import type { NotationPlugin } from './types';
import type { ViewType } from '../schema/graphSchema';

class PluginRegistryClass {
  private plugins = new Map<string, NotationPlugin>();
  private viewTypeIndex = new Map<ViewType, NotationPlugin>();

  /**
   * Register a plugin. Throws if a plugin for the same id is already registered.
   */
  register(plugin: NotationPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginRegistry] Plugin "${plugin.id}" is already registered. Skipping.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);

    for (const viewType of plugin.supportedViewTypes) {
      if (!this.viewTypeIndex.has(viewType)) {
        this.viewTypeIndex.set(viewType, plugin);
      }
    }

    console.log(`[PluginRegistry] ✅ Registered plugin: "${plugin.displayName}" (${plugin.supportedViewTypes.join(', ')})`);
  }

  /**
   * Get a plugin by its exact ID.
   */
  get(id: string): NotationPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Resolve the best plugin for a given ViewType.
   * Falls back to the first registered plugin if no exact match.
   */
  forViewType(viewType: ViewType): NotationPlugin | undefined {
    return this.viewTypeIndex.get(viewType) ?? this.firstPlugin();
  }

  /**
   * All registered plugins (for display in the Views tab picker).
   */
  all(): NotationPlugin[] {
    return Array.from(this.plugins.values());
  }

  private firstPlugin(): NotationPlugin | undefined {
    return this.plugins.values().next().value;
  }
}

export const PluginRegistry = new PluginRegistryClass();
