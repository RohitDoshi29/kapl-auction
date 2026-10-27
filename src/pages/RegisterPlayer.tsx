import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, KaplExperienceLevel } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  UserPlus,
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Star,
  Flame,
  Award,
  CheckCircle2,
  ArrowRight,
  Gavel,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { PlayerRole, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';

const emailSchema = z.string().trim().email({ message: 'Please enter a valid email address' });
const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters' });
const phoneSchema = z.string().trim().min(10, { message: 'Please enter a valid 10-digit mobile number' });

const AVATAR_PRESETS = [
  { label: 'Classic Batter', url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80' },
  { label: 'Pace Bowler', url: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=200&auto=format&fit=crop&q=80' },
  { label: 'Captain Gold', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { label: 'All-Rounder', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
  { label: 'Women Star', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
];

const PREVIOUS_TEAMS = [
  "Kapil's Warriors",
  "Kapil Falcons",
  "Insta Paltans",
  "Kapil's Devils",
  "Goodness Royals",
  "Kapil Ke Singham",
  "Super Strikers",
  "Kapil Avengers",
  "Kapil Queens",
  "Falconettes",
  "Royal Challengers Women",
  "Super Strikers Women",
  "Other / Custom Franchise",
];

export default function RegisterPlayer() {
  const navigate = useNavigate();
  const { signUp, isAuthenticated, user, profile, updateProfile } = useAuth();

  // Form State
  const [fullName, setFullName] = useState(profile?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.mobileNumber || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cricket Attributes
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [tournamentId, setTournamentId] = useState<string>(profile?.tournamentId || 'all');
  const [role, setRole] = useState<PlayerRole>((profile?.role as PlayerRole) || 'all_rounder');
  const [battingStyle, setBattingStyle] = useState(profile?.battingStyle || 'Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState(profile?.bowlingStyle || 'Right-arm medium');
  const [jerseyNumber, setJerseyNumber] = useState<string>(
    profile?.jerseyNumber !== undefined && profile?.jerseyNumber !== null ? String(profile?.jerseyNumber) : ''
  );
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');
  const [bio, setBio] = useState(profile?.bio || '');

  // Experience / KAPL History State (User requested)
  const [experience, setExperience] = useState<KaplExperienceLevel>(profile?.experience || 'new');
  const [previousTeam, setPreviousTeam] = useState(profile?.previousTeam || '');
  const [customPreviousTeam, setCustomPreviousTeam] = useState('');
  const [pastAchievements, setPastAchievements] = useState(profile?.pastAchievements || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Auto-sync profile data if already authenticated
  useEffect(() => {
    if (profile) {
      if (profile.name && !fullName) setFullName(profile.name);
      if (profile.mobileNumber && !phone) setPhone(profile.mobileNumber);
      if (profile.role) setRole(profile.role as PlayerRole);
      if (profile.battingStyle) setBattingStyle(profile.battingStyle);
      if (profile.bowlingStyle) setBowlingStyle(profile.bowlingStyle);
      if (profile.photoUrl && !photoUrl) setPhotoUrl(profile.photoUrl);
      if (profile.bio && !bio) setBio(profile.bio);
      if (profile.gender) setGender(profile.gender);
      if (profile.experience) setExperience(profile.experience);
      if (profile.previousTeam) setPreviousTeam(profile.previousTeam);
      if (profile.pastAchievements) setPastAchievements(profile.pastAchievements);
    }
  }, [profile]);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters';
    }

    if (!phone.trim()) {
      errs.phone = 'Mobile / WhatsApp number is required for player verification';
    } else {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        errs.phone = 'Please enter a valid 10-digit mobile number';
      }
    }

    if (!isAuthenticated) {
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
    }

    if (experience !== 'new') {
      const effectiveTeam = previousTeam === 'Other / Custom Franchise' ? customPreviousTeam : previousTeam;
      if (!effectiveTeam.trim()) {
        errs.previousTeam = 'Please select or specify your previous team name';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please check the form for missing or invalid details.');
      return;
    }

    setIsSubmitting(true);
    const cleanPhone = phone.trim();
    const effectivePreviousTeam =
      experience === 'new'
        ? undefined
        : previousTeam === 'Other / Custom Franchise'
        ? customPreviousTeam.trim()
        : previousTeam.trim();

    try {
      if (isAuthenticated && user) {
        // Update existing player profile and sync to Supabase
        const targetTournaments = tournamentId === 'all' ? ['kapl-3-mens', 'kapl-3-womens'] : [tournamentId];
        const playerId = profile?.playerId || `p_u_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

        for (const tId of targetTournaments) {
          const idForTourn = tId === 'kapl-3-womens' ? `${playerId}_w` : playerId;
          try {
            const { error: insErr } = await supabase.from('players').insert({
              id: idForTourn,
              name: fullName.trim(),
              photo_url: photoUrl.trim() || null,
              role,
              batting_style: battingStyle || null,
              bowling_style: bowlingStyle || null,
              jersey_number: jerseyNumber.trim() ? Number(jerseyNumber) : null,
              mobile_number: cleanPhone || null,
              tournament_id: tId,
              base_price: 100,
              auction_status: 'pending',
            });

            if (insErr && insErr.code === '23505') {
              await supabase
                .from('players')
                .update({
                  name: fullName.trim(),
                  photo_url: photoUrl.trim() || null,
                  role,
                  batting_style: battingStyle || null,
                  bowling_style: bowlingStyle || null,
                  jersey_number: jerseyNumber.trim() ? Number(jerseyNumber) : null,
                  mobile_number: cleanPhone || null,
                  tournament_id: tId,
                })
                .eq('id', idForTourn);
            }
          } catch (dbErr) {
            console.warn(`Direct DB player registration sync notice (${tId}):`, dbErr);
          }
        }

        await updateProfile({
          name: fullName.trim(),
          mobileNumber: cleanPhone,
          role,
          battingStyle,
          bowlingStyle,
          jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : null,
          photoUrl: photoUrl.trim() || undefined,
          tournamentId,
          gender,
          experience,
          previousTeam: effectivePreviousTeam,
          pastAchievements: pastAchievements.trim() || undefined,
          bio: bio.trim() || undefined,
        });

        toast.success('Registration updated and synced with tournament database!');
        setRegisteredSuccess(true);
      } else {
        // Register new player account and store in Supabase auth + players table
        const { error } = await signUp(email.trim(), password, {
          name: fullName.trim(),
          mobileNumber: cleanPhone,
          role,
          battingStyle,
          bowlingStyle,
          jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : null,
          photoUrl: photoUrl.trim() || undefined,
          tournamentId,
          gender,
          accountType: 'player',
          experience,
          previousTeam: effectivePreviousTeam,
          pastAchievements: pastAchievements.trim() || undefined,
          bio: bio.trim() || undefined,
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in or use a different email.');
          } else {
            toast.error(error.message || 'Registration failed. Please try again.');
          }
          return;
        }

        toast.success('Player Registered successfully! You are now entered into the Mega Auction.');
        setRegisteredSuccess(true);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error('An error occurred during player registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeColor = (r: PlayerRole) => {
    switch (r) {
      case 'batter':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'bowler':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'wicket_keeper':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'all_rounder':
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getExperienceBadge = (exp: KaplExperienceLevel) => {
    switch (exp) {
      case 'season_2':
        return { label: 'KAPL Season 2 Veteran', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: '🥈' };
      case 'season_1':
        return { label: 'KAPL Season 1 Pioneer', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40', icon: '🥉' };
      case 'veteran':
        return { label: 'KAPL All-Star Veteran (S1 & S2)', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', icon: '🏆' };
      case 'new':
      default:
        return { label: 'KAPL 3.0 Debutant', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: '🌟' };
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Success Modal / Banner */}
        {registeredSuccess ? (
          <div className="max-w-2xl mx-auto my-8 p-8 rounded-3xl bg-card/90 border border-emerald-500/40 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs uppercase tracking-wider font-bold">
                Registration Confirmed & Verified
              </Badge>
              <h2 className="text-3xl font-black font-display text-foreground">
                Welcome to KAPL 3.0, {fullName}!
              </h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                Your player card has been successfully saved to the tournament database and added to the Mega Auction pool.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-left flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🏏</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground truncate">{fullName}</h4>
                  <Badge variant="outline" className={cn('text-[10px] uppercase font-bold', getRoleBadgeColor(role))}>
                    {role.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Jersey #{jerseyNumber || '-'} • Base Price: ₹100 • {getExperienceBadge(experience).label}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Button
                onClick={() => navigate('/auction')}
                className="h-12 px-6 rounded-2xl font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black shadow-lg shadow-amber-500/20 gap-2"
              >
                <Gavel className="w-4 h-4" />
                View in Auction Room
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/players')}
                className="h-12 px-6 rounded-2xl font-bold border-white/15 gap-2"
              >
                <Trophy className="w-4 h-4 text-emerald-400" />
                Players Directory
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/profile')}
                className="h-12 px-5 rounded-2xl font-semibold text-muted-foreground hover:text-foreground"
              >
                My Profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Heading Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-card/90 via-card/70 to-background/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold" className="px-3 py-0.5 text-xs font-black uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
                      KAPL Season 3.0 Official
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold">
                      Mega Auction Pool Draft
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight text-foreground">
                    Player <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">Registration</span>
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Complete your official cricket profile below. All registered players are automatically saved to the tournament database and draft pool for live franchise bidding.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {!isAuthenticated && (
                    <Link to="/auth?tab=signin">
                      <Button variant="outline" className="h-11 rounded-2xl font-bold border-white/15 bg-white/[0.04] text-xs sm:text-sm">
                        Already Registered? Sign In
                      </Button>
                    </Link>
                  )}
                  <Link to="/auction">
                    <Button variant="ghost" className="h-11 rounded-2xl font-bold text-muted-foreground hover:text-foreground text-xs sm:text-sm gap-1.5">
                      <Gavel className="w-4 h-4 text-amber-400" />
                      Live Auction
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Main Form + Live Card Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Section (7 cols on desktop) */}
              <div className="lg:col-span-7 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Card 1: Division & Tournament */}
                  <Card className="rounded-3xl border border-white/[0.1] bg-card/80 backdrop-blur-xl shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Trophy className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">1. Tournament Division</CardTitle>
                      </div>
                      <CardDescription>
                        Choose which tournament league you wish to enter for the auction pool.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div
                          onClick={() => setTournamentId('kapl-3-mens')}
                          className={cn(
                            'p-4 rounded-2xl border cursor-pointer transition-all text-center space-y-1',
                            tournamentId === 'kapl-3-mens'
                              ? 'border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          )}
                        >
                          <span className="text-2xl">🏏</span>
                          <h4 className="text-sm font-bold text-foreground">Men's League</h4>
                          <p className="text-[11px] text-muted-foreground">KAPL 3.0 Men's</p>
                        </div>

                        <div
                          onClick={() => setTournamentId('kapl-3-womens')}
                          className={cn(
                            'p-4 rounded-2xl border cursor-pointer transition-all text-center space-y-1',
                            tournamentId === 'kapl-3-womens'
                              ? 'border-pink-500 bg-pink-500/10 shadow-md shadow-pink-500/10'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          )}
                        >
                          <span className="text-2xl">👑</span>
                          <h4 className="text-sm font-bold text-foreground">Women's League</h4>
                          <p className="text-[11px] text-muted-foreground">KAPL 3.0 Women's</p>
                        </div>

                        <div
                          onClick={() => setTournamentId('all')}
                          className={cn(
                            'p-4 rounded-2xl border cursor-pointer transition-all text-center space-y-1',
                            tournamentId === 'all'
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          )}
                        >
                          <span className="text-2xl">⚡</span>
                          <h4 className="text-sm font-bold text-foreground">Dual Draft</h4>
                          <p className="text-[11px] text-muted-foreground">Enter Both Pools</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Personal & Contact Information */}
                  <Card className="rounded-3xl border border-white/[0.1] bg-card/80 backdrop-blur-xl shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <User className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">2. Personal & Account Details</CardTitle>
                      </div>
                      <CardDescription>
                        Your real name, contact number, and credentials for account access.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                            Full Name <span className="text-red-400">*</span>
                          </Label>
                          <Input
                            placeholder="e.g. Virat Sharma"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={cn('rounded-xl bg-background/60 border-white/10 h-11', errors.fullName && 'border-red-500')}
                          />
                          {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                            Mobile / WhatsApp Number <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <Phone className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="10-digit mobile number"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={cn('pl-9 rounded-xl bg-background/60 border-white/10 h-11', errors.phone && 'border-red-500')}
                            />
                          </div>
                          {errors.phone && <p className="text-xs text-red-400">{errors.phone}</p>}
                        </div>
                      </div>

                      {!isAuthenticated && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                              Email Address <span className="text-red-400">*</span>
                            </Label>
                            <div className="relative">
                              <Mail className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground pointer-events-none" />
                              <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={cn('pl-9 rounded-xl bg-background/60 border-white/10 h-11', errors.email && 'border-red-500')}
                              />
                            </div>
                            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                                Password <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative">
                                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="At least 8 characters"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  className={cn('pl-9 pr-10 rounded-xl bg-background/60 border-white/10 h-11', errors.password && 'border-red-500')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                                Confirm Password <span className="text-red-400">*</span>
                              </Label>
                              <div className="relative">
                                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Re-enter password"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  className={cn('pl-9 rounded-xl bg-background/60 border-white/10 h-11', errors.confirmPassword && 'border-red-500')}
                                />
                              </div>
                              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">Gender</Label>
                          <Select value={gender} onValueChange={(val: 'male' | 'female') => setGender(val)}>
                            <SelectTrigger className="rounded-xl bg-background/60 border-white/10 h-11">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">Preferred Jersey Number</Label>
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            placeholder="e.g. 7 or 18"
                            value={jerseyNumber}
                            onChange={(e) => setJerseyNumber(e.target.value)}
                            className="rounded-xl bg-background/60 border-white/10 h-11"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: Cricket Skills */}
                  <Card className="rounded-3xl border border-white/[0.1] bg-card/80 backdrop-blur-xl shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Flame className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">3. Playing Role & Style</CardTitle>
                      </div>
                      <CardDescription>
                        Define your primary cricketing role for the auctioneer and team managers.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Playing Role Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">Primary Playing Role</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { id: 'batter', label: 'Batter', icon: '🏏', desc: 'Top/Middle order' },
                            { id: 'bowler', label: 'Bowler', icon: '⚡', desc: 'Pace or Spin' },
                            { id: 'all_rounder', label: 'All-Rounder', icon: '🌟', desc: 'Bat & Ball' },
                            { id: 'wicket_keeper', label: 'Wicket-Keeper', icon: '🧤', desc: 'Keeper-Batter' },
                          ].map((item) => (
                            <div
                              key={item.id}
                              onClick={() => setRole(item.id as PlayerRole)}
                              className={cn(
                                'p-3 rounded-2xl border cursor-pointer transition-all text-center space-y-1',
                                role === item.id
                                  ? 'border-amber-500 bg-amber-500/15 shadow-sm shadow-amber-500/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                              )}
                            >
                              <span className="text-2xl">{item.icon}</span>
                              <h5 className="text-xs font-bold text-foreground">{item.label}</h5>
                              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">Batting Style</Label>
                          <Select value={battingStyle} onValueChange={setBattingStyle}>
                            <SelectTrigger className="rounded-xl bg-background/60 border-white/10 h-11">
                              <SelectValue placeholder="Batting style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Right-hand bat">Right-hand bat</SelectItem>
                              <SelectItem value="Left-hand bat">Left-hand bat</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">Bowling Style</Label>
                          <Select value={bowlingStyle} onValueChange={setBowlingStyle}>
                            <SelectTrigger className="rounded-xl bg-background/60 border-white/10 h-11">
                              <SelectValue placeholder="Bowling style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Right-arm medium">Right-arm fast / medium</SelectItem>
                              <SelectItem value="Right-arm fast">Right-arm express fast</SelectItem>
                              <SelectItem value="Right-arm off spin">Right-arm off spin</SelectItem>
                              <SelectItem value="Right-arm leg spin">Right-arm leg spin</SelectItem>
                              <SelectItem value="Left-arm medium">Left-arm fast / medium</SelectItem>
                              <SelectItem value="Left-arm orthodox">Left-arm orthodox spin</SelectItem>
                              <SelectItem value="Left-arm chinaman">Left-arm chinaman / wrist spin</SelectItem>
                              <SelectItem value="None / Occasional">None / Occasional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-300">Official KAPL Base Price</p>
                          <p className="text-[11px] text-muted-foreground">Standard starting bid in the Mega Auction pool</p>
                        </div>
                        <span className="text-base font-black text-amber-400 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30">
                          ₹100
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 4: KAPL Experience & History (Explicitly requested by user) */}
                  <Card className="rounded-3xl border border-white/[0.1] bg-card/80 backdrop-blur-xl shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Award className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">4. KAPL Tournament Experience</CardTitle>
                      </div>
                      <CardDescription>
                        Have you played in previous KAPL seasons or are you making your league debut?
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 4 Interactive Option Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          {
                            id: 'new' as KaplExperienceLevel,
                            title: 'New Player',
                            subtitle: 'KAPL 3.0 Debutant',
                            desc: 'First time registering for the Kapil Premier League.',
                            icon: '🌟',
                            color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                          },
                          {
                            id: 'season_2' as KaplExperienceLevel,
                            title: 'Played Last Year',
                            subtitle: 'KAPL Season 2 (2025)',
                            desc: 'Competed in the second edition of the tournament.',
                            icon: '🥈',
                            color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                          },
                          {
                            id: 'season_1' as KaplExperienceLevel,
                            title: 'Played Season 1',
                            subtitle: 'KAPL Season 1 (2024)',
                            desc: 'Played in the historic inaugural season of KAPL.',
                            icon: '🥉',
                            color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
                          },
                          {
                            id: 'veteran' as KaplExperienceLevel,
                            title: 'KAPL Veteran',
                            subtitle: 'Played Both S1 & S2',
                            desc: 'True league all-star who played in both past editions.',
                            icon: '🏆',
                            color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
                          },
                        ].map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setExperience(item.id)}
                            className={cn(
                              'p-4 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between space-y-2',
                              experience === item.id
                                ? cn('ring-2 ring-amber-400 shadow-md', item.color)
                                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-3xl">{item.icon}</span>
                              {experience === item.id && (
                                <span className="w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-xs font-black">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-foreground">{item.title}</h4>
                              <p className="text-xs font-semibold text-amber-400/90">{item.subtitle}</p>
                              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Additional Details for Returning Players */}
                      {experience !== 'new' && (
                        <div className="pt-3 space-y-4 border-t border-white/10 animate-in fade-in duration-300">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                              Which team did you play for in past seasons? <span className="text-red-400">*</span>
                            </Label>
                            <Select value={previousTeam} onValueChange={setPreviousTeam}>
                              <SelectTrigger className={cn('rounded-xl bg-background/60 border-white/10 h-11', errors.previousTeam && 'border-red-500')}>
                                <SelectValue placeholder="Select your previous team" />
                              </SelectTrigger>
                              <SelectContent>
                                {PREVIOUS_TEAMS.map((teamName) => (
                                  <SelectItem key={teamName} value={teamName}>
                                    {teamName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.previousTeam && <p className="text-xs text-red-400">{errors.previousTeam}</p>}
                          </div>

                          {previousTeam === 'Other / Custom Franchise' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold text-foreground">Specify Team Name</Label>
                              <Input
                                placeholder="Enter custom team name"
                                value={customPreviousTeam}
                                onChange={(e) => setCustomPreviousTeam(e.target.value)}
                                className="rounded-xl bg-background/60 border-white/10 h-11"
                              />
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground">
                              Past Achievements & Highlights (Optional)
                            </Label>
                            <Input
                              placeholder="e.g. Scored 148 runs in Season 2, 7 wickets, Best bowling 3/14"
                              value={pastAchievements}
                              onChange={(e) => setPastAchievements(e.target.value)}
                              className="rounded-xl bg-background/60 border-white/10 h-11"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Franchise owners review past stats during paddle bidding!
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 5: Photo & Bio */}
                  <Card className="rounded-3xl border border-white/[0.1] bg-card/80 backdrop-blur-xl shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-5 h-5" />
                        <CardTitle className="text-lg font-bold">5. Profile Photo & Player Bio</CardTitle>
                      </div>
                      <CardDescription>
                        Give franchise owners and fans a face to remember.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Photo Preset Avatars */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">Choose Avatar Preset</Label>
                        <div className="flex flex-wrap gap-2.5">
                          {AVATAR_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setPhotoUrl(preset.url)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all',
                                photoUrl === preset.url
                                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 text-muted-foreground'
                              )}
                            >
                              <img src={preset.url} alt={preset.label} className="w-5 h-5 rounded-full object-cover" />
                              <span>{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">Or Enter Custom Photo URL</Label>
                        <Input
                          placeholder="https://example.com/my-photo.jpg"
                          value={photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                          className="rounded-xl bg-background/60 border-white/10 h-11"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">Personal Motto / Bio (Optional)</Label>
                        <Textarea
                          placeholder="Tell us about your cricketing journey, strengths, and goals for KAPL 3.0..."
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          rows={3}
                          className="rounded-xl bg-background/60 border-white/10 resize-none text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 text-base font-black rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black shadow-xl shadow-amber-500/25 hover:from-amber-600 hover:to-yellow-600 hover:scale-[1.01] active:scale-[0.99] transition-all gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Saving to Database...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        {isAuthenticated ? 'Update My Player Registration' : 'Register for KAPL 3.0 & Auction'}
                        <ArrowRight className="w-5 h-5 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              </div>

              {/* Live Player Card Preview (5 cols on desktop, sticky) */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
                    LIVE PLAYER CARD PREVIEW
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider border-amber-500/30 text-amber-300">
                    KAPL 3.0 OFFICIAL
                  </Badge>
                </div>

                {/* Trading Card */}
                <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-card via-[#161616] to-black p-6 shadow-2xl shadow-amber-500/20 text-center space-y-5">
                  {/* Card Corner Ornaments */}
                  <div className="absolute top-3 left-3 flex items-center gap-1">
                    <Badge className="bg-amber-500 text-black font-black text-[10px] px-2 py-0.5 shadow-sm">
                      ₹100 BASE
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="font-mono text-xs font-black text-amber-300/80">
                      #{jerseyNumber || '??'}
                    </span>
                  </div>

                  {/* Player Avatar */}
                  <div className="relative mx-auto w-32 h-32 rounded-3xl p-1 bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-600 shadow-xl shadow-amber-500/25 mt-2">
                    <div className="w-full h-full rounded-[22px] overflow-hidden bg-neutral-900 flex items-center justify-center">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={fullName || 'Preview player'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).src = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80';
                          }}
                        />
                      ) : (
                        <span className="text-5xl">🏏</span>
                      )}
                    </div>
                  </div>

                  {/* Player Name & Role */}
                  <div className="space-y-1.5">
                    <h3 className="text-2xl font-black font-display text-foreground tracking-tight truncate">
                      {fullName || 'Player Name'}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <Badge variant="outline" className={cn('text-xs font-bold uppercase tracking-wider', getRoleBadgeColor(role))}>
                        {role.replace('_', ' ')}
                      </Badge>
                      <Badge className={cn('text-xs font-semibold border', getExperienceBadge(experience).color)}>
                        <span className="mr-1">{getExperienceBadge(experience).icon}</span>
                        {getExperienceBadge(experience).label}
                      </Badge>
                    </div>
                  </div>

                  {/* Skills Grid */}
                  <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-white/10">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Batting</span>
                      <span className="text-xs font-semibold text-foreground truncate block">{battingStyle}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Bowling</span>
                      <span className="text-xs font-semibold text-foreground truncate block">{bowlingStyle}</span>
                    </div>
                  </div>

                  {/* Past Team if Returning */}
                  {experience !== 'new' && (previousTeam || customPreviousTeam) && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left">
                      <span className="text-[10px] uppercase font-bold text-amber-400 block">Past Franchise</span>
                      <span className="text-xs font-bold text-foreground">
                        {previousTeam === 'Other / Custom Franchise' ? customPreviousTeam : previousTeam}
                      </span>
                      {pastAchievements && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                          "{pastAchievements}"
                        </p>
                      )}
                    </div>
                  )}

                  {bio && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2 px-2">
                      "{bio}"
                    </p>
                  )}

                  <div className="pt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Instant database sync & live auction broadcast</span>
                  </div>
                </div>

                {/* Helpful info box */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    Registration FAQ
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>All player registrations are stored permanently in the Supabase database.</li>
                    <li>You will be immediately available in the Live Auction room for franchise paddles.</li>
                    <li>You can update your profile photo, bio, and playing style anytime from your Profile page.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

