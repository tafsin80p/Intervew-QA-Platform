import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { wordpressQuestions } from '@/data/questions';
import { themeQuestions } from '@/data/themeQuestions';
import { ADMIN_EMAIL, isAdminEmail } from '@/constants/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Puzzle,
  Palette,
  Loader2,
  Clock,
  BarChart3,
  Settings as SettingsIcon,
  Users,
  CheckCircle2,
  XCircle,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

type QuizType = 'plugin' | 'theme';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

interface SupabaseQuestion {
  id: string;
  quiz_type: QuizType;
  difficulty: DifficultyLevel;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseQuizResult {
  id: string;
  user_id: string;
  quiz_type: QuizType;
  difficulty: DifficultyLevel;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
  profiles?: {
    display_name: string | null;
    user_id: string;
  } | null;
}

interface SupabaseProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  violation_count: number;
  created_at: string;
  updated_at: string;
}

interface Question {
  id: string;
  quiz_type: QuizType;
  difficulty: DifficultyLevel;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
}

interface QuizResult {
  id: string;
  user_id: string;
  quiz_type: QuizType;
  difficulty: DifficultyLevel;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
  display_name: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  violation_count: number;
  created_at: string;
  updated_at: string;
}

interface QuizSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  created_at: string;
  updated_at: string;
}

