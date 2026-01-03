import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { adminAPI, authAPI } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { isAdminEmail } from '@/constants/admin';
import { wordpressQuestions } from '@/data/questions';
import { themeQuestions } from '@/data/themeQuestions';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Shield,
  BarChart3,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Loader2,
  Database,
  Wifi,
  WifiOff,
  Puzzle,
  Palette,
  UserCheck,
  UserX,
  Hourglass,
  Plus,
  Edit2,
  Trash2,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DetailedAnswer {
  questionId: number;
  question: string;
  userAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  options: string[];
}

interface QuizResult {
  id: string;
  userId: string;
  userEmail: string | null;
  userName?: string;
  quizType: 'plugin' | 'theme';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  timeTakenSeconds: number;
  detailedAnswers: DetailedAnswer[];
  completedAt: string;
  status?: 'selected' | 'pending'; // User status
}

interface User {
  id: string;
  name: string;
  email: string;
  status: 'selected' | 'pending';
  quizType?: 'plugin' | 'theme' | 'both';
  score?: number;
  completedAt?: string;
  latestQuizId?: string; // ID of the latest quiz result
  isBlocked?: boolean;
  warningCount?: number;
  restartCount?: number;
  blockedReason?: string;
  blockedAt?: string;
}

type QuizType = 'plugin' | 'theme';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

interface Question {
  id: string;
  quiz_type: QuizType;
  difficulty: DifficultyLevel;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
}

