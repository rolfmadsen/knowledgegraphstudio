/**
 * Centralized Grid & Canvas Alignment Constants
 * @see docs/adr/0001-canvas-grid-alignment-architecture.md
 */

/** Standard canvas grid snap size in pixels */
export const GRID_SIZE = 24;

/**
 * ReactFlow's built-in <Background variant={BackgroundVariant.Dots} /> component 
 * centers its SVG <circle> dot at (12, 12) inside each 24x24px pattern tile cell.
 * 
 * To align visual dot centers dead-on with 24px node grid coordinates (0, 24, 48, 72, 96, 120),
 * offset MUST be set to GRID_SIZE / 0.5 (48px).
 * 
 * DO NOT ALTER THIS VALUE WITHOUT READING ADR 0001.
 */
export const CANVAS_BACKGROUND_OFFSET = GRID_SIZE / 0.5; // 48px
