import { useState, useEffect, useCallback } from 'react';

export const useResizable = (config: {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  direction: 'ltr' | 'rtl';
  offset?: number;
}) => {
  const [width, setWidth] = useState(config.initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      let newWidth;
      if (config.direction === 'ltr') {
        newWidth = e.clientX;
      } else {
        newWidth = window.innerWidth - e.clientX - (config.offset || 0);
      }
      setWidth(Math.max(config.minWidth, Math.min(config.maxWidth, newWidth)));
    }
  }, [isResizing, config.direction, config.minWidth, config.maxWidth, config.offset]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return { width, isResizing, startResizing, setWidth };
};
