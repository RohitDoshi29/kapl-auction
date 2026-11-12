import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Gavel,
  LogIn,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().trim().email({ message: 'Please enter a valid email address' });
const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters' });

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, signUp, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const prefillEmail = (location.state as { prefillEmail?: string } | null)?.prefillEmail || searchParams.get('email') || '';
  const initialMessage = (location.state as { message?: string } | null)?.message;

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedRole, setAssignedRole] = useState<string | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  useEffect(() => {
    if (initialMessage) {
      toast.info(initialMessage);
    }
  }, [initialMessage]);

  // If already authenticated, redirect safely via useEffect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Check if email has a pre-assigned role
  useEffect(() => {
    if (mode === 'signup' && email) {
      checkEmailRole();
    }
  }, [email, mode]);

  const checkEmailRole = async () => {
    if (!email) return;
    try {
      setIsCheckingRole(true);
      const normalizedEmail = email.toLowerCase().trim();
      console.log('Checking role for email:', normalizedEmail);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('email', normalizedEmail)
        .maybeSingle();

      console.log('Role lookup result:', { data, error });

      if (data?.role) {
        console.log('Found assigned role:', data.role);
        setAssignedRole(data.role);
      } else {
        console.log('No role found for this email');
        setAssignedRole(null);
      }
    } catch (err) {
      console.error('Error checking email role:', err);
      setAssignedRole(null);
    } finally {
      setIsCheckingRole(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  const validateSignIn = () => {
    const errs: typeof errors = {};
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSignUp = () => {
    const errs: typeof errors = {};
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignIn()) return;
    setIsSubmitting(true);

    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back to KAPL 3.0!');
        navigate(from, { replace: true });
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;
    setIsSubmitting(true);

    try {
      const roleOrMetadata = assignedRole || 'player';
      const { error } = await signUp(email, password, roleOrMetadata);
      if (error) {
        toast.error(error.message);
      } else {
        if (assignedRole) {
          toast.success(`Account created as ${assignedRole.replace('_', ' ')}!`);
        } else {
          toast.success('Account created successfully!');
        }
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAssignedRole(null);
        setMode('signin');
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500 text-black';
      case 'co_admin':
        return 'bg-purple-600 text-white';
      case 'admin':
        return 'bg-red-600 text-white';
      case 'primary_scorer':
      case 'secondary_scorer':
        return 'bg-blue-600 text-white';
      case 'captain':
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-3 sm:p-4 py-8 relative overflow-hidden">
      {/* Decorative Stadium Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        <Card className="w-full shadow-2xl border border-white/[0.1] backdrop-blur-2xl bg-card/90 relative z-10 rounded-3xl transition-all duration-300">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 text-black">
              <Gavel className="w-8 h-8 text-black" />
            </div>
            <div>
              <Badge variant="gold" className="mb-2 px-3 py-1 text-xs font-black tracking-wider">
                <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
                KAPL 3.0 AUCTION
              </Badge>
              <CardTitle className="text-2xl md:text-3xl font-black tracking-tight font-display text-foreground">
                Auction <span className="text-gradient-gold">{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm mt-1 text-muted-foreground">
                {mode === 'signin'
                  ? 'Sign in to access auction admin and franchise controls'
                  : 'Create an account to get started'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="font-semibold text-xs">
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="player@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={errors.email ? 'border-destructive bg-white/[0.03]' : 'bg-white/[0.03] border-white/10'}
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={isSubmitting}>
                  <LogIn className="w-4 h-4" />
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="font-semibold text-xs">
                    Email Address
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={errors.email ? 'border-destructive bg-white/[0.03]' : 'bg-white/[0.03] border-white/10'}
                    disabled={isSubmitting || isCheckingRole}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}

                  {assignedRole && !isCheckingRole && (
                    <div className={`text-xs p-2 rounded-lg ${getRoleBadgeColor(assignedRole)}`}>
                      ✓ Role detected: <strong>{assignedRole.replace('_', ' ').toUpperCase()}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={isSubmitting || isCheckingRole}>
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            )}

            <div className="border-t border-white/10 pt-4 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setErrors({});
                  setEmail(prefillEmail);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="w-full text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
              </button>

              <div className="space-y-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Live Auction
                </Link>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Secured by Supabase Authentication • KAPL 3.0 Auction
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


