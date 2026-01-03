import { useState, useCallback, useRef, useEffect } from 'react';
import { LandingPage, QuizType, DifficultyLevel } from '@/components/LandingPage';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizTimer } from '@/components/QuizTimer';
import { ProgressBar } from '@/components/ProgressBar';
import { ViolationModal } from '@/components/ViolationModal';
import { WarningModal } from '@/components/WarningModal';
import { ResultsPage } from '@/components/ResultsPage';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { useAuth } from '@/contexts/AuthContext';
import { quizAPI, adminAPI, authAPI } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { wordpressQuestions } from '@/data/questions';
import { themeQuestions } from '@/data/themeQuestions';
import { Question } from '@/data/questions';
import { Puzzle, Palette, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type QuizState = 'landing' | 'quiz' | 'violation' | 'warning' | 'results';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [quizState, setQuizState] = useState<QuizState>('landing');
  const [quizType, setQuizType] = useState<QuizType>('plugin');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('advanced');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [violationType, setViolationType] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [quizDurationMinutes, setQuizDurationMinutes] = useState(20);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Create a ref to store reset function
  const resetViolationRef = useRef<(() => void) | null>(null);

  const handleViolation = useCallback(async (type: string) => {
    if (!user) {
      // If not logged in, just show warning and reset
      setViolationType(type);
      setWarningCount(1);
      setShowWarning(true);
      setQuizState('warning');
      return;
    }

    try {
      // Get current warning count from API
      const warningData = await adminAPI.getUserWarnings(user.id);
      const currentWarningCount = warningData.warningCount || 0;
      const newWarningCount = currentWarningCount + 1;

      // Update warning count
      await adminAPI.updateUserWarnings(user.id, newWarningCount);

      // If this is the 3rd warning, ban the user
      if (newWarningCount >= 3) {
        const reason = `Cheating detected: ${type} (3 warnings reached)`;
        
        // Ban user
        await adminAPI.blockUser(user.id, reason);

        // Show blocking modal
        setQuizState('violation');
        setViolationType(type);
        return;
      }

      // Show warning modal for 1st or 2nd warning
      setViolationType(type);
      setWarningCount(newWarningCount);
      setShowWarning(true);
      setQuizState('warning');
    } catch (error) {
      console.error('Error handling violation:', error);
      // Fallback: show warning if API error
      setViolationType(type);
      setWarningCount(1);
      setShowWarning(true);
      setQuizState('warning');
    }
  }, [user]);

  const { resetViolation } = useAntiCheat({
    onViolation: handleViolation,
    enabled: quizState === 'quiz',
  });

  // Store reset function in ref
  useEffect(() => {
    resetViolationRef.current = resetViolation;
  }, [resetViolation]);

  const fetchDbQuestions = useCallback(async (type: QuizType, diff: DifficultyLevel): Promise<Question[]> => {
    // Since we're using Express API now, skip Supabase and use static questions
    // This prevents infinite loading issues
    return [];
  }, []);

  const getFallbackQuestions = useCallback((type: QuizType): Question[] => {
    return type === 'plugin' ? wordpressQuestions : themeQuestions;
  }, []);

  const handleStart = useCallback(async (type: QuizType, diff: DifficultyLevel) => {
    // Require login to start quiz
    if (!user) {
      toast.error('Please login to start the quiz');
      const pendingQuiz = JSON.stringify({ type, difficulty: diff });
      sessionStorage.setItem('pendingQuiz', pendingQuiz);
      return;
    }

    setQuizType(type);
    setDifficulty(diff);
    setLoadingQuestions(true);

    // Use static questions immediately (no database fetch to prevent loading issues)
    // Load questions synchronously to avoid any async delays
    try {
      const quizQuestions = getFallbackQuestions(type);
      setQuestions(quizQuestions);
      setAnswers(new Array(quizQuestions.length).fill(null));
      setCurrentQuestion(0);
      startTimeRef.current = Date.now();
      
      // Use requestAnimationFrame to ensure state updates happen smoothly
      requestAnimationFrame(() => {
        setLoadingQuestions(false);
        setQuizState('quiz');
      });
    } catch (error) {
      console.error('Error starting quiz:', error);
      toast.error('Failed to start quiz. Please try again.');
      setLoadingQuestions(false);
    }
  }, [user, getFallbackQuestions]);

  // Removed auto-start feature - users should always see landing page after login
  // They can then manually start the quiz from the landing page

  useEffect(() => {
    // Fetch quiz duration from settings
    const fetchQuizDuration = async () => {
      if (!isSupabaseConfigured) {
        setQuizDurationMinutes(20); // Default duration
        return;
      }

      try {
        const { data, error } = await supabase
          .from('quiz_settings' as never)
          .select('setting_value')
          .eq('setting_key', 'quiz_duration_minutes')
          .single() as { data: { setting_value: string } | null; error: unknown };

        if (!error && data) {
          setQuizDurationMinutes(parseInt(data.setting_value) || 20);
        } else {
          setQuizDurationMinutes(20); // Default if not found
        }
      } catch (err) {
        console.error('Error fetching quiz duration:', err);
        setQuizDurationMinutes(20); // Default on error
      }
    };

    fetchQuizDuration();
  }, []);

  // Prevent text selection and copying during quiz
  useEffect(() => {
    if (quizState !== 'quiz') {
      return;
    }

    // Prevent copy, cut, and context menu
    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Copying is disabled during the quiz');
      return false;
    };

    const preventCut = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const preventSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCut);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('selectstart', preventSelectStart);
    document.addEventListener('dragstart', preventDragStart);

    // Disable keyboard shortcuts (Ctrl+C, Ctrl+A, Ctrl+X, etc.)
    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')
      ) {
        e.preventDefault();
        if (e.key === 'c' || e.key === 'C') {
          toast.error('Copying is disabled during the quiz');
        }
        return false;
      }
    };

    document.addEventListener('keydown', preventKeyboardShortcuts);

    // Cleanup
    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCut);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', preventSelectStart);
      document.removeEventListener('dragstart', preventDragStart);
      document.removeEventListener('keydown', preventKeyboardShortcuts);
    };
  }, [quizState]);

  const handleRestart = async () => {
    if (!user) {
      // If not logged in, just restart
      resetViolation();
      setQuizState('landing');
      setCurrentQuestion(0);
      setAnswers([]);
      setViolationType('');
      setWarningCount(0);
      setShowWarning(false);
      setQuestions([]);
      return;
    }

    try {
      // Get current restart count
      const restartData = await adminAPI.getUserRestartCount(user.id);
      const currentRestartCount = restartData.restartCount || 0;
      const newRestartCount = currentRestartCount + 1;

      // Update restart count
      await adminAPI.updateUserRestartCount(user.id, newRestartCount);

      // If this is the 3rd restart, ban the user
      if (newRestartCount >= 3) {
        const reason = `Quiz restarted 3 times (${newRestartCount} restarts)`;
        
        // Ban user
        await adminAPI.blockUser(user.id, reason);

        // Show blocking modal
        toast.error('You have restarted the quiz 3 times. Your account has been blocked.');
        setQuizState('violation');
        setViolationType('quiz_restart_limit');
        return;
      }

      // Show warning for 1st or 2nd restart
      if (newRestartCount === 1) {
        toast.warning('First restart. You have 2 restarts remaining.');
      } else if (newRestartCount === 2) {
        toast.warning('Second restart. This is your last restart. Next restart will result in a ban.');
      }

      // Reset quiz state
      resetViolation();
      setQuizState('landing');
      setCurrentQuestion(0);
      setAnswers([]);
      setViolationType('');
      setWarningCount(0);
      setShowWarning(false);
      setQuestions([]);
    } catch (error) {
      console.error('Error tracking restart:', error);
      // Fallback: just restart if API error
      resetViolation();
      setQuizState('landing');
      setCurrentQuestion(0);
      setAnswers([]);
      setViolationType('');
      setWarningCount(0);
      setShowWarning(false);
      setQuestions([]);
    }
  };

  const handleSelectAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      finishQuiz();
    }
  };

  const handleTimeUp = () => {
    finishQuiz();
  };

  const finishQuiz = async () => {
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const score = questions.filter((q, i) => answers[i] === q.correctAnswer).length;

    // Calculate detailed answers (correct/wrong for each question)
    const detailedAnswers = questions.map((q, i) => ({
      questionId: q.id,
      question: q.question,
      userAnswer: answers[i] ?? null,
      correctAnswer: q.correctAnswer,
      isCorrect: answers[i] === q.correctAnswer,
      options: q.options,
    }));

    const correctAnswers = detailedAnswers.filter(a => a.isCorrect).length;
    const wrongAnswers = detailedAnswers.filter(a => !a.isCorrect && a.userAnswer !== null).length;

    // Save results to Express API
    if (user) {
      try {
        await quizAPI.submit({
          quizType: quizType,
          difficulty: difficulty,
          score: score,
          totalQuestions: questions.length,
          correctAnswers: correctAnswers,
          wrongAnswers: wrongAnswers,
          timeTakenSeconds: timeTaken,
          detailedAnswers: detailedAnswers,
        });
        console.log('✅ Quiz results saved to backend');
        toast.success('Quiz results saved successfully!');
      } catch (err: any) {
        console.error('Error saving results:', err);
        toast.error(err.message || 'Failed to save quiz results');
      }
    }

    setQuizState('results');
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (quizState === 'landing') {
    return (
      <LandingPage
        onStart={handleStart}
        pluginQuestionCount={wordpressQuestions.length}
        themeQuestionCount={themeQuestions.length}
        timeLimit={quizDurationMinutes}
      />
    );
  }

  if (quizState === 'warning') {
    return (
      <WarningModal
        violationType={violationType}
        warningCount={warningCount}
        onContinue={() => {
          // Reset violation flag
          if (resetViolationRef.current) {
            resetViolationRef.current();
          }
          // Show toast message
          toast.error('Quiz has been reset due to violation. Please start again from the landing page.');
          // Redirect to landing page
          setShowWarning(false);
          setQuizState('landing');
          setCurrentQuestion(0);
          setAnswers([]);
          setViolationType('');
          setWarningCount(0);
          setQuestions([]);
        }}
      />
    );
  }

  if (quizState === 'violation') {
    return (
      <ViolationModal
        violationType={violationType}
        onRestart={() => {
          // Reset everything and go to landing page
          if (resetViolationRef.current) {
            resetViolationRef.current();
          }
          setQuizState('landing');
          setCurrentQuestion(0);
          setAnswers([]);
          setViolationType('');
          setWarningCount(0);
          setShowWarning(false);
          setQuestions([]);
        }}
      />
    );
  }

  if (quizState === 'results') {
    return (
      <ResultsPage
        questions={questions}
        answers={answers}
        onRestart={handleRestart}
        quizType={quizType}
        difficulty={difficulty}
      />
    );
  }

  const QuizIcon = quizType === 'plugin' ? Puzzle : Palette;
  const quizTitle = quizType === 'plugin' ? 'Plugin Developer' : 'Theme Developer';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <QuizIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-foreground text-sm">WordPress Quiz</h1>
              <p className="text-xs text-muted-foreground">{quizTitle} • {difficulty}</p>
            </div>
          </div>

          <QuizTimer
            duration={quizDurationMinutes * 60}
            onTimeUp={handleTimeUp}
            isRunning={quizState === 'quiz'}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 no-select">
        <div className="mb-8">
          <ProgressBar
            current={currentQuestion + 1}
            total={questions.length}
          />
        </div>

        <QuestionCard
          question={questions[currentQuestion]}
          questionNumber={currentQuestion + 1}
          selectedAnswer={answers[currentQuestion]}
          onSelectAnswer={handleSelectAnswer}
          onNext={handleNext}
          isLast={currentQuestion === questions.length - 1}
        />
      </main>
    </div>
  );
};

export default Index;
