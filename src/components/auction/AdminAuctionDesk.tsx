import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { formatPlayerRole, formatMoney } from '@/lib/utils';
import { AUCTION_CATEGORIES, AuctionSaleLog } from '@/hooks/useAuction';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Gavel,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Wallet,
  RotateCcw,
  Search,
  User,
  Crown,
  ChevronRight,
  TrendingUp,
  History,
  AlertTriangle,
  Radio,
  Zap,
  Trash2,
  UserPlus,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
const AddPlayerModal = lazy(() => import('@/components/auction/AddPlayerModal'));
import { ExportRegistrationsDialog } from '@/components/cricket/ExportRegistrationsDialog';

interface AdminAuctionDeskProps {
  playerPool: PlayerRecord[];
  teams: Team[];
  currentPlayer: PlayerRecord | null;
  tournamentId?: string;
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
  onSpotlightPlayer: (player: PlayerRecord) => void;
  onDecideSold: (playerId: string, teamId: string, amount: number) => Promise<void> | void;
  onDecideUnsold: (playerId: string) => Promise<void> | void;
  onRevertStatus: (playerId: string) => Promise<void> | void;
  onResetAuction: () => Promise<any> | void;
  onClearAllPlayers?: () => Promise<any> | void;
  onStartAcceleratedRound?: () => Promise<void> | void;
  onRemovePlayer?: (playerId: string) => Promise<void> | void;
  autoAdvanceCountdown?: number | null;
  onCancelAutoAdvance?: () => void;
  isAutoAdvanceEnabled?: boolean;
  onToggleAutoAdvance?: (val: boolean) => void;
  salesHistory: AuctionSaleLog[];
}

