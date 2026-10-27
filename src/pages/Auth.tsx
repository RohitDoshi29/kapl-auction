import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, KaplExperienceLevel } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  LogIn,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  UserCheck,
  User,
  Phone,
  Award,
  Crown,
  Star,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { PlayerRole } from '@/lib/cricketTypes';

const emailSchema = z.string().trim().email({ message: 'Please enter a valid email address' });
const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters' });

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, signUp, signInWithGoogle, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const prefillEmail = (location.state as any)?.prefillEmail || searchParams.get('email') || '';
  const initialMessage = (location.state as any)?.message;
  const queryTab = searchParams.get('tab');
  const queryMode = searchParams.get('mode');
  const initialTab =
    (location.state as any)?.tab === 'signup' || queryTab === 'signup' || queryMode === 'register'
      ? 'signup'
      : 'signin';

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);

  // Sign In states
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Create Account states
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState(prefillEmail);
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const initialRole = searchParams.get('role');
  const [accountType, setAccountType] = useState<'player' | 'spectator'>(
    initialRole === 'spectator' ? 'spectator' : 'player'
  );
  const [playingRole, setPlayingRole] = useState<PlayerRole>('all_rounder');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [battingStyle, setBattingStyle] = useState('Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState('Right-arm medium');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [tournamentId, setTournamentId] = useState('kapl-3-mens');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState<KaplExperienceLevel>('new');
  const [previousTeam, setPreviousTeam] = useState('');
  const [pastAchievements, setPastAchievements] = useState('');
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/profile';

  // Synchronize activeTab and role if URL search params change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const modeParam = params.get('mode');
    if (tabParam === 'signup' || modeParam === 'register') {
      setActiveTab('signup');
    } else if (tabParam === 'signin') {
      setActiveTab('signin');
    }

    const roleParam = params.get('role');
    if (roleParam === 'spectator' || roleParam === 'player') {
      setAccountType(roleParam);
    }
  }, [location.search]);

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

  if (isAuthenticated) {
    return null;
  }

  const validateSignIn = () => {
    const errs: { email?: string; password?: string } = {};
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
    } catch (err: any) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateSignUp = () => {
    const errs: Record<string, string> = {};

    if (!signupFullName.trim() || signupFullName.trim().length < 2) {
      errs.fullName = 'Please enter your full name (at least 2 characters)';
    }

    const emailRes = emailSchema.safeParse(signupEmail);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }

    const passRes = passwordSchema.safeParse(signupPassword);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }

    if (signupPassword !== signupConfirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setSignupErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;
    setIsSubmitting(true);

    try {
      const { error } = await signUp(signupEmail, signupPassword, {
        name: signupFullName.trim(),
        mobileNumber: signupPhone.trim() || undefined,
        accountType,
        role: playingRole,
        battingStyle,
        bowlingStyle,
        jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : null,
        tournamentId,
        gender,
        experience,
        previousTeam: experience !== 'new' ? previousTeam.trim() : undefined,
        pastAchievements: experience !== 'new' ? pastAchievements.trim() : undefined,
        bio: bio.trim() || undefined,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
          setActiveTab('signin');
          setEmail(signupEmail);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Account created and activated immediately! Welcome to your Profile page.');
        navigate('/profile', { replace: true });
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred while creating your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 py-8 relative overflow-hidden">
      {/* Decorative Stadium Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className={cn("w-full relative z-10 space-y-4", activeTab === 'signup' ? 'max-w-2xl' : 'max-w-md')}>
        {/* Dedicated Player Registration Banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 text-xl">
              🏏
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-foreground">
                Looking for Dedicated Player Registration?
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Register with prior KAPL history, cricket role styles & live trading card preview.
              </p>
            </div>
          </div>
          <Link to="/register" className="w-full sm:w-auto shrink-0">
            <Button size="sm" className="w-full sm:w-auto h-9 font-bold bg-amber-500 text-black hover:bg-amber-400 gap-1.5 shadow-sm">
              <UserPlus className="w-3.5 h-3.5" />
              Go to /register
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        <Card
          className="w-full shadow-2xl border border-white/[0.1] backdrop-blur-2xl bg-card/90 relative z-10 rounded-3xl transition-all duration-300"
        >
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 text-black">
            <Trophy className="w-8 h-8 text-black animate-bounce" />
          </div>
          <div>
            <Badge variant="gold" className="mb-2 px-3 py-1 text-xs font-black tracking-wider">
              <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
              KAPL SEASON 3.0
            </Badge>
            <CardTitle className="text-2xl md:text-3xl font-black tracking-tight font-display text-foreground">
              {activeTab === 'signin' ? (
                <>
                  Tournament <span className="text-gradient-gold">Sign In</span>
                </>
              ) : (
                <>
                  Create Your <span className="text-gradient-gold">Account</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1 text-muted-foreground">
              {activeTab === 'signin'
                ? 'Sign in to access your player profile, team management, or admin controls'
                : 'Register with complete player details — customize anytime in your Profile page'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'signin' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-4 bg-white/[0.04] border border-white/10 p-1 rounded-2xl">
              <TabsTrigger
                value="signin"
                className="rounded-xl font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Sign In
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SIGN IN */}
            <TabsContent value="signin">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

                <div className="pt-2 text-center border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('signup')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Don't have an account?</span>
                    <span className="text-white underline font-extrabold">Create an Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center pt-2">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Secured by Supabase Authentication • KAPL Season 3.0
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}


