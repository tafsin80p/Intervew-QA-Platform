import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI } from '@/lib/api';
import { isAdminSecretKey } from '@/constants/admin';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: { token: string } | null;
  isAdmin: boolean;
  loading: boolean;
  isBlocked: boolean;
  emailVerified: boolean;
  signUp: (email: string, password: string, displayName: string, adminSecretKey?: string) => Promise<{ data: { user: User | null; session: { token: string } | null } | null; error: { message: string } | null }>;
  signIn: (email: string, password: string, adminSecretKey?: string) => Promise<{ data: { user: User | null; session: { token: string } | null } | null; error: { message: string } | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true); // Assume verified for Express API

  // Check if user is blocked
  const checkBlockedStatus = async (userId: string) => {
    try {
      const { adminAPI } = await import('@/lib/api');
      const data = await adminAPI.getUserWarnings(userId);
      setIsBlocked(data.isBlocked);
    } catch (error) {
      console.error('Error checking blocked status:', error);
      setIsBlocked(false);
    }
  };

  // Load user from token on mount
  useEffect(() => {
    const token = authAPI.getToken();
    if (token) {
      try {
        // Decode JWT token to get user info (simple decode, not verified)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userData = {
          id: payload.userId,
          email: payload.email,
          displayName: payload.displayName,
          isAdmin: payload.isAdmin || false,
        };
        setUser(userData);
        setIsAdmin(payload.isAdmin || false);
        setSession({ token });
        
        // Check if user is blocked
        if (userData.id && !payload.isAdmin) {
          checkBlockedStatus(userData.id);
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        authAPI.logout();
      }
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, displayName: string, adminSecretKey?: string) => {
    try {
      const response = await authAPI.register(email, password, displayName, adminSecretKey);
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        isAdmin: response.user.isAdmin || false,
      };
      setUser(userData);
      setIsAdmin(response.user.isAdmin || false);
      setSession({ token: response.token });
      return { data: { user: userData, session: { token: response.token } }, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: error.message || 'Registration failed' } };
    }
  };

  const signIn = async (email: string, password: string, adminSecretKey?: string) => {
    try {
      const response = await authAPI.login(email, password, adminSecretKey);
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        isAdmin: response.user.isAdmin || false,
      };
      setUser(userData);
      setIsAdmin(response.user.isAdmin || false);
      setSession({ token: response.token });
      
      // Check if user is blocked (non-admin users only)
      if (userData.id && !response.user.isAdmin) {
        await checkBlockedStatus(userData.id);
      }
      
      return { data: { user: userData, session: { token: response.token } }, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      // Check if error is due to blocked account
      if (error.message?.includes('blocked') || error.message?.includes('Account blocked')) {
        setIsBlocked(true);
      }
      return { data: null, error: { message: error.message || 'Login failed' } };
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    toast.error('OAuth login is not available with Express API. Please use email/password.');
  };

  const signOut = async () => {
    authAPI.logout();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        loading,
        isBlocked,
        emailVerified,
        signUp,
        signIn,
        signInWithOAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
