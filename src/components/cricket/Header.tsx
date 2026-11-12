import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSunlightMode } from '@/hooks/useSunlightMode';
import { isSoundEnabled, setSoundEnabled, playBoundaryFour } from '@/lib/soundEffects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Sparkles, Sun, Moon, Volume2, VolumeX, Crown, Settings } from 'lucide-react';
import { toast } from 'sonner';

import { TournamentSwitcher } from './TournamentSwitcher';

export function Header({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user, userRole, signOut, isAuthenticated, isAdmin, profile } = useAuth();
  const { isSunlightMode, toggleSunlightMode } = useSunlightMode();
  const [soundOn, setSoundOn] = useState<boolean>(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    const handleToggle = (e: any) => {
      setSoundOn(e.detail?.enabled ?? isSoundEnabled());
    };
    window.addEventListener('kapl-sound-toggle', handleToggle);
    return () => window.removeEventListener('kapl-sound-toggle', handleToggle);
  }, []);

  const handleSoundToggle = () => {
    const nextState = !soundOn;
    setSoundEnabled(nextState);
    setSoundOn(nextState);
    if (nextState) {
      playBoundaryFour();
      toast.success('Sound effects active 🔊');
    } else {
      toast.info('Sound effects muted 🔇');
    }
  };

  const handleSunlightToggle = () => {
    toggleSunlightMode();
    if (!isSunlightMode) {
      toast.success('Outdoor Sunlight Mode active (High Contrast) ☀️');
    } else {
      toast.info('Stadium Obsidian Mode active 🌙');
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      // Redirect to auction page after sign out
      navigate('/');
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (user?.email?.toLowerCase() === 'rohit.doshi2007@gmail.com') {
      return (
        <Badge className="bg-destructive text-destructive-foreground font-black text-[10px] px-2 py-0 shadow-xs flex items-center gap-1 border-amber-400/40">
          <Crown className="w-2.5 h-2.5 text-amber-300" />
          Main Admin
        </Badge>
      );
    }
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 font-bold">Admin</Badge>;
      case 'co_admin':
        return <Badge className="bg-purple-600 text-white font-bold text-[10px] px-1.5 py-0 shadow-xs">Co-Admin</Badge>;
      case 'owner':
        return <Badge className="bg-amber-500 text-black font-bold text-[10px] px-1.5 py-0 shadow-xs">Owner</Badge>;
      case 'captain':
        return <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0">Captain</Badge>;
      case 'player':
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Player</Badge>;
    }
  };

  return (
    <header className={cn('relative overflow-hidden py-2.5 md:py-3.5 bg-card/85 backdrop-blur-xl border-b border-white/[0.08] shadow-md shadow-black/20', className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-cyan-500/10 opacity-70 pointer-events-none" />

      <div className="relative container mx-auto px-3 sm:px-4">
        {/* Desktop Single Row / Mobile Responsive Split */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Title & Branding */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/" className="group flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 group-hover:shadow-amber-500/40 transition-all text-black font-black">
                <span className="text-lg sm:text-xl">🔨</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg sm:text-2xl font-black tracking-tight text-foreground font-display">
                    KAPL
                  </span>
                  <Badge variant="gold" className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 tracking-wider font-black">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5 sm:mr-1 text-amber-300" /> 3.0
                  </Badge>
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium tracking-wide hidden sm:block">
                  Live Player Auction
                </p>
              </div>
            </Link>
          </div>

          {/* Global Tournament Switcher (Desktop only inline) */}
          <div className="hidden md:flex items-center justify-center">
            <TournamentSwitcher size="md" />
          </div>

          {/* Controls & User Account Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Audio Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleSoundToggle}
              className="h-9 w-9 sm:h-8.5 sm:w-8.5 rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08] shadow-xs touch-manipulation"
              title={soundOn ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            >
              {soundOn ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              )}
            </Button>

            {/* High-Contrast Outdoor Sunlight Mode Toggle */}
            <Button
              variant={isSunlightMode ? 'default' : 'outline'}
              size="icon"
              onClick={handleSunlightToggle}
              className={cn(
                'h-9 w-9 sm:h-8.5 sm:w-8.5 rounded-xl shadow-xs transition-all touch-manipulation',
                isSunlightMode
                  ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
              )}
              title={isSunlightMode ? 'Switch to Stadium Night Mode' : 'Switch to Outdoor High-Contrast Sunlight Mode'}
            >
              {isSunlightMode ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black animate-spin-slow" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              )}
            </Button>

            {/* Admin-only Settings Button (near account / login area) */}
            {isAuthenticated && isAdmin && (
              <Link to="/settings" title="Admin Settings & Role Access">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 sm:h-8.5 rounded-xl border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs px-2 sm:px-2.5 gap-1.5 shadow-xs touch-manipulation"
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
            )}

            {/* User Account / Auth */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl pl-1.5 sm:pl-2 pr-2 py-1 shadow-sm transition-all">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <Avatar className="w-6 h-6 sm:w-7 sm:h-7 border border-amber-500/40 shadow-xs shrink-0">
                    {profile?.photoUrl && (
                      <AvatarImage src={profile.photoUrl} alt={profile.name || 'User avatar'} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-amber-500/20 text-amber-300 text-[9px] sm:text-[10px] font-bold">
                      {profile?.name
                        ? profile.name.slice(0, 2).toUpperCase()
                        : user.email
                        ? user.email.slice(0, 2).toUpperCase()
                        : <User className="w-3 h-3" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold text-foreground max-w-[70px] sm:max-w-[120px] md:max-w-[140px] truncate leading-tight">
                      {profile?.name || user.email}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {getRoleBadge(userRole)}
                    </div>
                  </div>
                </div>

                <div className="h-3.5 w-px bg-white/10 mx-0.5" />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-7 sm:w-7 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 touch-manipulation"
                  onClick={handleSignOut}
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Link to="/auth" state={{ tab: 'signin' }}>
                  <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs font-bold hover:bg-white/[0.08] px-2 sm:px-2.5 touch-manipulation">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Tournament Switcher Sub-Bar */}
        <div className="md:hidden flex items-center justify-center pt-2 mt-1 border-t border-white/[0.06]">
          <TournamentSwitcher size="sm" />
        </div>
      </div>
    </header>
  );
}