const AdminFirestore = () => {
  const { user, isAdmin: isAdminFromAuth, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // Check admin status: either from auth context or by email
  const isAdmin = isAdminFromAuth || isAdminEmail(user?.email);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Question management state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [staticQuestions, setStaticQuestions] = useState<Question[]>([]);
  const [hiddenStaticQuestions, setHiddenStaticQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [currentDialogQuizType, setCurrentDialogQuizType] = useState<QuizType>('plugin');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formQuizType, setFormQuizType] = useState<QuizType>('plugin');
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>('advanced');
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState(['', '', '', '']);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState(0);
  const [formExplanation, setFormExplanation] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Auth settings state
  const [authSettings, setAuthSettings] = useState({
    signupEnabled: true,
    minPasswordLength: 6,
    requireEmailConfirmation: false,
    oauthGoogleEnabled: true,
    oauthGithubEnabled: true,
    oauthGoogleClientId: '',
    oauthGoogleClientSecret: '',
    oauthGithubClientId: '',
    oauthGithubClientSecret: '',
  });
  const [savingAuthSettings, setSavingAuthSettings] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/');
        toast.error('Access denied. Please login first.');
        return;
      }
      
      if (!isAdmin) {
        navigate('/');
        toast.error('Access denied. Admin only.');
        return;
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      checkConnection();
      fetchResults();
      loadStaticQuestions();
      fetchQuestions();
      fetchHiddenStaticQuestions();
      fetchAuthSettings();
    }
  }, [user, isAdmin]);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/health`);
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching admin data...');
      console.log('Token:', authAPI.getToken() ? 'Present' : 'Missing');
      
      // Fetch users from API
      console.log('📊 Fetching users...');
      const usersData = await adminAPI.getUsers();
      console.log('✅ Users data received:', usersData);
      setUsers(usersData.users || []);

      // Fetch all results for detailed view
      console.log('📈 Fetching results...');
      const resultsData = await adminAPI.getResults();
      console.log('✅ Results data received:', resultsData);
      
      // Transform results to match QuizResult interface
      const transformedResults: QuizResult[] = (resultsData.results || []).map((result: any) => ({
        id: result.id,
        userId: result.user_id,
        userEmail: result.user_email,
        userName: result.user_name,
        quizType: result.quiz_type,
        difficulty: result.difficulty,
        score: result.score,
        totalQuestions: result.total_questions,
        correctAnswers: result.correct_answers,
        wrongAnswers: result.wrong_answers,
        timeTakenSeconds: result.time_taken_seconds,
        detailedAnswers: result.detailed_answers,
        completedAt: result.completed_at,
        status: result.status || 'pending',
      }));

      setResults(transformedResults);
      
      console.log(`✅ Loaded ${transformedResults.length} quiz results and ${usersData.users?.length || 0} users from API`);
      
      if (transformedResults.length === 0 && (usersData.users?.length || 0) === 0) {
        toast.info('No data found. Make sure users have taken quizzes.');
      }
    } catch (error: any) {
      console.error('❌ Error fetching results:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error(error.message || 'Failed to load quiz results. Please check your authentication.');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  const stats = {
    totalAttempts: results.length,
    uniqueUsers: new Set(results.map(r => r.userId)).size,
    averageScore: results.length > 0
      ? Math.round((results.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / results.length))
      : 0,
    averageTime: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.timeTakenSeconds, 0) / results.length)
      : 0,
    totalCorrect: results.reduce((sum, r) => sum + r.correctAnswers, 0),
    totalWrong: results.reduce((sum, r) => sum + r.wrongAnswers, 0),
    pluginAttempts: results.filter(r => r.quizType === 'plugin').length,
    themeAttempts: results.filter(r => r.quizType === 'theme').length,
  };

  const viewDetails = (result: QuizResult) => {
    setSelectedResult(result);
    setDialogOpen(true);
  };

  // Update user status via API
  const updateUserStatus = async (userId: string, newStatus: 'selected' | 'pending') => {
    try {
      await adminAPI.updateUserStatus(userId, newStatus);
      await fetchResults();
      toast.success(`User status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      toast.error(error.message || 'Failed to update user status');
    }
  };

  // Delete user's quiz results via API
  const deleteUserResults = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete all quiz results for ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminAPI.deleteUserResults(userId);
      await fetchResults();
      toast.success(`${userName}'s quiz results have been deleted`);
    } catch (error: any) {
      console.error('Error deleting user results:', error);
      toast.error(error.message || 'Failed to delete user results');
    }
  };

  // Unban user via API
  const unblockUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to unban ${userName}? This will reset their warning count to 0.`)) {
      return;
    }

    try {
      await adminAPI.unblockUser(userId);
      await fetchResults();
      toast.success(`${userName} has been unbanned successfully`);
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      toast.error(error.message || 'Failed to unblock user');
    }
  };

  // Question management functions
  const loadStaticQuestions = () => {
    const staticPluginQuestions: Question[] = wordpressQuestions.map((q: any) => ({
      id: `static-plugin-${q.id}`,
      quiz_type: 'plugin' as QuizType,
      difficulty: 'advanced' as DifficultyLevel,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || null,
    }));

    const staticThemeQuestions: Question[] = themeQuestions.map((q: any) => ({
      id: `static-theme-${q.id}`,
      quiz_type: 'theme' as QuizType,
      difficulty: 'advanced' as DifficultyLevel,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || null,
    }));

    setStaticQuestions([...staticPluginQuestions, ...staticThemeQuestions]);
  };

  const fetchHiddenStaticQuestions = async () => {
    if (!isSupabaseConfigured) {
      setHiddenStaticQuestions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quiz_settings' as never)
        .select('setting_value')
        .eq('setting_key', 'hidden_static_questions')
        .single() as { data: { setting_value: string } | null; error: unknown };

      if (!error && data && data.setting_value) {
        try {
          const hiddenIds = JSON.parse(data.setting_value) as string[];
          setHiddenStaticQuestions(hiddenIds);
        } catch (parseError) {
          console.error('Error parsing hidden questions:', parseError);
          setHiddenStaticQuestions([]);
        }
      } else {
        setHiddenStaticQuestions([]);
      }
    } catch (err) {
      console.error('Error fetching hidden static questions:', err);
      setHiddenStaticQuestions([]);
    }
  };

  const fetchQuestions = async () => {
    setQuestionsLoading(true);
    
    // Load hidden static questions
    await fetchHiddenStaticQuestions();

    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - using static questions only');
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching questions:', error);
        toast.error(`Failed to load questions: ${error.message}`);
        setQuestions([]);
      } else {
        const questionsData = (data || []).map((q: any) => ({
          id: q.id,
          quiz_type: q.quiz_type,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options as string[],
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
        }));
        setQuestions(questionsData);
        console.log(`✅ Loaded ${questionsData.length} questions from database`);
      }
    } catch (err) {
      console.error('Exception fetching questions:', err);
      toast.error('Error loading questions');
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const resetQuestionForm = () => {
    setFormQuizType('plugin');
    setFormDifficulty('advanced');
    setFormQuestion('');
    setFormOptions(['', '', '', '']);
    setFormCorrectAnswer(0);
    setFormExplanation('');
    setEditingQuestion(null);
  };

  const openEditQuestionDialog = (question: Question) => {
    // If it's a static question, we'll create a new database question instead of editing the static one
    if (question.id.startsWith('static-')) {
      // Pre-fill the form but don't set editingQuestion, so it creates a new question
      setEditingQuestion(null);
      setFormQuizType(question.quiz_type);
      setCurrentDialogQuizType(question.quiz_type);
      setFormDifficulty(question.difficulty);
      setFormQuestion(question.question);
      setFormOptions(question.options);
      setFormCorrectAnswer(question.correct_answer);
      setFormExplanation(question.explanation || '');
      setQuestionDialogOpen(true);
      // Note: No toast message - the dialog title will indicate it's creating a new question
    } else {
      setEditingQuestion(question);
      setFormQuizType(question.quiz_type);
      setCurrentDialogQuizType(question.quiz_type);
      setFormDifficulty(question.difficulty);
      setFormQuestion(question.question);
      setFormOptions(question.options);
      setFormCorrectAnswer(question.correct_answer);
      setFormExplanation(question.explanation || '');
      setQuestionDialogOpen(true);
    }
  };

  const handleSaveQuestion = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured. Please set up your .env file.');
      return;
    }
    if (!formQuestion.trim() || formOptions.some(o => !o.trim())) {
      toast.error('Please fill in all fields');
      return;
    }

    setSavingQuestion(true);

    const questionData = {
      quiz_type: formQuizType,
      difficulty: formDifficulty,
      question: formQuestion,
      options: formOptions,
      correct_answer: formCorrectAnswer,
      explanation: formExplanation || null,
    };

    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('questions')
          .update(questionData as never)
          .eq('id', editingQuestion.id);

        if (error) {
          console.error('Failed to update question:', error);
          toast.error(`Failed to update question: ${error.message}`);
        } else {
          toast.success('Question updated!');
          setQuestionDialogOpen(false);
          resetQuestionForm();
          fetchQuestions();
        }
      } else {
        const { error } = await supabase
          .from('questions')
          .insert(questionData as never);

        if (error) {
          console.error('Failed to create question:', error);
          toast.error(`Failed to create question: ${error.message}`);
        } else {
          toast.success('Question created!');
          setQuestionDialogOpen(false);
          resetQuestionForm();
          fetchQuestions();
        }
      }
    } catch (err) {
      console.error('Error saving question:', err);
      const error = err as Error;
      toast.error(`Failed to save question: ${error.message || 'Unknown error'}`);
    }

    setSavingQuestion(false);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) return;

    // Check if it's a static question
    if (id.startsWith('static-')) {
      // Hide the static question by adding it to the hidden list
      if (!isSupabaseConfigured) {
        toast.error('Supabase is not configured. Cannot hide static questions.');
        return;
      }

      try {
        const newHiddenIds = [...hiddenStaticQuestions, id];
        const { error } = await supabase
          .from('quiz_settings' as never)
          .upsert({
            setting_key: 'hidden_static_questions',
            setting_value: JSON.stringify(newHiddenIds),
          } as never);

        if (error) {
          console.error('Failed to hide static question:', error);
          toast.error(`Failed to hide question: ${error.message}`);
        } else {
          setHiddenStaticQuestions(newHiddenIds);
          toast.success('Static question hidden successfully!');
          // Reload to refresh the display
          loadStaticQuestions();
        }
      } catch (err) {
        console.error('Error hiding static question:', err);
        const error = err as Error;
        toast.error(`Failed to hide question: ${error.message || 'Unknown error'}`);
      }
      return;
    }

    // Delete database question
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete question:', error);
        toast.error(`Failed to delete question: ${error.message}`);
      } else {
        toast.success('Question deleted successfully!');
        fetchQuestions();
      }
    } catch (err) {
      console.error('Error deleting question:', err);
      const error = err as Error;
      toast.error(`Failed to delete question: ${error.message || 'Unknown error'}`);
    }
  };

  const fetchAuthSettings = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const settings = await Promise.all([
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_signup_enabled').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_min_password_length').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_require_email_confirmation').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_google_enabled').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_github_enabled').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_google_client_id').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_google_client_secret').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_github_client_id').single(),
        supabase.from('quiz_settings' as never).select('setting_value').eq('setting_key', 'auth_oauth_github_client_secret').single(),
      ]);

      setAuthSettings({
        signupEnabled: settings[0].data?.setting_value === 'true' || settings[0].data?.setting_value === null,
        minPasswordLength: parseInt(settings[1].data?.setting_value || '6', 10),
        requireEmailConfirmation: settings[2].data?.setting_value === 'true',
        oauthGoogleEnabled: settings[3].data?.setting_value === 'true' || settings[3].data?.setting_value === null,
        oauthGithubEnabled: settings[4].data?.setting_value === 'true' || settings[4].data?.setting_value === null,
        oauthGoogleClientId: settings[5].data?.setting_value || '',
        oauthGoogleClientSecret: settings[6].data?.setting_value || '',
        oauthGithubClientId: settings[7].data?.setting_value || '',
        oauthGithubClientSecret: settings[8].data?.setting_value || '',
      });
    } catch (err) {
      console.error('Error fetching auth settings:', err);
    }
  };

  const saveAuthSettings = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured. Please set up your .env file.');
      return;
    }

    setSavingAuthSettings(true);

    try {
      const settingsToSave = [
        { key: 'auth_signup_enabled', value: authSettings.signupEnabled.toString() },
        { key: 'auth_min_password_length', value: authSettings.minPasswordLength.toString() },
        { key: 'auth_require_email_confirmation', value: authSettings.requireEmailConfirmation.toString() },
        { key: 'auth_oauth_google_enabled', value: authSettings.oauthGoogleEnabled.toString() },
        { key: 'auth_oauth_github_enabled', value: authSettings.oauthGithubEnabled.toString() },
        { key: 'auth_oauth_google_client_id', value: authSettings.oauthGoogleClientId },
        { key: 'auth_oauth_google_client_secret', value: authSettings.oauthGoogleClientSecret },
        { key: 'auth_oauth_github_client_id', value: authSettings.oauthGithubClientId },
        { key: 'auth_oauth_github_client_secret', value: authSettings.oauthGithubClientSecret },
      ];

      const results = await Promise.all(
        settingsToSave.map(async (setting) => {
          try {
            const { data, error } = await supabase
              .from('quiz_settings' as never)
              .upsert({
                setting_key: setting.key,
                setting_value: setting.value || '',
              } as never);
            
            if (error) {
              console.error(`Error saving ${setting.key}:`, error);
              return { error, key: setting.key };
            }
            return { data, error: null, key: setting.key };
          } catch (err) {
            console.error(`Exception saving ${setting.key}:`, err);
            return { error: err as Error, key: setting.key };
          }
        })
      );

      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Failed to save settings:', errors);
        const firstError = errors[0];
        const errorMessage = firstError.error?.message || 'Unknown error';
        toast.error(`Failed to save settings: ${errorMessage}. Check console for details.`);
      } else {
        toast.success('Auth settings saved successfully!');
      }
    } catch (err) {
      console.error('Error saving auth settings:', err);
      const error = err as Error;
      toast.error(`Failed to save auth settings: ${error.message || 'Unknown error'}`);
    }

    setSavingAuthSettings(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {connectionStatus === 'checking' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Checking...</span>
              </div>
            )}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success/20 border border-success/30 rounded-lg">
                <Wifi className="w-4 h-4 text-success" />
                <span className="text-sm text-success font-medium">Backend Connected</span>
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/20 border border-destructive/30 rounded-lg">
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">Backend Disconnected</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await checkConnection();
                await fetchResults();
              }}
              className="h-8 w-8"
              title="Refresh data"
            >
              <Database className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="all-users" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all-users" className="gap-2">
              <Users className="w-4 h-4" />
              All Users
            </TabsTrigger>
            <TabsTrigger value="plugin-quiz" className="gap-2">
              <Puzzle className="w-4 h-4" />
              Plugin Quiz
            </TabsTrigger>
            <TabsTrigger value="theme-quiz" className="gap-2">
              <Palette className="w-4 h-4" />
              Theme Quiz
            </TabsTrigger>
            <TabsTrigger value="selected-users" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Selected User
            </TabsTrigger>
            <TabsTrigger value="pending-users" className="gap-2">
              <Hourglass className="w-4 h-4" />
              Pending User
            </TabsTrigger>
            <TabsTrigger value="blocked-users" className="gap-2">
              <UserX className="w-4 h-4" />
              Blocked Users
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="all-users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Complete list of all registered users</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No users found</p>
                    <p className="text-sm text-muted-foreground">Users will appear here after they register and take quizzes.</p>
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">All User ({users.length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[120px] text-center">Quiz Type</TableHead>
                        <TableHead className="w-[100px] text-center">Score</TableHead>
                        <TableHead className="w-[100px] text-center">Restarts</TableHead>
                        <TableHead className="w-[350px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded inline-block ${
                              user.status === 'selected' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                              user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {user.status === 'selected' ? 'select' : 'pending'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="capitalize">{user.quizType || 'N/A'}</span>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {user.score ? `${user.score}%` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded inline-block ${
                              (user.restartCount || 0) >= 3 ? 'bg-destructive/20 text-destructive border border-destructive/30' :
                              (user.restartCount || 0) >= 2 ? 'bg-warning/20 text-warning border border-warning/30' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {user.restartCount || 0}/3
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'selected')}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'pending')}
                                className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              >
                                <Hourglass className="w-4 h-4 mr-1" />
                                Pending
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugin Quiz Tab */}
          <TabsContent value="plugin-quiz" className="mt-6 space-y-6">
            {/* Questions Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Puzzle className="w-5 h-5" />
                      Plugin Quiz Questions
                    </CardTitle>
                    <CardDescription>Manage questions for Plugin Developer quiz</CardDescription>
                  </div>
                  <Dialog open={questionDialogOpen} onOpenChange={(open) => {
                    setQuestionDialogOpen(open);
                    if (!open) {
                      resetQuestionForm();
                    } else if (!editingQuestion) {
                      // When opening, ensure formQuizType matches the tab
                      setFormQuizType('plugin');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        className="gap-2"
                        onClick={() => {
                          setFormQuizType('plugin');
                          resetQuestionForm();
                          setQuestionDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Question
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingQuestion 
                            ? 'Edit Question' 
                            : formQuestion 
                              ? 'Create New Question (Based on Template)' 
                              : 'Add Plugin Quiz Question'}
                        </DialogTitle>
                        {!editingQuestion && formQuestion && (
                          <DialogDescription className="text-sm text-muted-foreground mt-2">
                            You're editing a default question. Saving will create a new database question that you can modify or delete later.
                          </DialogDescription>
                        )}
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Difficulty</Label>
                            <Select value={formDifficulty} onValueChange={(v) => setFormDifficulty(v as DifficultyLevel)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Question</Label>
                          <Textarea
                            value={formQuestion}
                            onChange={(e) => setFormQuestion(e.target.value)}
                            className="mt-1"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Options</Label>
                          {formOptions.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground w-6">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...formOptions];
                                  newOptions[index] = e.target.value;
                                  setFormOptions(newOptions);
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                              />
                              <input
                                type="radio"
                                name="correctAnswer"
                                checked={formCorrectAnswer === index}
                                onChange={() => setFormCorrectAnswer(index)}
                                className="w-4 h-4"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <Label>Explanation (Optional)</Label>
                          <Textarea
                            value={formExplanation}
                            onChange={(e) => setFormExplanation(e.target.value)}
                            className="mt-1"
                            rows={2}
                            placeholder="Why is this the correct answer?"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveQuestion} disabled={savingQuestion}>
                            {savingQuestion && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingQuestion 
                              ? 'Update Question' 
                              : formQuestion 
                                ? 'Create New Question' 
                                : 'Create Question'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {questionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : [...questions, ...staticQuestions.filter(q => !hiddenStaticQuestions.includes(q.id))].filter(q => q.quiz_type === 'plugin').length === 0 ? (
                  <div className="text-center py-8">
                    <Puzzle className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No plugin questions yet. Add your first question!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...questions, ...staticQuestions.filter(q => !hiddenStaticQuestions.includes(q.id))].filter(q => q.quiz_type === 'plugin').map((q) => {
                      const isStatic = q.id.startsWith('static-');
                      return (
                        <div key={q.id} className={`flex items-start justify-between p-3 border rounded-lg ${isStatic ? 'border-primary/30 bg-primary/5' : ''}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">{q.question}</p>
                              {isStatic && (
                                <span className="text-xs font-medium px-2 py-0.5 bg-primary/20 text-primary rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Correct: {String.fromCharCode(65 + q.correct_answer)}. {q.options[q.correct_answer]}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditQuestionDialog(q)}
                              title={isStatic ? "Edit (creates new database question)" : "Edit question"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-destructive"
                              title={isStatic ? "Hide static question" : "Delete question"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {isStatic && (
                              <span className="text-xs text-muted-foreground px-2" title="Default question">Default</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Users Section */}
            <Card>
              <CardHeader>
                <CardTitle>Plugin Quiz Users</CardTitle>
                <CardDescription>Users who have attended the Plugin Developer quiz</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : users.filter(u => u.quizType === 'plugin' || u.quizType === 'both').length === 0 ? (
                  <div className="text-center py-12">
                    <Puzzle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No plugin quiz users found</p>
                    <p className="text-sm text-muted-foreground">Users will appear here after they complete the Plugin Developer quiz.</p>
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">All User ({users.filter(u => u.quizType === 'plugin' || u.quizType === 'both').length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[100px] text-center">Score</TableHead>
                        <TableHead className="w-[350px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.filter(u => u.quizType === 'plugin' || u.quizType === 'both').map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded inline-block ${
                              user.status === 'selected' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                              user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {user.status === 'selected' ? 'select' : 'pending'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {user.score ? `${user.score}%` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'selected')}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'pending')}
                                className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              >
                                <Hourglass className="w-4 h-4 mr-1" />
                                Pending
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Quiz Tab */}
          <TabsContent value="theme-quiz" className="mt-6 space-y-6">
            {/* Questions Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      Theme Quiz Questions
                    </CardTitle>
                    <CardDescription>Manage questions for Theme Developer quiz</CardDescription>
                  </div>
                  <Dialog open={questionDialogOpen && currentDialogQuizType === 'theme'} onOpenChange={(open) => {
                    setQuestionDialogOpen(open);
                    if (open) {
                      setCurrentDialogQuizType('theme');
                    }
                    if (!open) {
                      resetQuestionForm();
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        className="gap-2"
                        onClick={() => {
                          resetQuestionForm();
                          setFormQuizType('theme');
                          setCurrentDialogQuizType('theme');
                          setQuestionDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Question
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingQuestion 
                            ? 'Edit Question' 
                            : formQuestion 
                              ? 'Create New Question (Based on Template)' 
                              : 'Add Theme Quiz Question'}
                        </DialogTitle>
                        {!editingQuestion && formQuestion && (
                          <DialogDescription className="text-sm text-muted-foreground mt-2">
                            You're editing a default question. Saving will create a new database question that you can modify or delete later.
                          </DialogDescription>
                        )}
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Difficulty</Label>
                            <Select value={formDifficulty} onValueChange={(v) => setFormDifficulty(v as DifficultyLevel)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Question</Label>
                          <Textarea
                            value={formQuestion}
                            onChange={(e) => setFormQuestion(e.target.value)}
                            className="mt-1"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Options</Label>
                          {formOptions.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground w-6">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...formOptions];
                                  newOptions[index] = e.target.value;
                                  setFormOptions(newOptions);
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                              />
                              <input
                                type="radio"
                                name="correctAnswer"
                                checked={formCorrectAnswer === index}
                                onChange={() => setFormCorrectAnswer(index)}
                                className="w-4 h-4"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <Label>Explanation (Optional)</Label>
                          <Textarea
                            value={formExplanation}
                            onChange={(e) => setFormExplanation(e.target.value)}
                            className="mt-1"
                            rows={2}
                            placeholder="Why is this the correct answer?"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveQuestion} disabled={savingQuestion}>
                            {savingQuestion && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingQuestion 
                              ? 'Update Question' 
                              : formQuestion 
                                ? 'Create New Question' 
                                : 'Create Question'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {questionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : [...questions, ...staticQuestions.filter(q => !hiddenStaticQuestions.includes(q.id))].filter(q => q.quiz_type === 'theme').length === 0 ? (
                  <div className="text-center py-8">
                    <Palette className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No theme questions yet. Add your first question!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...questions, ...staticQuestions.filter(q => !hiddenStaticQuestions.includes(q.id))].filter(q => q.quiz_type === 'theme').map((q) => {
                      const isStatic = q.id.startsWith('static-');
                      return (
                      <div key={q.id} className={`flex items-start justify-between p-3 border rounded-lg ${isStatic ? 'border-primary/30 bg-primary/5' : ''}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">{q.question}</p>
                            {isStatic && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-primary/20 text-primary rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Correct: {String.fromCharCode(65 + q.correct_answer)}. {q.options[q.correct_answer]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditQuestionDialog(q)}
                            title={isStatic ? "Edit (creates new database question)" : "Edit question"}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-destructive"
                            title={isStatic ? "Hide static question" : "Delete question"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isStatic && (
                            <span className="text-xs text-muted-foreground px-2" title="Default question">Default</span>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Users Section */}
            <Card>
              <CardHeader>
                <CardTitle>Theme Quiz Users</CardTitle>
                <CardDescription>Users who have attended the Theme Developer quiz</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : users.filter(u => u.quizType === 'theme' || u.quizType === 'both').length === 0 ? (
                  <div className="text-center py-12">
                    <Palette className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No theme quiz users found</p>
                    <p className="text-sm text-muted-foreground">Users will appear here after they complete the Theme Developer quiz.</p>
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">All User ({users.filter(u => u.quizType === 'theme' || u.quizType === 'both').length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[100px] text-center">Score</TableHead>
                        <TableHead className="w-[350px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.filter(u => u.quizType === 'theme' || u.quizType === 'both').map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded inline-block ${
                              user.status === 'selected' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                              user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {user.status === 'selected' ? 'select' : 'pending'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {user.score ? `${user.score}%` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'selected')}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'pending')}
                                className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              >
                                <Hourglass className="w-4 h-4 mr-1" />
                                Pending
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Selected Users Tab */}
          <TabsContent value="selected-users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Selected Users</CardTitle>
                <CardDescription>Users who have been selected based on their quiz performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">All User ({users.filter(u => u.status === 'selected').length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Quiz Type</TableHead>
                        <TableHead className="w-[100px] text-center">Score</TableHead>
                        <TableHead className="w-[350px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.filter(u => u.status === 'selected').map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className="capitalize">{user.quizType || 'N/A'}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-success font-medium">{user.score ? `${user.score}%` : 'N/A'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'selected')}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'pending')}
                                className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              >
                                <Hourglass className="w-4 h-4 mr-1" />
                                Pending
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Users Tab */}
          <TabsContent value="pending-users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Users</CardTitle>
                <CardDescription>Users who have pending status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">All User ({users.filter(u => u.status === 'pending').length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Quiz Type</TableHead>
                        <TableHead className="w-[100px] text-center">Score</TableHead>
                        <TableHead className="w-[350px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.filter(u => u.status === 'pending').map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className="capitalize">{user.quizType || 'N/A'}</span>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {user.score ? `${user.score}%` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'selected')}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Select
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserStatus(user.id, 'pending')}
                                className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                              >
                                <Hourglass className="w-4 h-4 mr-1" />
                                Pending
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocked Users Tab */}
          <TabsContent value="blocked-users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Blocked Users</CardTitle>
                <CardDescription>Users who have been blocked due to violations (3 warnings reached)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">User ({users.filter(u => u.isBlocked).length})</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px] text-center">Warnings</TableHead>
                        <TableHead className="w-[120px] text-center">Restarts</TableHead>
                        <TableHead className="w-[200px]">Block Reason</TableHead>
                        <TableHead className="w-[150px]">Blocked At</TableHead>
                        <TableHead className="w-[200px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.filter(u => u.isBlocked).map((user, index) => (
                        <TableRow key={user.id} className="bg-destructive/5">
                          <TableCell className="font-medium">{index + 1}. {user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                              {user.warningCount || 3}/3
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                              {user.restartCount || 0}/3
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.blockedReason || 'No reason provided'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(user.blockedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => unblockUser(user.id, user.name)}
                                className="text-success hover:text-success hover:bg-success/10"
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Unban
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUserResults(user.id, user.name)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.filter(u => u.isBlocked).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No blocked users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Login & Signup Configuration</CardTitle>
                <CardDescription>Configure authentication settings for your application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Signup Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="signup-enabled" className="text-base font-medium">
                        Enable Signup
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow new users to create accounts
                      </p>
                    </div>
                    <Switch
                      id="signup-enabled"
                      checked={authSettings.signupEnabled}
                      onCheckedChange={(checked) =>
                        setAuthSettings({ ...authSettings, signupEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-confirmation" className="text-base font-medium">
                        Require Email Confirmation
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Users must confirm their email before accessing the app
                      </p>
                    </div>
                    <Switch
                      id="email-confirmation"
                      checked={authSettings.requireEmailConfirmation}
                      onCheckedChange={(checked) =>
                        setAuthSettings({ ...authSettings, requireEmailConfirmation: checked })
                      }
                    />
                  </div>
                </div>

                {/* Password Settings */}
                <div className="space-y-4 p-4 border border-border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="min-password-length" className="text-base font-medium">
                      Minimum Password Length
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Set the minimum number of characters required for passwords
                    </p>
                    <Input
                      id="min-password-length"
                      type="number"
                      min="4"
                      max="32"
                      value={authSettings.minPasswordLength}
                      onChange={(e) =>
                        setAuthSettings({
                          ...authSettings,
                          minPasswordLength: parseInt(e.target.value, 10) || 6,
                        })
                      }
                      className="w-32"
                    />
                  </div>
                </div>

                {/* OAuth Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">OAuth Providers</h3>
                  
                  {/* Google OAuth */}
                  <div className="p-4 border border-border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="oauth-google" className="text-base font-medium">
                          Google OAuth
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable Google sign-in option
                        </p>
                      </div>
                      <Switch
                        id="oauth-google"
                        checked={authSettings.oauthGoogleEnabled}
                        onCheckedChange={(checked) =>
                          setAuthSettings({ ...authSettings, oauthGoogleEnabled: checked })
                        }
                      />
                    </div>
                    
                    {authSettings.oauthGoogleEnabled && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="space-y-2">
                          <Label htmlFor="google-client-id" className="text-sm font-medium">
                            Google Client ID
                          </Label>
                          <Input
                            id="google-client-id"
                            type="text"
                            placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
                            value={authSettings.oauthGoogleClientId}
                            onChange={(e) =>
                              setAuthSettings({ ...authSettings, oauthGoogleClientId: e.target.value })
                            }
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Get this from Google Cloud Console → APIs & Services → Credentials
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="google-client-secret" className="text-sm font-medium">
                            Google Client Secret
                          </Label>
                          <Input
                            id="google-client-secret"
                            type="password"
                            placeholder="GOCSPX-abcdefghijklmnopqrstuvwxyz"
                            value={authSettings.oauthGoogleClientSecret}
                            onChange={(e) =>
                              setAuthSettings({ ...authSettings, oauthGoogleClientSecret: e.target.value })
                            }
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Keep this secret! Never share it publicly.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GitHub OAuth */}
                  <div className="p-4 border border-border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="oauth-github" className="text-base font-medium">
                          GitHub OAuth
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable GitHub sign-in option
                        </p>
                      </div>
                      <Switch
                        id="oauth-github"
                        checked={authSettings.oauthGithubEnabled}
                        onCheckedChange={(checked) =>
                          setAuthSettings({ ...authSettings, oauthGithubEnabled: checked })
                        }
                      />
                    </div>
                    
                    {authSettings.oauthGithubEnabled && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="space-y-2">
                          <Label htmlFor="github-client-id" className="text-sm font-medium">
                            GitHub Client ID
                          </Label>
                          <Input
                            id="github-client-id"
                            type="text"
                            placeholder="Iv1.abcdefghijklmnop"
                            value={authSettings.oauthGithubClientId}
                            onChange={(e) =>
                              setAuthSettings({ ...authSettings, oauthGithubClientId: e.target.value })
                            }
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Get this from GitHub → Settings → Developer settings → OAuth Apps
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="github-client-secret" className="text-sm font-medium">
                            GitHub Client Secret
                          </Label>
                          <Input
                            id="github-client-secret"
                            type="password"
                            placeholder="abcdefghijklmnopqrstuvwxyz123456789"
                            value={authSettings.oauthGithubClientSecret}
                            onChange={(e) =>
                              setAuthSettings({ ...authSettings, oauthGithubClientSecret: e.target.value })
                            }
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Keep this secret! Never share it publicly.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={saveAuthSettings}
                    disabled={savingAuthSettings}
                    className="gap-2"
                  >
                    {savingAuthSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Results Table - Keep for backward compatibility */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quiz Results</CardTitle>
            <CardDescription>
              Detailed view of all quiz attempts with correct/wrong answers and completion time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No quiz results yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Email</TableHead>
                      <TableHead>Quiz Type</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Correct</TableHead>
                      <TableHead>Wrong</TableHead>
                      <TableHead>Time Taken</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">
                          {result.userEmail || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{result.quizType}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium px-2 py-0.5 bg-secondary rounded capitalize">
                            {result.difficulty}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {Math.round((result.score / result.totalQuestions) * 100)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-success font-mono">
                            {result.correctAnswers}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-destructive font-mono">
                            {result.wrongAnswers}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {formatTime(result.timeTakenSeconds)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(result.completedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDetails(result)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quiz Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of answers for this quiz attempt
              </DialogDescription>
            </DialogHeader>
            {selectedResult && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">User Email</p>
                    <p className="font-medium">{selectedResult.userEmail || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quiz Type</p>
                    <p className="font-medium capitalize">{selectedResult.quizType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="font-medium">
                      {selectedResult.score}/{selectedResult.totalQuestions} (
                      {Math.round((selectedResult.score / selectedResult.totalQuestions) * 100)}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time Taken</p>
                    <p className="font-medium">{formatTime(selectedResult.timeTakenSeconds)}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Question-by-Question Breakdown</h3>
                  <div className="space-y-4">
                    {selectedResult.detailedAnswers.map((answer, index) => (
                      <Card
                        key={index}
                        className={answer.isCorrect ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Question {index + 1}</span>
                              {answer.isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              answer.isCorrect
                                ? 'bg-success/20 text-success'
                                : 'bg-destructive/20 text-destructive'
                            }`}>
                              {answer.isCorrect ? 'Correct' : 'Wrong'}
                            </span>
                          </div>
                          <p className="text-sm mb-3">{answer.question}</p>
                          <div className="space-y-1">
                            {answer.options.map((option, optIndex) => {
                              const isUserAnswer = answer.userAnswer === optIndex;
                              const isCorrectAnswer = answer.correctAnswer === optIndex;
                              return (
                                <div
                                  key={optIndex}
                                  className={`text-sm p-2 rounded ${
                                    isCorrectAnswer
                                      ? 'bg-success/20 border border-success/30'
                                      : isUserAnswer && !isCorrectAnswer
                                      ? 'bg-destructive/20 border border-destructive/30'
                                      : 'bg-secondary/30'
                                  }`}
                                >
                                  <span className="font-medium">
                                    {String.fromCharCode(65 + optIndex)}.{' '}
                                  </span>
                                  {option}
                                  {isCorrectAnswer && (
                                    <span className="ml-2 text-xs text-success font-medium">
                                      ✓ Correct Answer
                                    </span>
                                  )}
                                  {isUserAnswer && !isCorrectAnswer && (
                                    <span className="ml-2 text-xs text-destructive font-medium">
                                      ✗ User's Answer
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminFirestore;

