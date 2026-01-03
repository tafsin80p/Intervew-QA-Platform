import { useEffect, useCallback, useRef } from 'react';

interface UseAntiCheatOptions {
  onViolation: (type: string) => void;
  enabled: boolean;
}

export const useAntiCheat = ({ onViolation, enabled }: UseAntiCheatOptions) => {
  const violationTriggered = useRef(false);

  const handleViolation = useCallback((type: string) => {
    if (!violationTriggered.current && enabled) {
      violationTriggered.current = true;
      onViolation(type);
    }
  }, [onViolation, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Reset violation flag when enabled changes
    violationTriggered.current = false;

    // Visibility change detection (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_switch');
      }
    };

    // Window blur detection (clicking outside browser, switching windows)
    const handleBlur = () => {
      // Check immediately if page is hidden (tab switch)
      if (document.hidden) {
        handleViolation('window_blur');
      }
    };

    // Detect if page loses focus
    const handlePageHide = () => {
      handleViolation('page_hide');
    };

    // Prevent right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Prevent common keyboard shortcuts and detect browser actions
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        handleViolation('devtools_attempt');
        return;
      }

      // Prevent Ctrl+Shift+I or Cmd+Option+I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        handleViolation('devtools_attempt');
        return;
      }

      // Prevent Ctrl+Shift+J or Cmd+Option+J (DevTools Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        handleViolation('devtools_attempt');
        return;
      }

      // Prevent Ctrl+U or Cmd+Option+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        handleViolation('view_source_attempt');
        return;
      }

      // Detect new tab shortcuts (Ctrl+T or Cmd+T)
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleViolation('new_tab_attempt');
        return;
      }

      // Detect new window shortcuts (Ctrl+N or Cmd+N)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
        e.preventDefault();
        handleViolation('new_tab_attempt');
        return;
      }

      // Detect incognito/private window (Ctrl+Shift+N or Cmd+Shift+N)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleViolation('new_tab_attempt');
        return;
      }

      // Detect window switching (Alt+Tab on Windows/Linux, Cmd+Tab on Mac)
      // Note: We can't prevent these, but we detect them via blur events
      if (e.altKey && e.key === 'Tab') {
        // Will be detected by blur event
        handleViolation('window_blur');
      }
    };

    // Detect beforeunload (user trying to close/leave page)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This will show browser's default warning, but we also trigger violation
      handleViolation('page_hide');
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
      return '';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent window.open attempts
    const originalOpen = window.open;
    window.open = function (...args) {
      handleViolation('new_tab_attempt');
      return null;
    };

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.open = originalOpen; // Restore original
    };
  }, [enabled, handleViolation]);

  return {
    resetViolation: () => {
      violationTriggered.current = false;
    }
  };
};
