import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WarningModalProps {
  violationType: string;
  warningCount: number;
  onContinue: () => void;
}

const getViolationMessage = (type: string): { title: string; message: string } => {
  switch (type) {
    case 'tab_switch':
      return {
        title: 'Tab Switch Detected',
        message: 'You switched to another tab. This is not allowed during the quiz.',
      };
    case 'window_blur':
      return {
        title: 'Window Focus Lost',
        message: 'You clicked outside the browser window or switched applications. Please stay focused on the quiz.',
      };
    case 'page_hide':
      return {
        title: 'Page Hidden',
        message: 'You minimized or hid the browser window. This is not allowed during the quiz.',
      };
    case 'devtools_attempt':
      return {
        title: 'Developer Tools Blocked',
        message: 'Attempting to open developer tools is not allowed during the quiz.',
      };
    case 'view_source_attempt':
      return {
        title: 'View Source Blocked',
        message: 'Attempting to view page source is not allowed during the quiz.',
      };
    case 'new_tab_attempt':
      return {
        title: 'New Tab/Window Detected',
        message: 'Attempting to open a new tab or window is not allowed during the quiz.',
      };
    case 'browser_shortcut':
      return {
        title: 'Browser Shortcut Detected',
        message: 'Using browser shortcuts is not allowed during the quiz.',
      };
    default:
      return {
        title: 'Violation Detected',
        message: 'A suspicious activity was detected. This is not allowed during the quiz.',
      };
  }
};

export const WarningModal = ({ violationType, warningCount, onContinue }: WarningModalProps) => {
  const { title, message } = getViolationMessage(violationType);
  const warningsRemaining = 3 - warningCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-warning/50 rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-10 h-10 text-warning" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-warning mb-3">{title}</h2>
        <p className="text-muted-foreground mb-4">{message}</p>

        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-warning font-medium mb-2">
            ⚠️ Warning {warningCount} of 3
          </p>
          <p className="text-sm text-foreground">
            {warningsRemaining > 0 
              ? `You have ${warningsRemaining} warning${warningsRemaining > 1 ? 's' : ''} remaining. If you cheat again, your account will be blocked.`
              : 'This is your final warning. Any further violations will result in your account being blocked.'}
          </p>
        </div>

        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-destructive font-medium mb-2">
            ⚠️ Quiz Reset Required
          </p>
          <p className="text-sm text-foreground">
            Your quiz progress has been reset. You will be redirected to the landing page to start the quiz again.
          </p>
        </div>

        <Button
          onClick={onContinue}
          size="lg"
          className="w-full gap-2 bg-warning hover:bg-warning/90 text-warning-foreground"
        >
          <CheckCircle className="w-4 h-4" />
          I Understand - Return to Landing Page
        </Button>
      </div>
    </div>
  );
};

