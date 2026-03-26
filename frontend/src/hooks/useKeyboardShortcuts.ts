// frontend/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useAppDispatch } from '../store';
import { undo, redo } from '../store/slices/historySlice';

export const useKeyboardShortcuts = (artifactId: number, canUndo: boolean, canRedo: boolean) => {
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем, если фокус на поле ввода
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable) {
        return;
      }

      // Ctrl+Z или Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          dispatch(undo(artifactId));
        }
      }
      
      // Ctrl+Y или Ctrl+Shift+Z (Redo)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          dispatch(redo(artifactId));
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, artifactId, canUndo, canRedo]);
};