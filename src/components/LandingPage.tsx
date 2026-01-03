import { Button } from '@/components/ui/button';
import { 
  Code2, 
  Shield, 
  Clock, 
  AlertTriangle,
  Play,
  Eye,
  EyeOff,
  MonitorX,
  Palette,
  Puzzle,
  Flame
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type QuizType = 'plugin' | 'theme';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

interface LandingPageProps {
  onStart: (type: QuizType, difficulty: DifficultyLevel) => void;
  pluginQuestionCount: number;
  themeQuestionCount: number;
  timeLimit: number;
}

export const LandingPage = ({ onStart, pluginQuestionCount, themeQuestionCount, timeLimit }: LandingPageProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartQuiz = (type: QuizType, difficulty: DifficultyLevel) => {
    // Require login to start quiz
    if (!user) {
      toast.error('Please login to start the quiz');
      // Store the intended quiz type and difficulty in sessionStorage (for reference only)
      sessionStorage.setItem('pendingQuiz', JSON.stringify({ type, difficulty }));
      // Redirect to login page
      navigate('/login');
      return;
    }
    // User is logged in, start the quiz
    onStart(type, difficulty);
  };


  const rules = [
    {
      icon: Eye,
      title: 'Stay on this tab',
      description: 'Switching tabs will restart the quiz',
    },
    {
      icon: MonitorX,
      title: 'Don\'t minimize',
      description: 'Minimizing the browser resets progress',
    },
    {
      icon: EyeOff,
      title: 'No other windows',
      description: 'Clicking outside ends your attempt',
    },
    {
      icon: Clock,
      title: 'Time limit',
      description: `Complete within ${timeLimit} minutes`,
    },
  ];


  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 pb-24">
      <div className="max-w-4xl w-full">
        {/* User Header - Removed, now in bottom nav */}

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-10">
            <div className="relative bg-transparent dark:bg-white/90 dark:rounded-lg dark:p-4 dark:shadow-lg">
              <img
                src="/Softvence-Omega-Logo.png"
                alt="Softvence Logo"
                className="h-20 w-auto object-contain bg-transparent"
                onError={(e) => {
                  console.error('Failed to load logo:', e);
                }}
              />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            WordPress Developer
            <span className="text-gradient block">Interview Quiz</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose your specialization
          </p>
        </div>

        {/* Quiz Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Plugin Developer Quiz */}
          <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Puzzle className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Plugin Developer</h2>
                <p className="text-sm text-muted-foreground">Hooks, APIs & Security</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Code2 className="w-4 h-4" />
                {pluginQuestionCount} Questions
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {timeLimit} min
              </span>
            </div>

            <ul className="text-sm text-muted-foreground space-y-1 mb-5">
              <li>• WordPress Hooks & Actions</li>
              <li>• Custom Post Types & Meta</li>
              <li>• Security & Sanitization</li>
              <li>• REST API & AJAX</li>
            </ul>

            <Button
              onClick={() => handleStartQuiz('plugin', 'advanced')}
              size="lg"
              className="w-full gap-2"
            >
              <Flame className="w-4 h-4" />
              Start Quiz
              <Play className="w-4 h-4" />
            </Button>
          </div>

          {/* Theme Developer Quiz */}
          <div className="bg-card border border-border rounded-xl p-6 hover:border-accent/50 transition-all duration-300 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                <Palette className="w-7 h-7 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Theme Developer</h2>
                <p className="text-sm text-muted-foreground">Templates & Customization</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Code2 className="w-4 h-4" />
                {themeQuestionCount} Questions
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {timeLimit} min
              </span>
            </div>

            <ul className="text-sm text-muted-foreground space-y-1 mb-5">
              <li>• Template Hierarchy</li>
              <li>• Theme Functions & Hooks</li>
              <li>• Child Themes</li>
              <li>• Menus & Widgets</li>
            </ul>

            <Button
              onClick={() => handleStartQuiz('theme', 'advanced')}
              size="lg"
              variant="outline"
              className="w-full gap-2 border-accent/30 hover:bg-accent/10"
            >
              <Flame className="w-4 h-4" />
              Start Quiz
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">Anti-Cheat Rules</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg"
              >
                <rule.icon className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">{rule.title}</p>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                <strong>Warning:</strong> Any violation will immediately restart the quiz from the beginning. Your progress will be lost.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
