import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Home, Trophy, Settings, LogIn, User, LogOut, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { isAdminEmail } from '@/constants/admin';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = isAdminEmail(user?.email);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg">
      <div className="px-4 py-2">
        <div className="flex items-center justify-center gap-2 h-14">
          {/* Home */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isActive('/') 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Home className="h-5 w-5" />
          </Button>

          {/* Leaderboard */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/leaderboard')}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isActive('/leaderboard') 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Trophy className="h-5 w-5" />
          </Button>

          {/* Admin (only if admin) */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className={cn(
                "h-12 w-12 rounded-full transition-all",
                isActive('/admin') 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle size="large" className="h-12 w-12 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary" />

          {/* Auth/User */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-full transition-all",
                    isActive('/profile') 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/login')}
              className={cn(
                "h-12 w-12 rounded-full transition-all",
                isActive('/login') 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <LogIn className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

