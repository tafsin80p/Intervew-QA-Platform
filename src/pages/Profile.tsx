import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Calendar, Shield, AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { isAdminEmail } from '@/constants/admin';
import type { User as UserType } from '@supabase/supabase-js';

interface ProfileData {
  display_name: string | null;
  email_verified: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  violation_count: number;
  created_at: string;
}

const Profile = () => {
  const { user: authUser, signOut, isAdmin, emailVerified: authEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const loadProfile = async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    setUser(authUser);
    
    // Load profile data from Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('display_name, email_verified, is_blocked, blocked_reason, violation_count, created_at')
          .eq('user_id', authUser.id)
          .single() as { data: ProfileData | null; error: unknown };

        if (error) {
          console.error('Error loading profile:', error);
          // Use defaults if profile doesn't exist
          setProfile({
            display_name: authUser.user_metadata?.display_name || null,
            email_verified: authEmailVerified || false,
            is_blocked: false,
            blocked_reason: null,
            violation_count: 0,
            created_at: authUser.created_at,
          });
          setDisplayName(authUser.user_metadata?.display_name || '');
        } else if (profileData) {
          setProfile(profileData);
          setDisplayName(profileData.display_name || '');
        } else {
          // Create default profile if none exists
          setProfile({
            display_name: authUser.user_metadata?.display_name || null,
            email_verified: authEmailVerified || false,
            is_blocked: false,
            blocked_reason: null,
            violation_count: 0,
            created_at: authUser.created_at,
          });
          setDisplayName(authUser.user_metadata?.display_name || '');
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        // Use defaults on error
        setProfile({
          display_name: authUser.user_metadata?.display_name || null,
          email_verified: authEmailVerified || false,
          is_blocked: false,
          blocked_reason: null,
          violation_count: 0,
          created_at: authUser.created_at,
        });
        setDisplayName(authUser.user_metadata?.display_name || '');
      }
    } else {
      // Fallback when Supabase not configured
      setProfile({
        display_name: authUser.user_metadata?.display_name || null,
        email_verified: authEmailVerified || false,
        is_blocked: false,
        blocked_reason: null,
        violation_count: 0,
        created_at: authUser.created_at,
      });
      setDisplayName(authUser.user_metadata?.display_name || '');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (!authUser) {
      navigate('/login');
      return;
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, navigate]);

  const handleSave = async () => {
    if (!user || !isSupabaseConfigured) {
      toast.error('Cannot save profile. Supabase is not configured.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
        } as never)
        .eq('user_id', user.id);

      if (error) {
        toast.error(error.message || 'Failed to update profile');
      } else {
        toast.success('Profile updated successfully!');
        // Update local profile state
        if (profile) {
          setProfile({
            ...profile,
            display_name: displayName.trim() || null,
          });
        }
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (err) {
      console.error('Error logging out:', err);
      toast.error('Failed to log out');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No user data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUserAdmin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Profile</CardTitle>
                <CardDescription>Manage your account information</CardDescription>
              </div>
              {isUserAdmin && (
                <Badge variant="default" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{profile?.display_name || user.email?.split('@')[0] || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <Separator />

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    className="flex-1"
                  />
                  {isSupabaseConfigured && (
                    <Button onClick={handleSave} disabled={saving || displayName === (profile?.display_name || '')}>
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Account Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {profile?.email_verified || authEmailVerified ? (
                    <Badge variant="outline" className="gap-1 text-success border-success">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-warning border-warning">
                      <AlertCircle className="w-3 h-3" />
                      Unverified
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Member Since</p>
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const dateStr = profile?.created_at || user.created_at;
                        if (!dateStr) return 'N/A';
                        const date = new Date(dateStr);
                        if (isNaN(date.getTime())) return 'N/A';
                        return date.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        });
                      })()}
                    </p>
                  </div>
                </div>

                {profile?.is_blocked && (
                  <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">Account Blocked</p>
                      {profile.blocked_reason && (
                        <p className="text-sm text-muted-foreground">{profile.blocked_reason}</p>
                      )}
                    </div>
                  </div>
                )}

                {profile && profile.violation_count > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-warning">Violations</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.violation_count} warning{profile.violation_count !== 1 ? 's' : ''} received
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full"
              >
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;

