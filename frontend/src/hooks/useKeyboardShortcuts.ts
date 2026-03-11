// frontend/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useAppDispatch } from '../store';
import { undo, redo } from '../store/slices/historySlice';

export const useKeyboardShortcuts = (graphId: number) => {
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем, если фокус на поле ввода
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA' ||
          (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // Ctrl+Z или Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      }
      
      // Ctrl+Y или Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
};