export function AdminAuctionDesk({
  playerPool = [],
  teams = [],
  currentPlayer,
  tournamentId = 'kapl-3-mens',
  onAddPlayer,
  onSpotlightPlayer,
  onDecideSold,
  onDecideUnsold,
  onRevertStatus,
  onResetAuction,
  onClearAllPlayers,
  onStartAcceleratedRound,
  onRemovePlayer,
  autoAdvanceCountdown,
  onCancelAutoAdvance,
  isAutoAdvanceEnabled = true,
  onToggleAutoAdvance,
  salesHistory,
}: AdminAuctionDeskProps) {
  // Bidding & Hammer Controls
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [soldPrice, setSoldPrice] = useState<number>(currentPlayer?.basePrice || 100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queue Filters
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Keep price & team selection synced with active player and current tournament division
  useEffect(() => {
    if (currentPlayer) {
      setSoldPrice(currentPlayer.soldPrice || currentPlayer.basePrice || 100);
      if (currentPlayer.teamId && teams.some((t) => t.id === currentPlayer.teamId)) {
        setSelectedTeamId(currentPlayer.teamId);
      } else if (teams.length > 0 && (!selectedTeamId || !teams.some((t) => t.id === selectedTeamId))) {
        setSelectedTeamId(teams[0].id);
      }
    } else if (teams.length > 0 && (!selectedTeamId || !teams.some((t) => t.id === selectedTeamId))) {
      setSelectedTeamId(teams[0].id);
    }
  }, [currentPlayer, teams, selectedTeamId]);

  const selectedTeam = (teams || []).find((t) => t.id === selectedTeamId) || teams?.[0];
  const selectedTeamPurse = selectedTeam
    ? (selectedTeam.players?.length || 0) === 0
      ? (selectedTeam.initialPurse || 10000)
      : (selectedTeam.remainingPurse ?? 10000)
    : 10000;
  const isCurrentSold = currentPlayer?.auctionStatus === 'sold';
  const isCurrentUnsold = currentPlayer?.auctionStatus === 'unsold';

  // Statistics
  const stats = useMemo(() => {
    const total = playerPool.length;
    const sold = playerPool.filter((p) => p.auctionStatus === 'sold').length;
    const unsold = playerPool.filter((p) => p.auctionStatus === 'unsold').length;
    const pending = playerPool.filter((p) => p.auctionStatus === 'pending').length;
    const totalSpent = playerPool.reduce((acc, p) => acc + (p.soldPrice || 0), 0);
    return { total, sold, unsold, pending, totalSpent };
  }, [playerPool]);

  // Filtered queue of players
  const filteredQueue = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return playerPool.filter((p) => {
      // Role filter
      if (selectedRole !== 'all' && p.role !== selectedRole) return false;

      // Status filter
      if (selectedStatus !== 'all' && p.auctionStatus !== selectedStatus) return false;

      // Search query
      if (q) {
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesRole = (p.role || '').toLowerCase().includes(q);
        const matchesStyle = (p.battingStyle || '').toLowerCase().includes(q) || (p.bowlingStyle || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesStyle) return false;
      }

      return true;
    });
  }, [playerPool, selectedRole, selectedStatus, searchQuery]);

  // Handle Hammer Sold
  const handleConfirmSold = async () => {
    if (!currentPlayer) {
      toast.error('No player currently selected for auction');
      return;
    }
    if (isCurrentSold) {
      toast.warning('⚠️ This candidate is already marked SOLD! Click "Revert Status" below first if you wish to re-auction.');
      return;
    }
    if (!selectedTeamId) {
      toast.error('Please select the winning franchise team');
      return;
    }

    const currentSquadCount = selectedTeam?.players?.length || 0;
    const maxSquad = selectedTeam?.maxSquadSize || 10;
    if (currentSquadCount >= maxSquad) {
      toast.error(`⛔ ${selectedTeam?.name} has already reached the maximum squad limit of ${maxSquad} players!`);
      return;
    }

    const availablePurse = selectedTeam?.remainingPurse !== undefined && selectedTeam?.remainingPurse !== null
      ? (currentSquadCount === 0 ? (selectedTeam.initialPurse || 10000) : selectedTeam.remainingPurse)
      : 10000;
    if (soldPrice > availablePurse) {
      toast.error(`⛔ Insufficient purse! ${selectedTeam?.name} only has ${formatMoney(availablePurse)} available.`);
      return;
    }

    if (soldPrice < currentPlayer.basePrice) {
      toast.error(`Sold price cannot be lower than base price (${formatMoney(currentPlayer.basePrice)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onDecideSold(currentPlayer.id, selectedTeamId, soldPrice);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Mark Unsold
  const handleMarkUnsold = async () => {
    if (!currentPlayer) return;
    setIsSubmitting(true);
    try {
      await onDecideUnsold(currentPlayer.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick increment buttons
  const addPrice = (inc: number) => {
    setSoldPrice((prev) => Math.max(currentPlayer?.basePrice || 100, prev + inc));
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP OVERVIEW & STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <Card className="border border-white/10 bg-card/80 p-3.5 rounded-2xl shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Pool</p>
          <p className="text-xl md:text-2xl font-black text-foreground mt-0.5">{stats.total} Players</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stats.total} Candidates</p>
        </Card>
        <Card className="border border-emerald-500/20 bg-emerald-500/5 p-3.5 rounded-2xl shadow-sm">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Drafted / Sold</p>
          <p className="text-xl md:text-2xl font-black text-emerald-400 mt-0.5">{stats.sold} Sold</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total: {formatMoney(stats.totalSpent)}</p>
        </Card>
        <Card className="border border-amber-500/20 bg-amber-500/5 p-3.5 rounded-2xl shadow-sm">
          <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Remaining Pending</p>
          <p className="text-xl md:text-2xl font-black text-amber-400 mt-0.5">{stats.pending} Left</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Waiting for auction</p>
        </Card>
        <Card className="border border-destructive/20 bg-destructive/5 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-destructive tracking-wider">Passed / Unsold</p>
            <p className="text-xl md:text-2xl font-black text-destructive mt-0.5">{stats.unsold}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Eligible for re-auction</p>
          </div>
          {stats.unsold > 0 && onStartAcceleratedRound && (
            <Button
              size="sm"
              onClick={onStartAcceleratedRound}
              className="mt-2 h-7 text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 gap-1 w-full shadow-sm"
            >
              <Zap className="w-3 h-3 text-slate-950" /> Re-Auction ({stats.unsold})
            </Button>
          )}
        </Card>
        <Card className="border border-primary/20 bg-primary/5 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div>
            <p className="text-[10px] uppercase font-bold text-primary tracking-wider">Franchise Purse</p>
            <p className="text-xs text-muted-foreground mt-0.5">₹10,000 / team initial</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="min-h-[38px] sm:min-h-0 sm:h-8 text-[11px] font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1 flex-1 whitespace-nowrap">
                  <RotateCcw className="w-3 h-3 shrink-0" /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Bids &amp; Franchise Purses?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will empty all team rosters, restore every purse to ₹10,000, clear recent bids, and reset all {playerPool.length} current auction players back to pending status.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onResetAuction} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                    Confirm Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {onClearAllPlayers && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={playerPool.length === 0}
                    className="min-h-[38px] sm:min-h-0 sm:h-8 text-[11px] font-bold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1 flex-1 whitespace-nowrap"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" /> Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove All {playerPool.length} Players?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes all players from this division&apos;s auction queue, clears all team squads, and restores every franchise purse to ₹10,000.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearAllPlayers} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                      Remove All Players
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </Card>
      </div>

      {/* 2. AUCTIONEER SPOTLIGHT HAMMER CONSOLE */}
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-950/10 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-transparent p-4 border-b border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Gavel className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                Live Auctioneer Podium
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                  Real-time Sync to Viewers
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Set player-by-player on the hammer. Every decision immediately syncs to all viewers' screens.
              </p>
            </div>
          </div>

          {currentPlayer && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                Active on Stage: {currentPlayer.name}
              </span>
            </div>
          )}
        </div>

        <CardContent className="p-5 md:p-6 space-y-6">
          {currentPlayer ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 4 Cols: Spotlighted Player Identity */}
              <div className="lg:col-span-4 bg-muted/30 border rounded-2xl p-4 text-center space-y-3">
                <Avatar className="w-24 h-24 mx-auto border-2 border-amber-400/50 shadow-md">
                  <AvatarImage src={currentPlayer.photoUrl || undefined} alt={currentPlayer.name} />
                  <AvatarFallback className="bg-amber-500/20 text-amber-400 text-2xl font-black">
                    {(currentPlayer.name || 'P').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h4 className="text-xl font-black text-foreground">{currentPlayer.name}</h4>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs font-bold uppercase">
                      {formatPlayerRole(currentPlayer.role)}
                    </Badge>
                    <Badge
                      className={`text-[10px] font-bold uppercase ${
                        isCurrentSold
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isCurrentUnsold
                          ? 'bg-destructive/20 text-destructive border border-destructive/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {currentPlayer.auctionStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    {currentPlayer.battingStyle && <p>🏏 {currentPlayer.battingStyle}</p>}
                    {currentPlayer.bowlingStyle && <p>⚡ {currentPlayer.bowlingStyle}</p>}
                  </div>
                </div>

                <div className="bg-card/90 border rounded-xl p-2.5 flex items-center justify-around text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Base Price</span>
                    <span className="text-sm font-black text-foreground">{formatMoney(currentPlayer.basePrice)}</span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Current Bid</span>
                    <span className="text-sm font-black text-amber-400">{formatMoney(soldPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Right 8 Cols: Franchise Selector & Final Hammer Controls */}
              <div className="lg:col-span-8 space-y-5">
                {/* 1. Winning Franchise Selection */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                    1. Select Winning Franchise Team:
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {teams.map((t) => {
                      const isSelected = t.id === selectedTeamId;
                      const squadCount = t.players?.length || 0;
                      const maxSquad = t.maxSquadSize || 10;
                      const isFull = squadCount >= maxSquad;
                      const teamPurse = t.remainingPurse !== undefined && t.remainingPurse !== null
                        ? (squadCount === 0 ? (t.initialPurse || 10000) : t.remainingPurse)
                        : (t.initialPurse || 10000);
                      const canAfford = teamPurse >= soldPrice;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamId(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400 shadow-md'
                              : isFull
                              ? 'border-white/10 bg-card opacity-60'
                              : 'border-white/10 bg-card hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs truncate text-foreground">{t.name}</span>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.primaryColor ? `hsl(${t.primaryColor})` : '#f59e0b' }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className={canAfford ? 'text-emerald-400 font-bold' : 'text-destructive font-bold'}>
                              {formatMoney(teamPurse)}
                            </span>
                            <span className={isFull ? 'text-destructive font-black' : ''}>
                              {isFull ? 'FULL (10/10)' : `${squadCount}/${maxSquad} squad`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Final Sold Price Controls */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      2. Final Sold Price:
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Base Price: <strong className="text-foreground">{formatMoney(currentPlayer.basePrice)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min={currentPlayer.basePrice}
                        step={50}
                        value={soldPrice}
                        onChange={(e) => setSoldPrice(Number(e.target.value) || currentPlayer.basePrice)}
                        className="pl-8 text-base font-black bg-background border-white/20 h-11"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSoldPrice(currentPlayer.basePrice)}
                      className="h-11 px-3 text-xs"
                      title="Reset to Base Price"
                    >
                      Reset
                    </Button>
                  </div>

                  {/* Quick Increment Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-muted-foreground mr-1">Quick Add:</span>
                    {[50, 100, 250, 500, 1000].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => addPrice(inc)}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10 bg-muted/50 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                      >
                        +{inc}
                      </button>
                    ))}
                  </div>

                  {/* Warning if team squad full */}
                  {selectedTeam && (selectedTeam.players?.length || 0) >= (selectedTeam.maxSquadSize || 10) && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive mt-2 bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                      <span>
                        ⛔ Squad Full: {selectedTeam.name} already has {selectedTeam.players?.length || 0}/10 players. Cannot allocate more.
                      </span>
                    </div>
                  )}

                  {/* Warning if team can't afford */}
                  {selectedTeam && selectedTeamPurse < soldPrice && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-2 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Notice: {selectedTeam.name} has only {formatMoney(selectedTeamPurse)} remaining in purse.
                      </span>
                    </div>
                  )}

                  {/* Notice if candidate already sold */}
                  {isCurrentSold && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl font-bold">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        Candidate is already marked SOLD. Click "Revert Status" below to refund and re-auction.
                      </span>
                    </div>
                  )}
                </div>

                {/* Auto-Advance Countdown Bar */}
                {autoAdvanceCountdown !== null && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black animate-pulse shadow-md">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Auto-advancing to next candidate in {autoAdvanceCountdown}s...
                    </span>
                    {onCancelAutoAdvance && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onCancelAutoAdvance}
                        className="h-7 text-[11px] font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                      >
                        Stay on this candidate
                      </Button>
                    )}
                  </div>
                )}

                {/* 3. Action Buttons */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2 border-t border-white/10">
                  <Button
                    onClick={handleConfirmSold}
                    disabled={
                      isSubmitting ||
                      isCurrentSold ||
                      (selectedTeam?.players?.length || 0) >= (selectedTeam?.maxSquadSize || 10) ||
                      selectedTeamPurse < soldPrice
                    }
                    className="w-full sm:w-auto sm:flex-1 min-w-0 min-h-[48px] h-auto py-2.5 px-4 whitespace-normal text-center leading-snug bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm gap-2 shadow-lg shadow-emerald-950/20"
                  >
                    <Gavel className="w-4 h-4 shrink-0" />
                    <span>Hammer SOLD to {selectedTeam?.name || 'Selected Team'} for {formatMoney(soldPrice)}!</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleMarkUnsold}
                      disabled={isSubmitting || isCurrentSold}
                      className="flex-1 sm:flex-none min-h-[44px] h-11 px-4 text-xs font-bold gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 shrink-0" />
                      Pass (UNSOLD)
                    </Button>

                    {(isCurrentSold || isCurrentUnsold) && (
                      <Button
                        variant="outline"
                        onClick={() => onRevertStatus(currentPlayer.id)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none min-h-[44px] h-11 px-3 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        Revert Status
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Gavel className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-bold">No Player Currently on Spotlight Hammer</p>
              <p className="text-xs mt-1">Select any player from the Master Queue below to bring them to the podium.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. SET AUCTION PLAYER-BY-PLAYER: MASTER QUEUE */}
      <Card className="border border-white/10 bg-card/85 rounded-3xl shadow-lg">
        <CardHeader className="p-5 border-b border-white/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Player-by-Player Auction Queue ({filteredQueue.length} shown of {playerPool.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Browse all candidates. Click "Bring to Spotlight" to set any player onto the live hammer stage across all devices.
              </CardDescription>
            </div>

            {/* Role Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedRole('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedRole === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({playerPool.length})
              </button>
              {AUCTION_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
                const count = playerPool.filter((p) => p.role === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedRole(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedRole === cat.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat.icon} {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
              <div className="relative w-full sm:flex-1 sm:max-w-xs min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates by name (e.g. Player 15)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 min-h-[44px] sm:min-h-0 sm:h-9 text-xs bg-background/60 border-white/10 rounded-xl"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Suspense fallback={
                  <Button size="sm" disabled className="min-h-[44px] sm:min-h-0 sm:h-9 bg-gray-600 text-slate-950 font-black gap-1.5 text-xs shrink-0 shadow-sm">
                    <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                    + Add Player
                  </Button>
                }>
                  <AddPlayerModal
                    tournamentId={tournamentId}
                    onAddPlayer={onAddPlayer}
                    trigger={
                      <Button size="sm" className="min-h-[44px] sm:min-h-0 sm:h-9 flex-1 sm:flex-none bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black gap-1.5 text-xs shrink-0 shadow-sm">
                        <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                        + Add Player
                      </Button>
                    }
                  />
                </Suspense>
                <ExportRegistrationsDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] sm:min-h-0 sm:h-9 flex-1 sm:flex-none text-xs font-bold border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 gap-1.5 shrink-0 shadow-sm"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      Export
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto text-xs">
              <span className="text-muted-foreground font-medium text-[11px] mr-1">Status:</span>
              {(['all', 'pending', 'sold', 'unsold'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 sm:px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-lg text-xs font-bold capitalize transition-all ${
                    selectedStatus === st
                      ? 'bg-foreground text-background font-black'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Mobile Card Queue (< md) */}
          <div className="md:hidden divide-y divide-white/10">
            {filteredQueue.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                No candidates found matching the selected filters.
              </div>
            ) : (
              filteredQueue.map((p) => {
                const isSpotlight = currentPlayer?.id === p.id;
                const assignedTeam = (teams || []).find((t) => t.id === p.teamId);
                const isSold = p.auctionStatus === 'sold';
                const isUnsold = p.auctionStatus === 'unsold';

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 space-y-2.5 ${isSpotlight ? 'bg-amber-500/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-10 h-10 rounded-xl border border-white/10 shrink-0">
                          <AvatarImage src={p.photoUrl || undefined} alt={p.name} />
                          <AvatarFallback className="text-xs font-black bg-muted">
                            {(p.name || 'P').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize truncate">
                            {formatPlayerRole(p.role)} • Base {formatMoney(p.basePrice)}
                          </p>
                          {assignedTeam && (
                            <p className="text-[11px] font-semibold text-emerald-400 truncate mt-0.5">
                              {assignedTeam.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isSpotlight ? (
                          <Badge className="bg-amber-500 text-slate-950 text-[10px] font-black gap-1">
                            ON HAMMER
                          </Badge>
                        ) : isSold ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            SOLD {formatMoney(p.soldPrice || p.basePrice)}
                          </Badge>
                        ) : isUnsold ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            UNSOLD
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            PENDING
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isSpotlight ? (
                        <Button size="sm" variant="secondary" disabled className="min-h-[44px] flex-1 text-xs font-bold">
                          Active Podium
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onSpotlightPlayer(p)}
                          className="min-h-[44px] flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Bring to Spotlight
                        </Button>
                      )}
                      {(isSold || isUnsold) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRevertStatus(p.id)}
                          className="min-h-[44px] px-3 text-xs"
                        >
                          Revert
                        </Button>
                      )}
                      {onRemovePlayer && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Permanently remove candidate "${p.name}" from auction?`)) {
                              onRemovePlayer(p.id);
                            }
                          }}
                          className="min-h-[44px] min-w-[44px] p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                          title="Remove candidate from auction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-bold border-b border-white/10 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-3">Role & Style</th>
                  <th className="py-3 px-3">Base Price</th>
                  <th className="py-3 px-3">Auction Status</th>
                  <th className="py-3 px-3">Allocated Franchise</th>
                  <th className="py-3 px-4 text-right">Auctioneer Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No candidates found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((p) => {
                    const isSpotlight = currentPlayer?.id === p.id;
                    const assignedTeam = (teams || []).find((t) => t.id === p.teamId);
                    const isSold = p.auctionStatus === 'sold';
                    const isUnsold = p.auctionStatus === 'unsold';

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSpotlight ? 'bg-amber-500/10 font-medium' : ''
                        }`}
                      >
                        {/* Player name & avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8 rounded-lg border border-white/10">
                              <AvatarImage src={p.photoUrl || undefined} alt={p.name} />
                              <AvatarFallback className="text-[10px] font-black bg-muted">
                                {(p.name || 'P').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-bold text-foreground block text-xs">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{p.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Styles */}
                        <td className="py-3 px-3">
                          <div>
                            <span className="font-semibold text-primary capitalize block">
                              {formatPlayerRole(p.role)}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {p.battingStyle || 'Right-hand bat'} • {p.bowlingStyle || 'None'}
                            </span>
                          </div>
                        </td>

                        {/* Base Price */}
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {formatMoney(p.basePrice)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3">
                          {isSpotlight ? (
                            <Badge className="bg-amber-500 text-slate-950 text-[10px] font-black gap-1 animate-pulse">
                              <Radio className="w-3 h-3" /> ON HAMMER
                            </Badge>
                          ) : isSold ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold gap-1">
                              <CheckCircle2 className="w-3 h-3" /> SOLD ({formatMoney(p.soldPrice || p.basePrice)})
                            </Badge>
                          ) : isUnsold ? (
                            <Badge variant="destructive" className="text-[10px] font-bold gap-1">
                              <XCircle className="w-3 h-3" /> UNSOLD
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              PENDING
                            </Badge>
                          )}
                        </td>

                        {/* Allocated Team */}
                        <td className="py-3 px-3">
                          {assignedTeam ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: assignedTeam.primaryColor ? `hsl(${assignedTeam.primaryColor})` : '#f59e0b' }}
                              />
                              <span className="font-bold text-foreground text-xs">{assignedTeam.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {isSpotlight ? (
                            <Button size="sm" variant="secondary" disabled className="h-7 text-xs font-bold gap-1">
                              Active Podium
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => onSpotlightPlayer(p)}
                              className="h-7 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1 shadow-xs"
                            >
                              <Zap className="w-3 h-3" />
                              Bring to Spotlight
                            </Button>
                          )}

                          {(isSold || isUnsold) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRevertStatus(p.id)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              title="Reset player to Pending"
                            >
                              Revert
                            </Button>
                          )}

                          {onRemovePlayer && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Permanently remove candidate "${p.name}" from auction?`)) {
                                  onRemovePlayer(p.id);
                                }
                              }}
                              className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              title="Remove candidate from auction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. LIVE SALES & TRANSACTION FEED (Who bought whom & for how much) */}
      <Card className="border border-white/10 bg-card/80 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <History className="w-4 h-4" />
            </span>
            <h4 className="font-bold text-sm text-foreground">Recent Auction Transactions & Sales Log</h4>
          </div>
          <span className="text-xs text-muted-foreground">{salesHistory.length} Total Sales Recorded</span>
        </div>

        {salesHistory.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No players have been drafted yet. Select any player above and click Hammer SOLD to record allocations.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {salesHistory.slice(0, 9).map((log, idx) => (
              <div
                key={log?.id || `desk-log-${idx}`}
                className="p-2.5 rounded-xl border border-white/5 bg-background/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-foreground block">{log.playerName}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {formatPlayerRole(log.playerRole)} • {log.status === 'sold' ? log.teamName : 'Unsold'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 block">{formatMoney(log.amount)}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

