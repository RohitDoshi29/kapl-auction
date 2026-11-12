import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Sparkles, Trophy, Gavel, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PlayerRecord, PlayerRole } from '@/lib/cricketTypes';
import { supabase } from '@/integrations/supabase/client';
import { saveToPlayerVault } from '@/lib/exportRegistrations';
import { syncPlayerToAuctionAndTournament, useAuth } from '@/contexts/AuthContext';
import { validatePlayerInput } from '@/lib/schemas';
import { useRequestQueue } from '@/hooks/useRequestQueue';
import { logger } from '@/lib/logger';

interface AddPlayerModalProps {
  tournamentId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPlayerAdded?: (player: PlayerRecord) => void;
  onAddPlayer?: (data: {
    name: string;
    role: PlayerRole;
    battingStyle?: string;
    bowlingStyle?: string;
    basePrice?: number;
    jerseyNumber?: number | null;
    mobileNumber?: string | null;
    photoUrl?: string | null;
    gender?: 'male' | 'female';
    tournamentId?: string;
  }) => Promise<{ success: boolean; player?: PlayerRecord; error?: string }>;
}

export function AddPlayerModal({
  tournamentId = 'kapl-3-mens',
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onPlayerAdded,
  onAddPlayer,
}: AddPlayerModalProps) {
  const { isAdmin } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('all_rounder');
  const [battingStyle, setBattingStyle] = useState('Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState('Right-arm medium');
  const [basePrice, setBasePrice] = useState<number>(100);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const defaultGender = tournamentId === 'kapl-3-womens' ? 'female' : 'male';
  const [gender, setGender] = useState<'male' | 'female'>(defaultGender);
  const [targetTourn, setTargetTourn] = useState<string>(tournamentId || 'kapl-3-mens');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isPending, executeRequest } = useRequestQueue();

  useEffect(() => {
    setTargetTourn(tournamentId || 'kapl-3-mens');
    setGender(tournamentId === 'kapl-3-womens' ? 'female' : 'male');
  }, [tournamentId]);

  const resetForm = () => {
    setName('');
    setRole('all_rounder');
    setBattingStyle('Right-hand bat');
    setBowlingStyle('Right-arm medium');
    setBasePrice(100);
    setJerseyNumber('');
    setMobileNumber('');
    setGender(tournamentId === 'kapl-3-womens' ? 'female' : 'male');
    setTargetTourn(tournamentId || 'kapl-3-mens');
    setPhotoUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Only administrators can add new players.');
      return;
    }

    if (isPending('add-player')) {
      toast.error('Player is already being added. Please wait...');
      return;
    }

    const cleanName = name.trim();
    const jerseyNum = jerseyNumber.trim() ? parseInt(jerseyNumber.trim(), 10) : null;

    const payload = {
      name: cleanName,
      role,
      battingStyle,
      bowlingStyle,
      basePrice: Number(basePrice) || 100,
      jerseyNumber: jerseyNum,
      mobileNumber: mobileNumber.trim() || null,
      gender,
      tournamentId: targetTourn,
      photoUrl: photoUrl.trim() || null,
    };

    const validation = validatePlayerInput(payload);
    if (!validation.success) {
      toast.error(validation.error);
      logger.warn('Player validation failed', { error: validation.error, payload });
      return;
    }

    setIsSubmitting(true);
    let createdPlayer: PlayerRecord | undefined;
    try {
      await executeRequest('add-player', async () => {
        if (onAddPlayer) {
          const res = await onAddPlayer(validation.data as any);
          if (res && res.success === false) {
            throw new Error(res.error || 'Failed to add player');
          }
          createdPlayer = res?.player;
        } else {
          const { data: { session: liveSession } } = await supabase.auth.getSession();
          if (!liveSession?.access_token) {
            throw new Error('Supabase session not active. Please Sign Out and Sign In again.');
          }

          const generatedId = `p_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const dualTournaments = targetTourn === 'all'
            ? ['kapl-3-mens', 'kapl-3-womens']
            : [targetTourn];

          for (const tId of dualTournaments) {
            const idForTourn = tId === 'kapl-3-womens' ? `${generatedId}_w` : generatedId;
            const { error: insErr } = await supabase.from('players').insert({
              id: idForTourn,
              name: cleanName,
              photo_url: validation.data.photoUrl || null,
              role: role,
              batting_style: battingStyle || null,
              bowling_style: bowlingStyle || null,
              jersey_number: jerseyNum,
              mobile_number: validation.data.mobileNumber || null,
              tournament_id: tId,
              base_price: Number(basePrice) || 100,
              auction_status: 'pending',
            });
            if (insErr) {
              if (insErr.code === '23505') {
                const { error: updErr } = await supabase.from('players').update({
                  name: cleanName,
                  photo_url: validation.data.photoUrl || null,
                  role: role,
                  batting_style: battingStyle || null,
                  bowling_style: bowlingStyle || null,
                  jersey_number: jerseyNum,
                  mobile_number: validation.data.mobileNumber || null,
                  tournament_id: tId,
                  base_price: Number(basePrice) || 100,
                }).eq('id', idForTourn);
                if (updErr) throw new Error(updErr.message);
              } else {
                throw new Error(insErr.message);
              }
            }
          }

          const masterRecord: PlayerRecord = {
            id: generatedId,
            name: cleanName,
            role: role,
            battingStyle: battingStyle,
            bowlingStyle: bowlingStyle,
            basePrice: Number(basePrice) || 100,
            soldPrice: null,
            auctionStatus: 'pending',
            tournamentId: targetTourn,
            jerseyNumber: jerseyNum,
            mobileNumber: validation.data.mobileNumber || null,
            photoUrl: validation.data.photoUrl || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          createdPlayer = masterRecord;
          saveToPlayerVault({
            ...masterRecord,
            gender,
          });

          await syncPlayerToAuctionAndTournament(masterRecord);
        }
      });

      onPlayerAdded?.(createdPlayer || (validation.data as any));
      toast.success(`🏏 ${cleanName} added to the Live Auction pool!`);
      logger.info('Player added successfully', { playerName: cleanName, tournamentId: targetTourn });
      resetForm();
      setIsOpen(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to create player: ' + errorMessage);
      logger.error('Failed to add player', err, { playerName: cleanName });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="min-h-[44px] sm:min-h-0 sm:h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs gap-1.5 shadow-md shadow-amber-500/20 touch-manipulation"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Player to Auction</span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 bg-card/95 backdrop-blur-2xl border border-amber-500/35 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-1.5 border-b border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold px-2 py-0.5"
            >
              <Gavel className="w-3 h-3 mr-1 text-amber-400" />
              LIVE AUCTION DRAFT CANDIDATE
            </Badge>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black font-display text-foreground flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-amber-400" />
            Add Player to Auction Pool
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a candidate to enter the live bidding podium. Candidate will be draftable by franchise teams immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Player Name */}
          <div className="space-y-1.5">
            <Label htmlFor="player-name" className="text-xs font-bold text-foreground">
              Player Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="player-name"
              placeholder="e.g. Virat Kohli or Sarah Taylor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl"
              required
              autoFocus
            />
          </div>

          {/* Playing Role & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Playing Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as PlayerRole)}>
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_rounder">👑 All-Rounder</SelectItem>
                  <SelectItem value="batter">🏏 Pure Batter</SelectItem>
                  <SelectItem value="bowler">⚡ Strike Bowler</SelectItem>
                  <SelectItem value="wicket_keeper">🧤 Wicket-Keeper</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Gender</Label>
              <Select value={gender} onValueChange={(val) => setGender(val === 'male' || val === 'female' ? val : 'male')}>
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👨 Male</SelectItem>
                  <SelectItem value="female">👩 Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Batting & Bowling Styles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Batting Style</Label>
              <Select value={battingStyle} onValueChange={setBattingStyle}>
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl">
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
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl">
                  <SelectValue placeholder="Bowling style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Right-arm fast">Right-arm fast</SelectItem>
                  <SelectItem value="Right-arm medium">Right-arm medium</SelectItem>
                  <SelectItem value="Right-arm spin">Right-arm off spin / leg spin</SelectItem>
                  <SelectItem value="Left-arm fast">Left-arm fast</SelectItem>
                  <SelectItem value="Left-arm spin">Left-arm orthodox spin</SelectItem>
                  <SelectItem value="None">None / Pure Batter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Base Price & Jersey Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Base Value (₹)</Label>
              <Select value={String(basePrice)} onValueChange={(val) => setBasePrice(Number(val))}>
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl font-mono">
                  <SelectValue placeholder="Base Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">₹100 (Default Standard)</SelectItem>
                  <SelectItem value="150">₹150</SelectItem>
                  <SelectItem value="200">₹200 (Emerging Star)</SelectItem>
                  <SelectItem value="250">₹250</SelectItem>
                  <SelectItem value="300">₹300 (Premium Category)</SelectItem>
                  <SelectItem value="400">₹400</SelectItem>
                  <SelectItem value="500">₹500 (Icon Candidate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="player-jersey" className="text-xs font-bold text-foreground">
                Jersey Number (0-99)
              </Label>
              <Input
                id="player-jersey"
                type="number"
                min="0"
                max="99"
                placeholder="e.g. 7 or 18 (optional)"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Tournament Selection & Mobile Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Tournament League</Label>
              <Select value={targetTourn} onValueChange={setTargetTourn}>
                <SelectTrigger className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl">
                  <SelectValue placeholder="Tournament League" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏆 Both Men's & Women's Leagues</SelectItem>
                  <SelectItem value="kapl-3-mens">🏏 KAPL 3.0 Men's Tournament</SelectItem>
                  <SelectItem value="kapl-3-womens">🏏 KAPL 3.0 Women's Tournament</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="player-phone" className="text-xs font-bold text-foreground">
                Mobile Number (optional)
              </Label>
              <Input
                id="player-phone"
                type="tel"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Photo URL */}
          <div className="space-y-1.5">
            <Label htmlFor="player-photo" className="text-xs font-bold text-foreground">
              Photo URL (optional)
            </Label>
            <Input
              id="player-photo"
              placeholder="https://... photo link (leave blank for auto avatar)"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="h-10 text-xs sm:text-sm bg-white/[0.04] border-white/10 rounded-xl"
            />
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-0 sm:h-10 px-4 text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-0 sm:h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs sm:text-sm gap-2 shadow-lg shadow-amber-500/25"
            >
              {isSubmitting ? (
                <span>Adding to Auction...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Player to Live Auction</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddPlayerModal;
