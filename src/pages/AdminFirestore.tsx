import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { adminAPI } from '@/lib/api';
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

const AdminFirestore = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      // Fetch users from API
      const usersData = await adminAPI.getUsers();
      setUsers(usersData.users);

      // Fetch all results for detailed view
      const resultsData = await adminAPI.getResults();
      
      // Transform results to match QuizResult interface
      const transformedResults: QuizResult[] = resultsData.results.map((result: any) => ({
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
      
      console.log(`✅ Loaded ${transformedResults.length} quiz results and ${usersData.users.length} users from API`);
    } catch (error: any) {
      console.error('Error fetching results:', error);
      toast.error(error.message || 'Failed to load quiz results');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
          <TabsList className="grid w-full grid-cols-6">
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
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="all-users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Complete list of all users who have taken quizzes</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugin Quiz Tab */}
          <TabsContent value="plugin-quiz" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Plugin Quiz Users</CardTitle>
                <CardDescription>Users who have attended the Plugin Developer quiz</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Quiz Tab */}
          <TabsContent value="theme-quiz" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme Quiz Users</CardTitle>
                <CardDescription>Users who have attended the Theme Developer quiz</CardDescription>
              </CardHeader>
              <CardContent>
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
                            {user.blockedAt ? new Date(user.blockedAt).toLocaleString() : 'N/A'}
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

