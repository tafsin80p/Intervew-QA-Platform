import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Code2, LogIn, UserPlus, Mail, Lock, User as UserIcon, ArrowLeft, Loader2, Key } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { z } from 'zod';
import { ADMIN_EMAIL, isAdminEmail, isAdminSecretKey } from '@/constants/admin';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adminSecretKey, setAdminSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [authSettings, setAuthSettings] = useState({
    signupEnabled: true,
    minPasswordLength: 6,
    requireEmailConfirmation: false,
    oauthGoogleEnabled: true,
    oauthGithubEnabled: true,
  });
  const { signIn, signUp, signInWithOAuth, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Fetch auth settings
  useEffect(() => {
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
        ]);

        setAuthSettings({
          signupEnabled: settings[0].data?.setting_value !== 'false',
          minPasswordLength: parseInt(settings[1].data?.setting_value || '6', 10),
          requireEmailConfirmation: settings[2].data?.setting_value === 'true',
          oauthGoogleEnabled: settings[3].data?.setting_value !== 'false',
          oauthGithubEnabled: settings[4].data?.setting_value !== 'false',
        });
      } catch (err) {
        console.error('Error fetching auth settings:', err);
      }
    };

    fetchAuthSettings();
  }, []);

  // Clear all fields when switching between login/signup
  useEffect(() => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setAdminSecretKey('');
  }, [isLogin]);

  // If signup is disabled and user tries to sign up, redirect to login
  useEffect(() => {
    if (!authSettings.signupEnabled && !isLogin) {
      setIsLogin(true);
      toast.error('Signup is currently disabled');
    }
  }, [authSettings.signupEnabled, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Dynamic schema based on settings
      const dynamicAuthSchema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(authSettings.minPasswordLength, `Password must be at least ${authSettings.minPasswordLength} characters`),
        displayName: z.string().min(2, 'Display name must be at least 2 characters').optional(),
      });

      const validation = dynamicAuthSchema.safeParse({
        email,
        password,
        displayName: isLogin ? undefined : displayName,
      });

      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const trimmedEmail = email.trim().toLowerCase();
        const result = await signIn(trimmedEmail, password, adminSecretKey.trim());
        const { error } = result;
        if (error) {
          // Check for backend API connection errors
          if (error.message.includes('Cannot connect to backend API') || 
              error.message.includes('Failed to fetch') ||
              error.message.includes('Network error') ||
              error.message.includes('fetch')) {
            toast.error('Backend API is not running. Please start the backend server first.', {
              duration: 6000,
            });
            console.error('Backend API Error:', error.message);
            setLoading(false);
            return;
          } else if (error.message.includes('Invalid credentials') || error.message.includes('Invalid login')) {
            // Check if it's the admin email - provide helpful message
            if (isAdminEmail(trimmedEmail)) {
              toast.error('Account not found. Please sign up first or check your password.');
            } else {
              toast.error('Invalid email or password');
            }
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Please check your email and confirm your account');
          } else if (error.message.includes('Supabase is not configured')) {
            toast.error('Supabase is not configured. Please check your .env file.');
          } else {
            toast.error(error.message || 'Login failed. Please try again.');
          }
        } else {
          // Check if admin secret key was used
          const usedSecretKey = isAdminSecretKey(adminSecretKey.trim());
          
          // Wait a moment for admin status to be set in context, then redirect
          setTimeout(() => {
            if (usedSecretKey) {
              toast.success('Welcome back! Admin access granted.');
              // Redirect to admin dashboard
              sessionStorage.removeItem('pendingQuiz');
              navigate('/admin');
            } else {
              toast.success('Welcome back!');
              // Clear any pending quiz - user should see landing page first
              sessionStorage.removeItem('pendingQuiz');
              // Redirect to landing page
              navigate('/');
            }
          }, 300);
        }
      } else {
        const trimmedEmail = email.trim().toLowerCase();
        const result = await signUp(trimmedEmail, password, displayName, adminSecretKey.trim());
        const { data, error } = result;
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            toast.error('This email is already registered. Please sign in instead.');
            // Switch to login mode
            setTimeout(() => setIsLogin(true), 2000);
          } else if (error.message.includes('Password')) {
            toast.error('Password must be at least 6 characters');
          } else if (error.message.includes('Supabase is not configured')) {
            toast.error('Server configuration error. Please contact administrator.');
          } else {
            toast.error(error.message || 'Failed to create account. Please try again.');
          }
        } else {
            // Account created successfully
            if (data?.user) {
              const userName = displayName || trimmedEmail.split('@')[0];
              
              // Check if admin secret key was used
              if (isAdminSecretKey(adminSecretKey.trim())) {
                toast.success(`🎉 Account created successfully! Welcome, ${userName}! Admin access granted.`, {
                  duration: 5000,
                });
              } else {
                toast.success(`🎉 Account created successfully! Welcome, ${userName}!`, {
                  duration: 5000,
                });
              }
              
              // If email confirmation is required, show message
              if (!data.user.email_confirmed_at) {
                toast.info('📧 Please check your email to confirm your account before signing in.', {
                  duration: 6000,
                });
                // Switch to login after showing messages
                setTimeout(() => {
                  setIsLogin(true);
                  setEmail(trimmedEmail); // Pre-fill email for convenience
                }, 4000);
              } else {
                // User is automatically signed in
                const usedSecretKey = isAdminSecretKey(adminSecretKey.trim());
                if (usedSecretKey) {
                  toast.success('You are now signed in with admin access!', {
                    duration: 3000,
                  });
                  // Redirect to admin dashboard
                  sessionStorage.removeItem('pendingQuiz');
                  navigate('/admin');
                } else {
                  toast.success('You are now signed in!', {
                    duration: 3000,
                  });
                  // Clear any pending quiz - user should see landing page first
                  sessionStorage.removeItem('pendingQuiz');
                  // Redirect to landing page
                  navigate('/');
                }
              }
            } else {
              toast.success('✅ Account creation initiated! Please check your email.', {
                duration: 5000,
              });
              setTimeout(() => {
                setIsLogin(true);
                setEmail(trimmedEmail); // Pre-fill email for convenience
              }, 3000);
            }
        }
      }
    } catch (err) {
      console.error('Unexpected error during authentication:', err);
      const error = err as Error;
      const errorMessage = error?.message || 'An unexpected error occurred. Please try again.';
      toast.error(errorMessage);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 pb-24">
      <div className="max-w-md w-full">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="gap-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Code2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Sign in to track your progress' : 'Join and test your WordPress skills'}
          </p>
          {isLogin && (
            <p className="text-xs text-muted-foreground mt-3">
              Don't have an account? Click "Sign up" below to create one
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4"
            autoComplete="off"
          >
            {/* Hidden dummy fields to prevent browser auto-fill */}
            <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} />
            <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} tabIndex={-1} />
            
            {!isLogin && (
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="adminSecretKey" className="text-sm text-muted-foreground">
                Admin Secret Key (Optional)
              </Label>
              <div className="relative mt-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="adminSecretKey"
                  type="text"
                  placeholder="Enter admin secret key for admin access"
                  value={adminSecretKey}
                  onChange={(e) => setAdminSecretKey(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter the admin secret key to access the admin dashboard. Any user can become admin by entering the correct secret key.
              </p>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading || oauthLoading !== null}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {/* OAuth Buttons - Inline */}
          {(authSettings.oauthGoogleEnabled || authSettings.oauthGithubEnabled) && (
            <>
              <div className="relative mt-6 mb-6">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {authSettings.oauthGoogleEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setOauthLoading('google');
                    signInWithOAuth('google');
                  }}
                  disabled={loading || oauthLoading !== null}
                >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="hidden sm:inline">Google</span>
                </Button>
              )}

              {authSettings.oauthGithubEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setOauthLoading('github');
                    signInWithOAuth('github');
                  }}
                  disabled={loading || oauthLoading !== null}
                >
              {oauthLoading === 'github' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
                  <span className="hidden sm:inline">GitHub</span>
                </Button>
              )}
            </div>
            </>
          )}

          {authSettings.signupEnabled && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