interface BlockedUser {
  id: string;
  user_id: string;
  blocked_at: string;
  blocked_by: string | null;
  reason: string | null;
  violation_type: string | null;
  unblocked_at: string | null;
  unblocked_by: string | null;
}

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [staticQuestions, setStaticQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [filterType, setFilterType] = useState<QuizType | 'all'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [quizDuration, setQuizDuration] = useState(20);
  const [savingDuration, setSavingDuration] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [savingLogo, setSavingLogo] = useState(false);
  
  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('WordPress Quiz');
  const [savingSMTP, setSavingSMTP] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  
  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Connection Status
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Form state
  const [formQuizType, setFormQuizType] = useState<QuizType>('plugin');
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>('advanced');
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState(['', '', '', '']);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState(0);
  const [formExplanation, setFormExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      // Check if user is logged in
      if (!user) {
        navigate('/');
        toast.error('Access denied. Please login first.');
        return;
      }
      
      // Check if user email matches admin email
      const userEmail = user.email?.toLowerCase().trim();
      if (!isAdminEmail(userEmail)) {
        navigate('/');
        toast.error('Access denied. Admin only.');
        return;
      }
      
      // If email matches, ensure admin role is granted (don't wait for isAdmin state)
      // The checkAdminRole function will handle granting the role
      // We'll allow access if email matches, even if isAdmin isn't set yet
    }
  }, [user, authLoading, navigate]);

  const checkConnection = async () => {
    if (!isSupabaseConfigured) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('checking');
    try {
      // Try a simple query to check connection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 3 seconds')), 3000)
      );

      const queryPromise = supabase
        .from('quiz_settings' as never)
        .select('setting_value')
        .eq('setting_key', 'quiz_duration_minutes')
        .single();

      const result = await Promise.race([queryPromise, timeoutPromise]) as { data: { setting_value: string } | null; error: unknown } | Error;

      if (result && 'error' in result && result.error) {
        // If it's a 404, the setting doesn't exist but DB is connected
        const error = result.error as { message?: string; code?: string };
        if (error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.log('✅ Supabase connection successful (setting not found, but DB is accessible)');
          setConnectionStatus('connected');
        } else {
          console.error('Connection check error:', result.error);
          setConnectionStatus('disconnected');
        }
      } else if (result && 'data' in result) {
        console.log('✅ Supabase connection successful');
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      const error = err as Error;
      if (error?.message?.includes('timeout')) {
        console.error('Connection check timed out - Supabase may be unreachable');
      }
      setConnectionStatus('disconnected');
    }
  };

  useEffect(() => {
    // Fetch data if user email matches admin email
    if (user && isAdminEmail(user.email)) {
      // Check connection status
      checkConnection();
      
      // Always load static questions
      loadStaticQuestions();
      
      if (isSupabaseConfigured) {
        fetchQuestions();
        fetchSettings();
        fetchResults();
        fetchUsers();
      } else {
        // Supabase not configured - show message
        toast.warning('Supabase not configured. Admin features require database connection.');
        setLoading(false);
        setResultsLoading(false);
      }
    }
  }, [user]);

  const loadStaticQuestions = () => {
    const staticPluginQuestions: Question[] = wordpressQuestions.map((q) => ({
      id: `static-plugin-${q.id}`,
      quiz_type: 'plugin' as QuizType,
      difficulty: 'advanced' as DifficultyLevel,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || null,
    }));

    const staticThemeQuestions: Question[] = themeQuestions.map((q) => ({
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

  const fetchQuestions = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - using static questions only');
      setQuestions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching questions from Supabase...');
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching questions:', error);
        toast.error(`Failed to load questions: ${error.message}`);
        setQuestions([]);
      } else {
        // Convert Supabase format to local format
        const questionsData = data as SupabaseQuestion[] | null;
        const convertedQuestions: Question[] = (questionsData || []).map((q: SupabaseQuestion) => ({
          id: q.id,
          quiz_type: q.quiz_type,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options as string[],
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
        }));
        
        console.log(`Successfully loaded ${convertedQuestions.length} questions from database`);
        setQuestions(convertedQuestions);
        if (convertedQuestions.length === 0) {
          toast.info('No questions found in database. Using static questions.');
        }
      }
    } catch (err) {
      console.error('Exception fetching questions:', err);
      const error = err as Error;
      toast.error(`Error loading questions: ${error?.message || 'Unknown error'}`);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - using default settings');
      setQuizDuration(20);
      setLogoUrl('');
      return;
    }

    try {
      console.log('Fetching settings from Supabase...');
      
      // Fetch all settings at once
      const { data: settingsData, error } = await supabase
        .from('quiz_settings' as never)
        .select('setting_key, setting_value')
        .in('setting_key', [
          'quiz_duration_minutes',
          'landing_logo_url',
          'smtp_host',
          'smtp_port',
          'smtp_secure',
          'smtp_username',
          'smtp_password',
          'smtp_from_email',
          'smtp_from_name'
        ]);

      if (error) {
        console.error('Error fetching settings:', error);
        setQuizDuration(20);
        setLogoUrl('');
        return;
      }

      interface SettingRow {
        setting_key: string;
        setting_value: string;
      }
      const settingsMap = new Map((settingsData || []).map((s: SettingRow) => [s.setting_key, s.setting_value]));

      const getSettingValue = (key: string): string => {
        return settingsMap.get(key) || '';
      };

      setQuizDuration(parseInt(getSettingValue('quiz_duration_minutes')) || 20);
      setLogoUrl(getSettingValue('landing_logo_url'));

      // Load SMTP settings
      setSmtpHost(getSettingValue('smtp_host'));
      setSmtpPort(parseInt(getSettingValue('smtp_port') || '587'));
      setSmtpSecure(getSettingValue('smtp_secure') === 'true');
      setSmtpUsername(getSettingValue('smtp_username'));
      setSmtpPassword(getSettingValue('smtp_password'));
      setSmtpFromEmail(getSettingValue('smtp_from_email'));
      setSmtpFromName(getSettingValue('smtp_from_name') || 'WordPress Quiz');
    } catch (err) {
      console.error('Error fetching settings:', err);
      const error = err as Error;
      toast.error(`Error loading settings: ${error?.message || 'Unknown error'}`);
      setQuizDuration(20);
      setLogoUrl('');
    }
  };

  const fetchResults = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot load results');
      setResults([]);
      setResultsLoading(false);
      return;
    }

    setResultsLoading(true);
    try {
      console.log('Fetching results from Supabase...');
      const { data: resultsData, error } = await supabase
        .from('quiz_results')
        .select(`
          *,
          profiles!quiz_results_user_id_fkey (
            display_name,
            user_id
          )
        `)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching results:', error);
        toast.error(`Failed to load results: ${error.message}`);
        setResultsLoading(false);
        return;
      }

      // Convert Supabase format to local format
      const resultsArray = resultsData as unknown as SupabaseQuizResult[] | null;
      const convertedResults: QuizResult[] = (resultsArray || []).map((r: SupabaseQuizResult) => ({
        id: r.id,
        user_id: r.user_id,
        quiz_type: r.quiz_type,
        difficulty: r.difficulty,
        score: r.score,
        total_questions: r.total_questions,
        time_taken_seconds: r.time_taken_seconds,
        completed_at: r.completed_at,
        display_name: (r.profiles as { display_name?: string | null } | null)?.display_name || null,
      }));

      console.log(`Successfully loaded ${convertedResults.length} results from database`);
      setResults(convertedResults);
    } catch (err) {
      console.error('Exception fetching results:', err);
      const error = err as Error;
      toast.error(`Error loading results: ${error?.message || 'Unknown error'}`);
    } finally {
      setResultsLoading(false);
    }
  };

  const saveQuizDuration = async () => {
    if (quizDuration < 1 || quizDuration > 120) {
      toast.error('Duration must be between 1 and 120 minutes');
      return;
    }

    setSavingDuration(true);
    const { error } = await supabase
      .from('quiz_settings' as never)
      .upsert({
        setting_key: 'quiz_duration_minutes',
        setting_value: quizDuration.toString(),
      } as never);

    if (error) {
      toast.error('Failed to save duration');
    } else {
      toast.success('Quiz duration updated!');
    }
    setSavingDuration(false);
  };

  const saveLogoUrl = async () => {
    setSavingLogo(true);
    const { error } = await supabase
      .from('quiz_settings' as never)
      .upsert({
        setting_key: 'landing_logo_url',
        setting_value: logoUrl.trim() || '',
      } as never);

    if (error) {
      toast.error('Failed to save logo URL');
    } else {
      toast.success('Logo URL updated!');
    }
    setSavingLogo(false);
  };

  const saveSMTPConfig = async () => {
    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !smtpFromEmail) {
      toast.error('Please fill in all required SMTP fields');
      return;
    }

    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured. Please set up your .env file.');
      return;
    }

    setSavingSMTP(true);
    try {
      const settings = [
        { key: 'smtp_host', value: smtpHost.trim() },
        { key: 'smtp_port', value: smtpPort.toString() },
        { key: 'smtp_secure', value: smtpSecure.toString() },
        { key: 'smtp_username', value: smtpUsername.trim() },
        { key: 'smtp_password', value: smtpPassword },
        { key: 'smtp_from_email', value: smtpFromEmail.trim() },
        { key: 'smtp_from_name', value: smtpFromName.trim() || 'WordPress Quiz' },
      ];

      const promises = settings.map(setting =>
        supabase
          .from('quiz_settings' as never)
          .upsert({
            setting_key: setting.key,
            setting_value: setting.value,
          } as never)
      );

      const results = await Promise.all(promises);
      
      // Check for errors and log them
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.error) {
          const settingKey = settings[index].key;
          const errorMessage = (result.error as { message?: string }).message || 'Unknown error';
          console.error(`Failed to save ${settingKey}:`, result.error);
          errors.push(`${settingKey}: ${errorMessage}`);
        }
      });

      if (errors.length > 0) {
        console.error('SMTP save errors:', errors);
        // Show the first meaningful error
        const firstError = errors.find(e => !e.includes(':')) || errors[0];
        toast.error(`Failed to save SMTP configuration: ${firstError}`);
      } else {
        toast.success('SMTP configuration saved successfully!');
      }
    } catch (err) {
      console.error('Error saving SMTP config:', err);
      const error = err as Error;
      toast.error(`Failed to save SMTP configuration: ${error.message || 'Unknown error'}`);
    } finally {
      setSavingSMTP(false);
    }
  };

  const testSMTP = async () => {
    if (!smtpFromEmail) {
      toast.error('Please configure SMTP settings first');
      return;
    }

    setTestingEmail(true);
    try {
      // Note: This requires a backend API endpoint at /api/send-email
      // You'll need to create this endpoint using a backend API (e.g., Express, Node.js)
      toast.info('SMTP test requires a backend API endpoint. Please configure /api/send-email endpoint.');
    } catch (err) {
      console.error('Error testing SMTP:', err);
      toast.error('Failed to send test email');
    }
    setTestingEmail(false);
  };

  const fetchUsers = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - cannot load users');
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    try {
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          *,
          auth.users!profiles_user_id_fkey (
            email,
            email_confirmed_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load users:', error);
        toast.error(`Failed to load users: ${error.message}`);
        setUsersLoading(false);
        return;
      }

      if (!usersData) {
        console.warn('No data returned from profiles');
        toast.warning('No users found or data not available');
        setUsers([]);
        setUsersLoading(false);
        return;
      }

      // Convert Supabase format to local format
      const convertedUsers: UserProfile[] = (usersData as unknown as SupabaseProfile[]).map((u: SupabaseProfile) => ({
        id: u.id,
        user_id: u.user_id,
        display_name: u.display_name || null,
        avatar_url: u.avatar_url || undefined,
        email_verified: u.email_verified || false,
        is_blocked: u.is_blocked || false,
        blocked_reason: u.blocked_reason || null,
        blocked_at: u.blocked_at || null,
        violation_count: u.violation_count || 0,
        created_at: u.created_at,
        updated_at: u.updated_at,
      }));

      console.log(`✅ Loaded ${convertedUsers.length} users`);
      setUsers(convertedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      const error = err as Error;
      toast.error(`Failed to load users: ${error.message || 'Unknown error'}`);
    } finally {
      setUsersLoading(false);
    }
  };

  const blockUser = async (userId: string, reason: string) => {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date().toISOString(),
        } as never)
        .eq('user_id', userId);

      if (!updateError) {
        await supabase
          .from('blocked_users' as never)
          .insert({
            user_id: userId,
            reason,
          } as never);
      }

      const { error } = { error: updateError };

      if (error) {
        toast.error('Failed to block user');
        return;
      }

      toast.success('User blocked successfully');
      fetchUsers();
    } catch (err) {
      console.error('Error blocking user:', err);
      toast.error('Failed to block user');
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
        } as never)
        .eq('user_id', userId);

      if (error) {
        toast.error('Failed to unblock user');
        return;
      }

      toast.success('User unblocked successfully');
      fetchUsers();
    } catch (err) {
      console.error('Error unblocking user:', err);
      toast.error('Failed to unblock user');
    }
  };

  const resetForm = () => {
    setFormQuizType('plugin');
    setFormDifficulty('advanced');
    setFormQuestion('');
    setFormOptions(['', '', '', '']);
    setFormCorrectAnswer(0);
    setFormExplanation('');
    setEditingQuestion(null);
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setFormQuizType(question.quiz_type);
    setFormDifficulty(question.difficulty);
    setFormQuestion(question.question);
    setFormOptions(question.options);
    setFormCorrectAnswer(question.correct_answer);
    setFormExplanation(question.explanation || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured. Please set up your .env file.');
      return;
    }
    if (!formQuestion.trim() || formOptions.some(o => !o.trim())) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);

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
          console.log('✅ Question updated successfully');
          toast.success('Question updated!');
          setDialogOpen(false);
          resetForm();
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
          console.log('✅ Question created successfully');
          toast.success('Question created!');
          setDialogOpen(false);
          resetForm();
          fetchQuestions();
        }
      }
    } catch (err) {
      console.error('Error saving question:', err);
      const error = err as Error;
      toast.error(`Failed to save question: ${error.message || 'Unknown error'}`);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete question');
    } else {
      toast.success('Question deleted!');
      fetchQuestions();
    }
  };

  // Combine database questions and static questions
  const allQuestions = [...questions, ...staticQuestions];
  
  const filteredQuestions = allQuestions.filter(q => {
    if (filterType !== 'all' && q.quiz_type !== filterType) return false;
    if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
    return true;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = {
    totalAttempts: results.length,
    uniqueUsers: new Set(results.map(r => r.user_id)).size,
    averageScore: results.length > 0
      ? Math.round((results.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0) / results.length))
      : 0,
    pluginAttempts: results.filter(r => r.quiz_type === 'plugin').length,
    themeAttempts: results.filter(r => r.quiz_type === 'theme').length,
  };

  // Show loading only if auth is loading
  const userIsAdmin = isAdminEmail(user?.email);
  
  // Debug logging
  useEffect(() => {
    console.log('Admin Page Debug:', {
      authLoading,
      hasUser: !!user,
      userEmail: user?.email,
      userIsAdmin,
      adminEmail: ADMIN_EMAIL,
    });
  }, [authLoading, user, userIsAdmin]);
  
  // If auth is still loading, show loader
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // If no user or email doesn't match, redirect
  if (!user) {
    navigate('/');
    return null;
  }
  
  if (!userIsAdmin) {
    navigate('/');
    toast.error('Access denied. Admin only.');
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            </div>
          </div>
          
          {/* Connection Status */}
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
                <span className="text-sm text-success font-medium">Supabase Connected</span>
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/20 border border-destructive/30 rounded-lg">
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">Supabase Disconnected</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={checkConnection}
              className="h-8 w-8"
              title="Refresh connection status"
            >
              <Database className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="questions" className="gap-2">
              <Puzzle className="w-4 h-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Results
            </TabsTrigger>
          </TabsList>

          {/* Questions Tab */}
          <TabsContent value="questions" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Manage Questions</h2>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingQuestion ? 'Edit Question' : 'Add New Question'}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Quiz Type</Label>
                        <Select value={formQuizType} onValueChange={(v) => setFormQuizType(v as QuizType)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plugin">Plugin Developer</SelectItem>
                            <SelectItem value="theme">Theme Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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
                      <p className="text-xs text-muted-foreground">
                        Select the radio button next to the correct answer
                      </p>
                    </div>

                    <div>
                      <Label>Explanation</Label>
                      <Textarea
                        value={formExplanation}
                        onChange={(e) => setFormExplanation(e.target.value)}
                        className="mt-1"
                        rows={2}
                        placeholder="Why is this the correct answer?"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingQuestion ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Type:</Label>
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as QuizType | 'all')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="plugin">Plugin</SelectItem>
                      <SelectItem value="theme">Theme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">Difficulty:</Label>
                  <Select value={filterDifficulty} onValueChange={(v) => setFilterDifficulty(v as DifficultyLevel | 'all')}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <span className="text-sm text-muted-foreground ml-auto">
                  {filteredQuestions.length} questions
                </span>
              </div>
            </div>

            {/* Questions List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-muted-foreground">No questions found. Add your first question!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((q) => {
                  const isStatic = q.id.startsWith('static-');
                  return (
                    <div 
                      key={q.id} 
                      className={`bg-card border rounded-xl p-4 ${isStatic ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {q.quiz_type === 'plugin' ? (
                              <Puzzle className="w-4 h-4 text-primary" />
                            ) : (
                              <Palette className="w-4 h-4 text-accent" />
                            )}
                            <span className="text-xs font-medium px-2 py-0.5 bg-secondary rounded capitalize">
                              {q.difficulty}
                            </span>
                            {isStatic && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-primary/20 text-primary rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-foreground font-medium">{q.question}</p>
                          <div className="mt-2 text-sm text-muted-foreground">
                            Correct: {String.fromCharCode(65 + q.correct_answer)}. {q.options[q.correct_answer]}
                          </div>
                          {q.explanation && (
                            <div className="mt-2 text-xs text-muted-foreground italic">
                              {q.explanation}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!isStatic && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(q)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(q.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {isStatic && (
                            <span className="text-xs text-muted-foreground px-2">Read-only</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Quiz Settings
              </h2>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="duration" className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" />
                    Quiz Duration (minutes)
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      max="120"
                      value={quizDuration}
                      onChange={(e) => setQuizDuration(parseInt(e.target.value) || 20)}
                      className="w-32"
                    />
                    <Button onClick={saveQuizDuration} disabled={savingDuration}>
                      {savingDuration && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Duration
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Set the time limit for quiz completion (1-120 minutes)
                  </p>
                </div>

                <div className="border-t border-border pt-6">
                  <Label htmlFor="logo" className="flex items-center gap-2 mb-2">
                    <SettingsIcon className="w-4 h-4" />
                    Landing Page Logo
                  </Label>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        id="logo"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={saveLogoUrl} disabled={savingLogo}>
                        {savingLogo && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Logo
                      </Button>
                    </div>
                    {logoUrl && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                        <div className="bg-secondary/30 border border-border rounded-lg p-4 flex items-center justify-center min-h-[100px]">
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="max-w-full max-h-32 object-contain"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = 'none';
                              const parent = img.parentElement;
                              if (parent && !parent.querySelector('.error-message')) {
                                const errorMsg = document.createElement('p');
                                errorMsg.className = 'text-sm text-destructive error-message';
                                errorMsg.textContent = 'Failed to load image. Please check the URL.';
                                parent.appendChild(errorMsg);
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Enter a URL to an image file (PNG, JPG, SVG, etc.). Leave empty to use the default icon.
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <Label className="flex items-center gap-2 mb-4">
                    <SettingsIcon className="w-4 h-4" />
                    SMTP Email Configuration
                  </Label>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtp_host">SMTP Host *</Label>
                        <Input
                          id="smtp_host"
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_port">SMTP Port *</Label>
                        <Input
                          id="smtp_port"
                          type="number"
                          placeholder="587"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtp_secure"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="smtp_secure">Use SSL/TLS (secure connection)</Label>
                    </div>
                    <div>
                      <Label htmlFor="smtp_username">SMTP Username *</Label>
                      <Input
                        id="smtp_username"
                        type="text"
                        placeholder="your-email@gmail.com"
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp_password">SMTP Password *</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        placeholder="Your SMTP password or app password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtp_from_email">From Email *</Label>
                        <Input
                          id="smtp_from_email"
                          type="email"
                          placeholder="noreply@example.com"
                          value={smtpFromEmail}
                          onChange={(e) => setSmtpFromEmail(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_from_name">From Name</Label>
                        <Input
                          id="smtp_from_name"
                          type="text"
                          placeholder="WordPress Quiz"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button onClick={saveSMTPConfig} disabled={savingSMTP}>
                        {savingSMTP && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save SMTP Config
                      </Button>
                      <Button variant="outline" onClick={testSMTP} disabled={testingEmail || !smtpFromEmail}>
                        {testingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Test Email
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure SMTP settings to enable email confirmation and notifications. 
                      Note: You'll need to set up a backend API endpoint at /api/send-email to actually send emails.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </h2>

              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <p className="text-muted-foreground">No users found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((userProfile) => (
                    <div
                      key={userProfile.id}
                      className={`bg-card border rounded-xl p-4 ${
                        userProfile.is_blocked ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-foreground">
                              {userProfile.display_name || 'No name'}
                            </span>
                            {userProfile.is_blocked && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-destructive/20 text-destructive rounded">
                                Blocked
                              </span>
                            )}
                            {userProfile.email_verified && (
                              <span className="text-xs font-medium px-2 py-0.5 bg-success/20 text-success rounded">
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            User ID: {userProfile.user_id}
                          </p>
                          {userProfile.is_blocked && userProfile.blocked_reason && (
                            <p className="text-sm text-destructive mt-2">
                              Reason: {userProfile.blocked_reason}
                            </p>
                          )}
                          {userProfile.violation_count > 0 && (
                            <p className="text-sm text-warning mt-1">
                              Violations: {userProfile.violation_count}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {userProfile.is_blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unblockUser(userProfile.user_id)}
                              className="text-success"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Unblock
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const reason = prompt('Enter reason for blocking:');
                                if (reason) {
                                  blockUser(userProfile.user_id, reason);
                                }
                              }}
                              className="text-destructive"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Block
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Quiz Results & Statistics
              </h2>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <Users className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                  <p className="text-xs text-muted-foreground">Unique Users</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <BarChart3 className="w-5 h-5 text-accent mb-2" />
                  <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                  <p className="text-xs text-muted-foreground">Total Attempts</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-success mb-2" />
                  <p className="text-2xl font-bold">{stats.averageScore}%</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <Puzzle className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold">{stats.pluginAttempts}</p>
                  <p className="text-xs text-muted-foreground">Plugin Quizzes</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <Palette className="w-5 h-5 text-accent mb-2" />
                  <p className="text-2xl font-bold">{stats.themeAttempts}</p>
                  <p className="text-xs text-muted-foreground">Theme Quizzes</p>
                </div>
              </div>
            </div>

            {/* Results Table */}
            {resultsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-muted-foreground">No quiz results yet.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-4 bg-secondary/50 text-sm font-medium text-muted-foreground border-b border-border">
                  <div className="col-span-2">User</div>
                  <div className="col-span-2">Quiz Type</div>
                  <div className="col-span-1">Level</div>
                  <div className="col-span-2">Score</div>
                  <div className="col-span-2">Correct</div>
                  <div className="col-span-2">Time</div>
                  <div className="col-span-1">Date</div>
                </div>

                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {results.map((result) => (
                    <div key={result.id} className="grid grid-cols-12 gap-2 p-4 items-center hover:bg-secondary/30">
                      <div className="col-span-2 font-medium text-foreground truncate">
                        {result.display_name || 'Anonymous'}
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          {result.quiz_type === 'plugin' ? (
                            <Puzzle className="w-4 h-4 text-primary" />
                          ) : (
                            <Palette className="w-4 h-4 text-accent" />
                          )}
                          <span className="text-sm capitalize">{result.quiz_type}</span>
                        </div>
                      </div>
                      <div className="col-span-1">
                        <span className="text-xs font-medium px-2 py-0.5 bg-secondary rounded capitalize">
                          {result.difficulty}
                        </span>
                      </div>
                      <div className="col-span-2 font-mono text-foreground">
                        {Math.round((result.score / result.total_questions) * 100)}%
                      </div>
                      <div className="col-span-2 font-mono text-foreground">
                        {result.score}/{result.total_questions}
                      </div>
                      <div className="col-span-2 font-mono text-muted-foreground text-sm">
                        {formatTime(result.time_taken_seconds)}
                      </div>
                      <div className="col-span-1 text-xs text-muted-foreground">
                        {new Date(result.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
