import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViolationModalProps {
  violationType: string;
  onRestart: () => void;
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
        message: 'You clicked outside the browser window. Please stay focused on the quiz.',
      };
    case 'page_hide':
      return {
        title: 'Page Hidden',
        message: 'You minimized or hid the browser window.',
      };
    case 'devtools_attempt':
      return {
        title: 'Developer Tools Blocked',
        message: 'Attempting to open developer tools is not allowed.',
      };
    case 'view_source_attempt':
      return {
        title: 'View Source Blocked',
        message: 'Attempting to view page source is not allowed.',
      };
    case 'quiz_restart_limit':
      return {
        title: 'Quiz Restart Limit Reached',
        message: 'You have restarted the quiz 3 times. This is not allowed.',
      };
    default:
      return {
        title: 'Violation Detected',
        message: 'A suspicious activity was detected.',
      };
  }
};

export const ViolationModal = ({ violationType, onRestart }: ViolationModalProps) => {
  const { title, message } = getViolationMessage(violationType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-destructive/50 rounded-2xl p-8 max-w-md mx-4 text-center glow-destructive">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-destructive mb-3">Account Blocked</h2>
        <p className="text-muted-foreground mb-4">{message}</p>

        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-destructive font-medium mb-2">
            ⚠️ You have reached 3 warnings
          </p>
          <p className="text-sm text-destructive">
            Your account has been blocked due to repeated violations of quiz rules. 
            You will not be able to take the quiz until an administrator unblocks your account.
          </p>
        </div>

        <div className="bg-secondary/30 rounded-lg p-3 mb-6">
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact the administrator.
          </p>
        </div>

        <Button
          onClick={onRestart}
          size="lg"
          variant="outline"
          className="w-full gap-2"
        >
          Return to Landing Page
        </Button>
      </div>
    </div>
  );
};
