import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { formatPlayerRole, formatMoney } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import {
  Gavel,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Wallet,
  RotateCcw,
  User,
  Crown,
  Users,
  Clock,
  ArrowRight,
  Eye,
  AlertTriangle,
  Tv,
  Maximize2,
  Minimize2,
  Zap,
  ShieldAlert,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuctionSaleLog } from '@/hooks/useAuction';
const AddPlayerModal = lazy(() => import('@/components/auction/AddPlayerModal'));

interface SinglePlayerAuctionStageProps {
  player: PlayerRecord | null;
  playerPool?: PlayerRecord[];
  teams: Team[];
  isAdmin?: boolean;
  tournamentId?: string;
  selectedPlayerId?: string;
  onAddPlayer?: (data: any) => Promise<any>;
  onResetAuction?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSpotlightPlayer?: (player: PlayerRecord) => void;
  currentBid?: number;
  highestBidderTeamId?: string | null;
  onDecideSold?: (playerId: string, teamId: string, amount: number) => void;
  onDecideUnsold?: (playerId: string) => void;
  onRevert?: (playerId: string) => void;
  salesHistory?: AuctionSaleLog[];
  autoAdvanceCountdown?: number | null;
  onCancelAutoAdvance?: () => void;
}

export function SinglePlayerAuctionStage({
  player,
  playerPool = [],
  teams = [],
  isAdmin = false,
  tournamentId = 'kapl-3-mens',
  onAddPlayer,
  onResetAuction,
  onNext = () => {},
  onPrev = () => {},
  onSpotlightPlayer,
  currentBid,
  highestBidderTeamId,
  onDecideSold = () => {},
  onDecideUnsold = () => {},
  onRevert = () => {},
  salesHistory = [],
  autoAdvanceCountdown = null,
  onCancelAutoAdvance,
}: SinglePlayerAuctionStageProps) {
  const { user } = useAuth();
  const cleanUserEmail = user?.email?.toLowerCase().trim();

  // Projector / Stadium TV Mode Toggle
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  // Find user-owned franchise if logged in user is a Team Owner
  const userOwnedTeam = useMemo(() => {
    if (!cleanUserEmail) return null;
    return (teams || []).find((t) => t.ownerEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail) || null;
  }, [teams, cleanUserEmail]);

  // Selected team for Admin hammer decision
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams?.[0]?.id || '');
  const [soldAmount, setSoldAmount] = useState<number>(100);

  // Selected team for Owner / Franchise Hub inspection
  const [activeOwnerTeamId, setActiveOwnerTeamId] = useState<string>(() => {
    return userOwnedTeam ? userOwnedTeam.id : teams?.[0]?.id || '';
  });

  // Keep activeOwnerTeamId synced if user owns a team or division changes
  useEffect(() => {
    if (userOwnedTeam) {
      setActiveOwnerTeamId(userOwnedTeam.id);
    } else if ((teams || []).length > 0 && (!activeOwnerTeamId || !(teams || []).some((t) => t.id === activeOwnerTeamId))) {
      setActiveOwnerTeamId(teams[0].id);
    }
  }, [userOwnedTeam, teams, activeOwnerTeamId]);

  // Sync sold amount & valid team selection when spotlight player or division changes
  useEffect(() => {
    if (player) {
      setSoldAmount(player.soldPrice || player.basePrice || 100);
      if (player.teamId && (teams || []).some((t) => t.id === player.teamId)) {
        setSelectedTeamId(player.teamId);
      } else if ((teams || []).length > 0 && (!selectedTeamId || !(teams || []).some((t) => t.id === selectedTeamId))) {
        setSelectedTeamId(teams[0].id);
      }
    } else if ((teams || []).length > 0 && (!selectedTeamId || !(teams || []).some((t) => t.id === selectedTeamId))) {
      setSelectedTeamId(teams[0].id);
    }
  }, [player, teams, selectedTeamId]);

  // Sync admin decision team and sold price when a live bid is placed
  useEffect(() => {
    if (highestBidderTeamId && (teams || []).some((t) => t.id === highestBidderTeamId)) {
      setSelectedTeamId(highestBidderTeamId);
    }
  }, [highestBidderTeamId, teams]);

  useEffect(() => {
    if (currentBid && currentBid > 0) {
      setSoldAmount(currentBid);
    }
  }, [currentBid]);

  const fallbackTeam: Team = {
    id: 'placeholder',
    name: 'Franchise Hub',
    group: 'A',
    logo: null,
    primaryColor: '0 84% 60%',
    players: [],
    playerCount: 0,
    initialPurse: 10000,
    remainingPurse: 10000,
    maxSquadSize: 10,
  };

  const selectedTeam = (teams || []).find((t) => t.id === selectedTeamId) || teams?.[0] || fallbackTeam;
  const inspectedTeam = (teams || []).find((t) => t.id === activeOwnerTeamId) || userOwnedTeam || selectedTeam || teams?.[0] || fallbackTeam;
  const assignedTeam = (teams || []).find((t) => t.id === player?.teamId);
  const isSold = player?.auctionStatus === 'sold';
  const isUnsold = player?.auctionStatus === 'unsold';

  const getRoleBadge = (role: PlayerRole) => {
    switch (role) {
      case 'all_rounder':
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">👑 ALL-ROUNDER</Badge>;
      case 'batter':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">🏏 BATTER</Badge>;
      case 'bowler':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">⚡ BOWLER</Badge>;
      case 'wicket_keeper':
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">🧤 WICKET-KEEPER</Badge>;
    }
  };

  // Squad role breakdown for team analytics
  const squadPlayers = inspectedTeam?.players || [];
  const initialPurse = inspectedTeam?.initialPurse || 10000;
  const spentFromSquad = squadPlayers.reduce((acc: number, p: any) => acc + (Number(p.soldPrice) || 0), 0);
  const remainingPurse = inspectedTeam?.remainingPurse !== undefined && inspectedTeam?.remainingPurse !== null
    ? (squadPlayers.length === 0 ? initialPurse : inspectedTeam.remainingPurse)
    : Math.max(0, initialPurse - spentFromSquad);
  const spentPurse = Math.max(0, initialPurse - remainingPurse);
  const spentPercent = Math.min(100, Math.round((spentPurse / initialPurse) * 100));

  const maxSquadSize = inspectedTeam?.maxSquadSize || 10;
  const currentSquadCount = squadPlayers.length;
  const openSlots = Math.max(0, maxSquadSize - currentSquadCount);

  // KAPL Rules: Minimum base bid is ₹100.
  // Max permissible safe bid reserves ₹100 for each remaining open slot to ensure team can complete full 10-player squad.
  const minBasePrice = 100;
  const maxSafeBid = Math.max(0, remainingPurse - Math.max(0, openSlots - 1) * minBasePrice);

  const battersCount = squadPlayers.filter((p: any) => p.role === 'batter').length;
  const bowlersCount = squadPlayers.filter((p: any) => p.role === 'bowler').length;
  const allRoundersCount = squadPlayers.filter((p: any) => p.role === 'all_rounder').length;
  const keepersCount = squadPlayers.filter((p: any) => p.role === 'wicket_keeper').length;

  const isViewerTheOwner = Boolean(
    inspectedTeam?.ownerEmail && cleanUserEmail && inspectedTeam.ownerEmail.toLowerCase().trim() === cleanUserEmail
  );

  // Upcoming candidates in queue (who are coming next)
  const upcomingCandidates = useMemo(() => {
    if (!playerPool || playerPool.length === 0) return [];
    return playerPool
      .filter((p) => p.auctionStatus === 'pending' && p.id !== player?.id)
      .slice(0, 5);
  }, [playerPool, player?.id]);

  const handleConfirmSale = () => {
    if (!player) return;
    if (isSold) {
      toast.error('This candidate is already marked SOLD. Click Revert to refund first.');
      return;
    }
    if (!selectedTeamId) {
      toast.error('Please select a winning franchise for this candidate');
      return;
    }
    const targetTeam = (teams || []).find((t) => t.id === selectedTeamId);
    if (!targetTeam) return;

    const targetSquad = targetTeam.players?.length || 0;
    const targetMaxSquad = targetTeam.maxSquadSize || 10;
    if (targetSquad >= targetMaxSquad) {
      toast.error(`Squad Full: ${targetTeam.name} already has ${targetSquad}/${targetMaxSquad} players.`);
      return;
    }

    const targetPurse = targetTeam.remainingPurse !== undefined && targetSquad === 0
      ? (targetTeam.initialPurse || 10000)
      : (targetTeam.remainingPurse ?? 10000);

    if (soldAmount > targetPurse) {
      toast.error(`Purse Deficit: ${targetTeam.name} has only ${formatMoney(targetPurse)} left, but sold price is ${formatMoney(soldAmount)}.`);
      return;
    }

    if (soldAmount < player.basePrice) {
      toast.error(`Sold amount cannot be less than base price (${formatMoney(player.basePrice)})`);
      return;
    }
    onDecideSold(player.id, selectedTeamId, soldAmount);
  };

  // Automatically spotlight first pending player if no player is spotlighted (Admin only)
  useEffect(() => {
    if (isAdmin && !player && playerPool.length > 0 && onSpotlightPlayer) {
      const firstPending = playerPool.find((p) => p.auctionStatus === 'pending') || playerPool[0];
      if (firstPending) {
        onSpotlightPlayer(firstPending);
      }
    }
  }, [isAdmin, player, playerPool, onSpotlightPlayer]);

  // Check if auction pool has players and all are sold
  const isAllSold = useMemo(() => {
    return playerPool.length > 0 && playerPool.every((p) => p.auctionStatus === 'sold');
  }, [playerPool]);

  const auctionTotals = useMemo(() => {
    const totalInitialPurse = (teams || []).reduce((sum, t) => sum + (t.initialPurse || 10000), 0);
    const totalSpent = (teams || []).reduce(
      (sum, t) => sum + (t.players || []).reduce((pSum, p) => pSum + (Number(p.soldPrice) || 0), 0),
      0
    );
    const activeTeamsCount = (teams || []).filter((t) => (t.players || []).length > 0).length;
    return { totalInitialPurse, totalSpent, activeTeamsCount };
  }, [teams]);

  if (!player) {
    return (
      <Card className="p-5 sm:p-8 text-center border-dashed border-2 rounded-3xl bg-card/60 max-w-xl mx-auto shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-3 text-amber-400">
          <Gavel className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black mb-1 text-foreground">
          {playerPool.length === 0 ? 'No Players in Auction Pool' : 'No Player Selected'}
        </h3>
        <p className="text-muted-foreground text-xs mb-5 max-w-md mx-auto">
          {playerPool.length === 0
            ? isAdmin
              ? 'There are currently no candidates in the live auction queue. Add players to begin live bidding.'
              : 'There are currently no candidates in the live auction queue. An administrator can add players to begin live bidding.'
            : 'Select any candidate from the queue below to start the spotlight auction.'}
        </p>
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Suspense fallback={
              <Button disabled className="min-h-[44px] bg-gray-600 text-slate-950 font-black gap-2 text-xs shadow-md">
                <UserPlus className="w-4 h-4 text-slate-950" />
                Add Player to Auction
              </Button>
            }>
              <AddPlayerModal
                tournamentId={tournamentId}
                onAddPlayer={onAddPlayer}
                trigger={
                  <Button className="min-h-[44px] bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black gap-2 text-xs shadow-md touch-manipulation">
                    <UserPlus className="w-4 h-4 text-slate-950" />
                    Add Player to Auction
                  </Button>
                }
              />
            </Suspense>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AUCTION COMPLETED BANNER */}
      {isAllSold && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-emerald-500/20 border-2 border-amber-500/40 rounded-3xl p-4 md:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25 shrink-0">
                <Trophy className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-foreground tracking-tight">
                    KAPL 3.0 Mega Auction Completed!
                  </h2>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                    {playerPool.filter(p => p.auctionStatus === 'sold').length}/{playerPool.length} SOLD
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All {playerPool.length} players in this division pool have been drafted.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Total Purse Spent</div>
                <div className="font-bold text-emerald-400 font-mono">
                  {formatMoney(auctionTotals.totalSpent)} / {formatMoney(auctionTotals.totalInitialPurse)}
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Active Teams</div>
                <div className="font-bold text-amber-400">
                  {auctionTotals.activeTeamsCount} of {teams.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. TOP STAGE BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-card/85 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 px-3 sm:px-4 shadow-sm gap-2">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          {isAdmin ? (
            <>
              <Button variant="ghost" size="sm" onClick={onPrev} className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground min-h-[44px] touch-manipulation">
                <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
              </Button>

              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider sm:hidden">
                Podium
              </span>

              <Button variant="ghost" size="sm" onClick={onNext} className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground sm:hidden min-h-[44px] touch-manipulation">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-wide">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> LIVE STAGE
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Official Broadcast</span>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">
            Spotlight Podium
          </span>
          {userOwnedTeam && (
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black gap-1">
              <Crown className="w-3 h-3 text-amber-400" />
              My Franchise: {userOwnedTeam.name} (Purse: {formatMoney(userOwnedTeam.remainingPurse ?? 10000)})
            </Badge>
          )}
        </div>

        {userOwnedTeam && (
          <div className="flex sm:hidden items-center justify-center">
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black gap-1">
              <Crown className="w-3 h-3 text-amber-400" />
              {userOwnedTeam.name} — {formatMoney(userOwnedTeam.remainingPurse ?? 10000)}
            </Badge>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsProjectorMode(true)}
            className="h-8 text-xs font-bold gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            Big Screen TV
          </Button>

          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={onNext} className="hidden sm:inline-flex gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Next Candidate <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* RECENT SALES TICKER */}
      {salesHistory && salesHistory.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-3 bg-white/[0.02] border border-white/5 rounded-2xl text-xs scrollbar-hide">
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Recent Drafts:
          </span>
          {salesHistory.slice(0, 6).map((s, idx) => (
            <Badge
              key={s?.id || `recent-${idx}`}
              variant="outline"
              className="shrink-0 text-[11px] font-medium border-white/10 bg-card/60 gap-1.5 py-1 px-2.5"
            >
              <span className="font-bold text-foreground">{s.playerName}</span>
              <span className="text-muted-foreground">→</span>
              {s.status === 'sold' ? (
                <>
                  <span className="text-amber-300 font-semibold">{s.teamName}</span>
                  <span className="font-mono text-emerald-400 font-bold">{formatMoney(s.amount)}</span>
                </>
              ) : (
                <span className="text-destructive font-semibold">Unsold</span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* AUTO ADVANCE COUNTDOWN BANNER (Admin Only) */}
      {isAdmin && autoAdvanceCountdown !== null && (
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

      {/* 2. MAIN SINGLE PLAYER SPOTLIGHT CARD */}
      <Card className="relative overflow-hidden border-2 border-amber-500/30 rounded-3xl shadow-2xl bg-gradient-to-b from-card via-card to-amber-950/10">
        {/* SOLD Celebratory Banner */}
        {isSold && assignedTeam && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white p-3 text-center font-black tracking-wide text-sm md:text-base flex items-center justify-center gap-2 shadow-md">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            SOLD TO {assignedTeam.name.toUpperCase()} FOR {formatMoney(player.soldPrice || player.basePrice)}!
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
        )}

        {/* UNSOLD Banner */}
        {isUnsold && (
          <div className="bg-destructive text-destructive-foreground p-2.5 text-center font-black tracking-wide text-xs md:text-sm">
            ❌ PLAYER MARKED UNSOLD
          </div>
        )}

        <div className="p-4 sm:p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Player Profile & Base Value (Left 5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center text-center space-y-4 border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
              <div className="relative">
                <Avatar className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 border-4 border-amber-500/30 shadow-2xl rounded-full">
                  <AvatarImage src={player.photoUrl || undefined} alt={player.name} className="object-cover" />
                  <AvatarFallback className="bg-amber-500/10 text-amber-400 text-3xl sm:text-4xl md:text-5xl font-black">
                    {(player.name || 'P').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {player.jerseyNumber && (
                  <Badge className="absolute bottom-1 right-2 bg-slate-950 border border-amber-400 text-amber-300 font-mono text-xs font-black px-2 py-0.5 rounded-full">
                    #{player.jerseyNumber}
                  </Badge>
                )}
              </div>

              <div className="w-full min-w-0">
                <div className="mb-2">{getRoleBadge(player.role)}</div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight break-words">
                  {player.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                  {player.battingStyle && (
                    <span className="bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-md font-medium">
                      🏏 {player.battingStyle}
                    </span>
                  )}
                  {player.bowlingStyle && (
                    <span className="bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-md font-medium">
                      ⚡ {player.bowlingStyle}
                    </span>
                  )}
                </div>
              </div>

              {/* BASE VALUE / PRICE PROMINENT DISPLAY */}
              <div className="w-full bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-around text-center shadow-inner">
                <div>
                  <span className="text-[10px] text-amber-400/90 uppercase font-bold tracking-wider block">
                    Current Player Base Value
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
                    {formatMoney(player.basePrice)}
                  </span>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Auction Status
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${
                      isSold ? 'text-emerald-400' : isUnsold ? 'text-destructive' : 'text-amber-400'
                    }`}
                  >
                    {player.auctionStatus}
                  </span>
                </div>
              </div>

              {/* Tournament Meta Pill */}
              <div className="w-full text-xs text-muted-foreground bg-white/[0.02] p-3 rounded-xl border border-white/5 text-left space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span>Tournament League:</span>
                  <span className="font-semibold text-foreground">KAPL Season 3.0</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Candidate Pool:</span>
                  <span className="font-semibold text-amber-400 capitalize">{formatPlayerRole(player.role)} ({playerPool.length} Pool)</span>
                </div>
              </div>
            </div>

            {/* Right Side: Admin Decision Panel (Admin Only) + Franchise Status & Analytics Hub (Owner + Admin) */}
            <div className="lg:col-span-7 space-y-6 min-w-0">
              {/* ADMIN DECISION CONSOLE (Only Visible to Admin) */}
              {isAdmin && (
                <div className="space-y-4 bg-card/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                  <div>
                    <h3 className="text-base sm:text-lg font-black flex flex-wrap items-center gap-2 text-foreground">
                      <Gavel className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>Auctioneer Decision Console</span>
                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px] font-black">
                        Admin Only
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Award the player to the winning franchise or pass as unsold. Real-time syncs to all devices.
                    </p>
                  </div>

                  {/* Step 1: Select Winning Team */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex flex-wrap items-center justify-between gap-1">
                      <span>1. Select Winning Team</span>
                      {selectedTeam && (
                        <span className="text-amber-400 font-bold font-mono text-[11px]">
                          Purse: {formatMoney(selectedTeam.remainingPurse ?? 10000)} • Squad: {selectedTeam.players?.length || 0}/10
                        </span>
                      )}
                    </Label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {teams.map((t) => {
                        const isSelected = t.id === selectedTeamId;
                        const tSquadCount = t.players?.length || 0;
                        const tMaxSquad = t.maxSquadSize || 10;
                        const isFull = tSquadCount >= tMaxSquad;
                        const tPurse = t.remainingPurse !== undefined && tSquadCount === 0
                          ? (t.initialPurse || 10000)
                          : (t.remainingPurse ?? 10000);
                        const canAfford = tPurse >= soldAmount;

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTeamId(t.id);
                              setActiveOwnerTeamId(t.id);
                            }}
                            className={`flex flex-col items-center justify-center p-2.5 min-h-[56px] rounded-xl border text-center transition-all touch-manipulation ${
                              isSelected
                                ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400 text-amber-300 font-bold shadow-sm'
                                : isFull
                                ? 'border-white/10 bg-white/[0.01] opacity-60 text-muted-foreground'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-foreground'
                            }`}
                          >
                            <span className="text-xs font-bold truncate max-w-full">{t.name}</span>
                            <span className={`text-[10px] font-mono ${canAfford ? 'opacity-75' : 'text-destructive font-bold'}`}>
                              {formatMoney(tPurse)}
                            </span>
                            <span className={`text-[9px] ${isFull ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                              {isFull ? 'FULL (10/10)' : `${tSquadCount}/${tMaxSquad}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Final Sold Price */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      2. Final Sold Amount
                    </Label>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="relative flex-1 min-w-0">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={soldAmount}
                          onChange={(e) => setSoldAmount(Number(e.target.value) || 0)}
                          className="pl-8 text-lg font-black tracking-tight h-11 bg-white/[0.03] border-white/10 rounded-xl"
                          min={player.basePrice}
                          step={50}
                        />
                      </div>

                      {/* Quick Increments */}
                      <div className="grid grid-cols-5 sm:flex sm:flex-wrap gap-1.5">
                        {[50, 100, 250, 500, 1000].map((inc) => (
                          <Button
                            key={inc}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 px-1.5 sm:px-2.5 font-bold text-xs rounded-xl sm:flex-1 sm:min-w-[52px] touch-manipulation"
                            onClick={() => setSoldAmount((prev) => prev + inc)}
                          >
                            +{inc}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Hammer Actions */}
                  {(() => {
                    const selSquadCount = selectedTeam?.players?.length || 0;
                    const selMaxSquad = selectedTeam?.maxSquadSize || 10;
                    const isSelFull = selSquadCount >= selMaxSquad;
                    const selPurse = selectedTeam?.remainingPurse !== undefined && selSquadCount === 0
                      ? (selectedTeam.initialPurse || 10000)
                      : (selectedTeam.remainingPurse ?? 10000);
                    const canSelAfford = selPurse >= soldAmount;
                    const isHammerBlocked = isSold || isSelFull || !canSelAfford;

                    return (
                      <div className="space-y-2 pt-2">
                        {isSelFull && (
                          <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl font-bold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>⛔ Squad Full: {selectedTeam?.name} has reached max roster limit ({selSquadCount}/{selMaxSquad}).</span>
                          </div>
                        )}
                        {!canSelAfford && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-bold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>⚠️ Purse Deficit: {selectedTeam?.name} has only {formatMoney(selPurse)} left (requires {formatMoney(soldAmount)}).</span>
                          </div>
                        )}
                        {isSold && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Candidate is already marked SOLD. Click "Revert to Pending" below to refund and re-auction.</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button
                            type="button"
                            size="lg"
                            disabled={isHammerBlocked}
                            className="min-h-[48px] h-auto py-2.5 px-4 whitespace-normal text-center leading-snug bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm gap-2 rounded-xl shadow-lg disabled:opacity-50"
                            onClick={handleConfirmSale}
                          >
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>Hammer SOLD to {selectedTeam?.name} ({formatMoney(soldAmount)})</span>
                          </Button>

                          <Button
                            type="button"
                            size="lg"
                            variant="destructive"
                            className="min-h-[48px] h-auto py-2.5 font-black text-sm gap-2 rounded-xl"
                            onClick={() => onDecideUnsold(player.id)}
                          >
                            <XCircle className="w-5 h-5 shrink-0" />
                            <span>Mark UNSOLD</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Revert Option */}
                  {(isSold || isUnsold) && (
                    <div className="pt-2 border-t border-white/10 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onRevert(player.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert to Pending (Refund Team)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* OWNER FRANCHISE COMMAND & LIVE ANALYTICS HUB (Display & Analytics Only - NO BIDDING) */}
              <div className="space-y-4 bg-gradient-to-br from-card via-card/95 to-amber-950/10 border border-white/10 rounded-2xl p-5 shadow-md">
                {/* Hub Header & Franchise Selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <TeamBadge team={inspectedTeam} size="md" showName={false} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg text-foreground">
                          {inspectedTeam.name}
                        </h4>
                        {isViewerTheOwner ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] gap-1 shadow-xs">
                            <Crown className="w-3 h-3" /> YOUR FRANCHISE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold border-white/20">
                            Group {inspectedTeam.group}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Owner: <span className="font-semibold text-foreground">{inspectedTeam.ownerName || 'Designated by Admin'}</span>
                        {inspectedTeam.captainName && ` • Captain: ${inspectedTeam.captainName}`}
                      </p>
                    </div>
                  </div>

                  {/* Switch Team to inspect */}
                  {teams.length > 1 && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[11px] text-muted-foreground">Inspect:</span>
                      <select
                        value={activeOwnerTeamId}
                        onChange={(e) => setActiveOwnerTeamId(e.target.value)}
                        className="bg-white/[0.04] text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/10 text-foreground"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id} className="bg-slate-900 text-foreground">
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 1. Live Wallet & Money Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Remaining Purse */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      Wallet Purse Left
                    </span>
                    <p className="font-mono font-black text-xl text-amber-400">
                      {formatMoney(remainingPurse)}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Initial: {formatMoney(initialPurse)}
                    </span>
                  </div>

                  {/* Max Permissible Bid */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left space-y-1">
                    <span className="text-[10px] text-amber-300 uppercase font-black flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Max Safe Bid
                    </span>
                    <p className="font-mono font-black text-xl text-amber-300">
                      {formatMoney(maxSafeBid)}
                    </p>
                    <span className="text-[10px] text-amber-400/80 block">
                      Reserves ₹100/slot ({openSlots} open)
                    </span>
                  </div>

                  {/* Purse Spent */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                      <span>Purse Spent</span>
                      <span>{spentPercent}%</span>
                    </div>
                    <p className="font-mono font-black text-lg text-foreground">
                      {formatMoney(spentPurse)}
                    </p>
                    <Progress value={spentPercent} className="h-1.5" />
                  </div>

                  {/* Squad Count */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      Squad Quota
                    </span>
                    <p className="font-mono font-black text-xl text-foreground">
                      {currentSquadCount} / {maxSquadSize}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      {openSlots} Slots Open
                    </span>
                  </div>
                </div>

                {/* 1.5 LIVE AUCTION STAGE MONITOR (SPECTATORS & NON-ADMIN VIEWERS) */}
                {!isAdmin && player && (
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="font-black text-xs sm:text-sm text-foreground uppercase tracking-wider">
                          Live Stage Monitor
                        </span>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black self-start sm:self-auto">
                        Live Feed Sync
                      </Badge>
                    </div>

                    {highestBidderTeamId ? (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                            Current Highest Bid
                          </span>
                          <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                            {formatMoney(currentBid || player.basePrice || 100)}
                          </span>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-amber-500 text-slate-950 font-black text-xs gap-1.5 px-2.5 py-1">
                            <Crown className="w-3.5 h-3.5" />
                            {teams.find((t) => t.id === highestBidderTeamId)?.name || 'Franchise'}
                          </Badge>
                          <span className="text-[10px] text-emerald-400 font-bold block mt-1">
                            Leading Bidder
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            Opening Base Price
                          </span>
                          <span className="text-lg font-black font-mono text-foreground">
                            {formatMoney(player.basePrice || 100)}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                          <Gavel className="w-3.5 h-3.5 animate-pulse" />
                          {isSold ? 'Auction Concluded' : isUnsold ? 'Candidate Passed' : 'Awaiting Auctioneer Call'}
                        </span>
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/15 text-[11px] text-muted-foreground flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        The live auction is conducted exclusively by the Administrator. Real-time bids, sales, and franchise purses update automatically on your screen.
                      </span>
                    </div>
                  </div>
                )}

                {/* Role Balance & Keeper Alert */}
                {currentSquadCount > 0 && keepersCount === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>
                      <strong>Role Alert:</strong> {inspectedTeam.name} has drafted {currentSquadCount} player(s) but has 0 specialist Wicket-Keepers. Ensure at least 1 keeper is acquired before the auction concludes!
                    </span>
                  </div>
                )}

                {/* 2. Team Analytics & Squad Composition Breakdown */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      📊 Team Composition Analytics
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Target: Balance across Batters, Bowlers & All-rounders
                    </span>
                  </div>

                  {/* Role composition chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🏏 Batters</span>
                      <span className="font-black text-sm text-foreground">{battersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">⚡ Bowlers</span>
                      <span className="font-black text-sm text-foreground">{bowlersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">👑 All-Round</span>
                      <span className="font-black text-sm text-foreground">{allRoundersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🧤 Keepers</span>
                      <span className="font-black text-sm text-foreground">{keepersCount}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Players Acquired by this Franchise */}
                <div className="pt-2 border-t border-white/10 text-xs space-y-2">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Acquired Players ({squadPlayers.length}):</span>
                    <span className="text-[10px] text-muted-foreground">Signed from auction</span>
                  </span>
                  {squadPlayers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic text-center py-2 bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                      No players drafted yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {squadPlayers.map((p: any, idx: number) => (
                        <span
                          key={p.id || idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-[11px] font-medium border border-white/10"
                        >
                          <span className="font-bold text-foreground">{p.name}</span>
                          {p.soldPrice && (
                            <span className="text-[10px] text-amber-400 font-mono font-bold">{formatMoney(p.soldPrice)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. UPCOMING CANDIDATES QUEUE (WHO ARE COMING NEXT) */}
      {upcomingCandidates.length > 0 && (
        <Card className="border border-white/10 bg-card/85 backdrop-blur-md p-4 rounded-3xl shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                On Deck • Next Up in Auction
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                Next {upcomingCandidates.length} Pending
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Upcoming candidates queued for the live hammer
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {upcomingCandidates.map((c, idx) => (
              <div
                key={c.id}
                className="p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col justify-between space-y-2 relative"
              >
                <Badge
                  variant="outline"
                  className="absolute top-2 right-2 text-[9px] font-mono text-muted-foreground border-white/15 px-1.5 py-0"
                >
                  +{idx + 1}
                </Badge>

                <div className="flex items-center gap-2">
                  <Avatar className="w-9 h-9 border border-white/10">
                    <AvatarImage src={c.photoUrl || undefined} alt={c.name} />
                    <AvatarFallback className="bg-amber-500/10 text-amber-400 text-xs font-bold">
                      {(c.name || 'P').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize block truncate">
                      {formatPlayerRole(c.role)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                  <span className="text-muted-foreground text-[10px]">Base:</span>
                  <span className="font-mono font-black text-amber-400 text-xs">{formatMoney(c.basePrice)}</span>
                </div>

                {isAdmin && onSpotlightPlayer && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSpotlightPlayer(c)}
                    className="h-7 text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 p-0 w-full mt-1"
                  >
                    Spotlight Now
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. ALL FRANCHISE PURSES, QUOTAS & ACQUIRED PLAYERS (WHAT OTHER TEAMS HAVE & WHO WAS SOLD TO WHO) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
            <span>All Franchise Purses, Quotas & Acquired Rosters</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teams.map((t) => {
            const isCurrentInspected = t.id === inspectedTeam.id;
            const isUserOwner = Boolean(t.ownerEmail && cleanUserEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail);
            const tSquadCount = t.players?.length || 0;
            const tRemaining = t.remainingPurse !== undefined && t.remainingPurse !== null
              ? (tSquadCount === 0 ? 10000 : t.remainingPurse)
              : 10000;
            const tMaxSquad = t.maxSquadSize || 10;
            const teamSquadList = t.players || [];

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveOwnerTeamId(t.id);
                  if (isAdmin) setSelectedTeamId(t.id);
                }}
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                  isCurrentInspected
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/15'
                    : 'border-white/[0.08] bg-card/85 backdrop-blur-md hover:bg-white/[0.06] hover:border-white/20'
                }`}
              >
                {/* User Owner Marker */}
                {isUserOwner && (
                  <Badge variant="gold" className="absolute -top-2.5 right-2 text-[9px] font-black px-2 py-0.5 tracking-wider">
                    👑 MY FRANCHISE
                  </Badge>
                )}

                <div className="flex items-center gap-2.5 mb-2">
                  <TeamBadge team={t} size="sm" showName={false} />
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs truncate text-foreground">{t.name}</h5>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {t.ownerName ? `Owner: ${t.ownerName}` : 'No Owner'}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Purse Left</span>
                    <span className="font-mono font-black text-sm text-amber-400">
                      {formatMoney(tRemaining)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Squad</span>
                    <span className="text-xs text-foreground font-black">
                      {tSquadCount} / {tMaxSquad}
                    </span>
                  </div>
                </div>

                {/* Acquired Players Summary */}
                <div className="mt-2 pt-2 border-t border-white/5 text-[10px]">
                  <span className="text-muted-foreground block mb-1">
                    Players Signed ({teamSquadList.length}):
                  </span>
                  {teamSquadList.length === 0 ? (
                    <span className="text-muted-foreground italic text-[10px]">None signed yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden">
                      {teamSquadList.slice(0, 3).map((p: any, idx: number) => (
                        <span key={p.id || idx} className="bg-white/[0.04] px-1.5 py-0.5 rounded text-[10px] font-medium border border-white/5 truncate max-w-[120px]">
                          {p.name} ({formatMoney(p.soldPrice || 100)})
                        </span>
                      ))}
                      {teamSquadList.length > 3 && (
                        <span className="text-muted-foreground font-mono">+{teamSquadList.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. REAL-TIME LIVE AUCTION SALES LEDGER */}
      {salesHistory.length > 0 && (
        <Card className="border border-white/10 bg-card/85 backdrop-blur-md p-4 rounded-3xl shadow-md">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Auction Ledger • Completed Sales
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ● Live Realtime Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {salesHistory.slice(0, 6).map((log, idx) => (
              <div
                key={log?.id || `stage-log-${idx}`}
                className="p-2.5 rounded-xl border border-white/5 bg-background/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-foreground block text-xs">{log.playerName}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {formatPlayerRole(log.playerRole)} • {log.status === 'sold' ? <strong className="text-foreground">{log.teamName}</strong> : 'Unsold'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xs text-emerald-400 block">{formatMoney(log.amount)}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. PROJECTOR / BIG SCREEN TV MODE (FOR STADIUM & HALL SCREENS) */}
      {isProjectorMode && (
        <div className="fixed inset-0 z-50 h-[100dvh] bg-slate-950/98 backdrop-blur-2xl flex flex-col p-3 sm:p-4 md:p-8 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Tv className="w-6 h-6 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl md:text-2xl font-black text-foreground tracking-tight flex flex-wrap items-center gap-x-2">
                  KAPL 3.0 AUCTION <span className="text-amber-400">• STADIUM STAGE</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  High-contrast live display for LED screens and hall projectors
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProjectorMode(false)}
              className="min-h-[44px] sm:min-h-9 font-bold border-white/20 text-foreground hover:bg-white/10 gap-1.5"
            >
              <Minimize2 className="w-4 h-4" /> Exit TV Mode
            </Button>
          </div>

          {/* Huge Main Stage Display */}
          <div className="flex-1 flex flex-col items-center justify-center my-4 sm:my-6 max-w-5xl mx-auto w-full text-center space-y-5 sm:space-y-6">
            {/* Status Pill */}
            {isSold && assignedTeam ? (
              <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white p-3.5 sm:p-4 rounded-3xl font-black text-lg sm:text-2xl md:text-4xl shadow-2xl flex items-center justify-center gap-2 sm:gap-3 animate-bounce">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-300 shrink-0" />
                <span>SOLD TO {assignedTeam.name.toUpperCase()} FOR {formatMoney(player.soldPrice || player.basePrice)}!</span>
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-300 shrink-0" />
              </div>
            ) : isUnsold ? (
              <div className="w-full bg-destructive text-destructive-foreground p-3 rounded-2xl font-black text-xl md:text-2xl shadow-lg">
                ❌ CANDIDATE MARKED UNSOLD
              </div>
            ) : (
              <Badge className="bg-amber-500 text-slate-950 font-black text-base px-6 py-1.5 rounded-full shadow-lg">
                ● LIVE STAGE SPOTLIGHT
              </Badge>
            )}

            {/* Giant Avatar & Identity */}
            <div className="relative">
              <Avatar className="w-48 h-48 md:w-60 md:h-60 border-4 border-amber-400 shadow-2xl rounded-full">
                <AvatarImage src={player.photoUrl || undefined} alt={player.name} className="object-cover" />
                <AvatarFallback className="bg-amber-500/20 text-amber-400 text-6xl font-black">
                  {(player.name || 'P').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {player.jerseyNumber && (
                <Badge className="absolute bottom-2 right-4 bg-slate-950 border-2 border-amber-400 text-amber-300 font-mono text-base font-black px-3 py-1 rounded-full">
                  #{player.jerseyNumber}
                </Badge>
              )}
            </div>

            <div>
              <div className="mb-2">{getRoleBadge(player.role)}</div>
              <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">
                {player.name}
              </h1>
              <div className="flex items-center justify-center gap-4 text-sm md:text-base text-muted-foreground mt-2">
                {player.battingStyle && <span>🏏 {player.battingStyle}</span>}
                {player.bowlingStyle && <span>⚡ {player.bowlingStyle}</span>}
              </div>
            </div>

            {/* Giant Base Price Box */}
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-6 px-6 sm:px-12 shadow-2xl max-w-full">
              <span className="text-xs md:text-sm text-amber-400 uppercase font-black tracking-widest block mb-1">
                Official Base Value
              </span>
              <span className="text-4xl md:text-6xl font-black text-amber-400 font-mono">
                {formatMoney(player.basePrice)}
              </span>
            </div>
          </div>

          {/* Bottom Live Team Purses Ribbon */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-[11px] text-muted-foreground uppercase font-black tracking-wider mb-2.5 text-center">
              Franchise Wallet Balances & Squad Quotas
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {teams.map((t) => {
                const squadCount = t.players?.length || 0;
                const purse = t.remainingPurse !== undefined && squadCount === 0
                  ? (t.initialPurse || 10000)
                  : (t.remainingPurse ?? 10000);
                return (
                  <div key={t.id} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-center">
                    <p className="text-xs font-bold truncate text-foreground">{t.name}</p>
                    <p className="text-sm font-mono font-black text-amber-400 mt-0.5">{formatMoney(purse)}</p>
                    <p className="text-[10px] text-muted-foreground">{squadCount}/10 Squad</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
