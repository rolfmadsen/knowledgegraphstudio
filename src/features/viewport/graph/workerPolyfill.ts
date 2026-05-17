/**
 * Polyfill for Web Workers
 * Ensures that dependencies which expect a browser environment (like lodash/dagre)
 * do not crash when accessing `window` in a Web Worker context.
 */
if (typeof window === 'undefined') {
  (self as any).window = self;
}
