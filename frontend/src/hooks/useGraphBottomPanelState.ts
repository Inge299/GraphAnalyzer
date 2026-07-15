import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type BottomTab = 'nodes' | 'edges' | 'results';

type UseGraphBottomPanelStateArgs = {
  currentArtifactId: number | null;
  isInspectorVisible: boolean;
};

export const useGraphBottomPanelState = ({
  currentArtifactId,
  isInspectorVisible,
}: UseGraphBottomPanelStateArgs) => {
  const getHeightStorageKey = useCallback(
    () => `graph-bottom-panel-height-v2:${currentArtifactId ?? 'default'}`,
    [currentArtifactId],
  );

  const getStoredHeight = useCallback(() => {
    if (typeof window === 'undefined') return 260;
    const raw = Number(window.localStorage.getItem(getHeightStorageKey()) || 260);
    return Number.isFinite(raw) ? raw : 260;
  }, [getHeightStorageKey]);

  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>('nodes');
  const [bottomPanelHeight, setBottomPanelHeight] = useState(getStoredHeight);
  const [isBottomResizing, setIsBottomResizing] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const [bottomPanelBounds, setBottomPanelBounds] = useState({ left: 8, width: 320 });
  const bottomResizeStartYRef = useRef(0);
  const bottomResizeStartHeightRef = useRef(260);

  const handleBottomResizerMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    bottomResizeStartYRef.current = event.clientY;
    bottomResizeStartHeightRef.current = bottomPanelHeight;
    setIsBottomResizing(true);
  }, [bottomPanelHeight]);

  useEffect(() => {
    if (!isBottomResizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const delta = bottomResizeStartYRef.current - event.clientY;
      const maxHeight = Math.max(260, Math.floor(window.innerHeight * 0.7));
      const nextHeight = Math.max(170, Math.min(maxHeight, bottomResizeStartHeightRef.current + delta));
      setBottomPanelHeight(nextHeight);
    };

    const onMouseUp = () => {
      setIsBottomResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isBottomResizing]);

  useEffect(() => {
    setBottomPanelHeight(getStoredHeight());
  }, [getStoredHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getHeightStorageKey(), String(bottomPanelHeight));
  }, [bottomPanelHeight, getHeightStorageKey]);

  useEffect(() => {
    const updateBounds = () => {
      const el = contentAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setBottomPanelBounds({
        left: Math.max(8, Math.round(rect.left)),
        width: Math.max(320, Math.round(rect.width))
      });
    };

    updateBounds();

    const target = contentAreaRef.current;
    let observer: ResizeObserver | null = null;
    if (target && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateBounds());
      observer.observe(target);
    }

    window.addEventListener('resize', updateBounds);
    return () => {
      window.removeEventListener('resize', updateBounds);
      observer?.disconnect();
    };
  }, [isInspectorVisible, currentArtifactId]);

  const bottomPanelStyle = useMemo<React.CSSProperties>(() => ({
    left: `${bottomPanelBounds.left + 8}px`,
    width: `${Math.max(320, bottomPanelBounds.width - 16)}px`,
    transform: 'none',
    ...(isBottomPanelOpen ? { height: `${bottomPanelHeight}px` } : {}),
  }), [bottomPanelBounds, isBottomPanelOpen, bottomPanelHeight]);

  return {
    isBottomPanelOpen,
    setIsBottomPanelOpen,
    bottomTab,
    setBottomTab,
    contentAreaRef,
    handleBottomResizerMouseDown,
    bottomPanelStyle,
  };
};

export default useGraphBottomPanelState;
