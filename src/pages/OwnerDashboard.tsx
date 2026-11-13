import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament } from '@/contexts/TournamentContext';
import { useAuction } from '@/hooks/useAuction';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/cricket/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Wallet, Target, TrendingUp, Crown, BarChart3, Activity, Zap, PieChart, Radio, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SinglePlayerAuctionStage } from '@/components/auction/SinglePlayerAuctionStage';
import { CategoryPlayerGrid } from '@/components/auction/CategoryPlayerGrid';

interface TeamData {
  id: string;
  name: string;
  logo?: string | null;
  group?: string;
  initialPurse?: number;
  initial_purse?: number;
  remainingPurse?: number;
  remaining_purse?: number;
  ownerName?: string;
  owner_name?: string;
  ownerEmail?: string | null;
  owner_email?: string | null;
  players: any[];
}

interface TeamStats {
  teamId: string;
  teamName: string;
  ownerName: string;
  totalPlayers: number;
  soldPlayers: number;
  totalSpent: number;
  remainingPurse: number;
  initialPurse: number;
}

export default function OwnerDashboard() {
  const { isOwner, user, profile } = useAuth();
  const { activeTournamentId } = useTournament();
  const navigate = useNavigate();
  const {
    currentPlayer,
    teams: auctionTeams,
    salesHistory,
    playerPool,
    selectedCategory,
    setSelectedCategory,
    spotlightPlayer,
    nextPlayer,
    placeBid,
    adminDecideSold,
    adminDecideUnsold,
    revertPlayerStatus,
    auctionState,
  } = useAuction(activeTournamentId || 'kapl-3-mens');

  const [myTeam, setMyTeam] = useState<TeamData | null>(null);
  const [otherTeams, setOtherTeams] = useState<TeamStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myStats, setMyStats] = useState({
    totalPlayers: 0,
    batters: 0,
    bowlers: 0,
    allRounders: 0,
    wicketKeepers: 0,
    totalValue: 0,
    soldPlayers: 0,
  });

  useEffect(() => {
    if (!isOwner) {
      navigate('/');
      toast.error('Only owners can access this page');
    } else {
      fetchDashboardData();
    }
  }, [isOwner, activeTournamentId, user, playerPool]);

  const fetchDashboardData = async () => {
    if (!activeTournamentId || !user?.email) return;

    try {
      setIsLoading(true);
      const cleanEmail = user.email.toLowerCase().trim();

      // Fetch all teams for this tournament
      const { data: allTeamsData, error: allTeamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', activeTournamentId);

      const myTeamData = (allTeamsData || []).find(
        (t) => (t.owner_email && t.owner_email.toLowerCase().trim() === cleanEmail) || t.owner_user_id === user.id
      ) || null;

      if (myTeamData) {
        // Fetch my team's players using granted safe columns
        const { data: myPlayersData } = await supabase
          .from('players')
          .select('id, name, photo_url, role, batting_style, bowling_style, tournament_id, team_id, jersey_number, base_price, sold_price, auction_status, created_at, updated_at')
          .eq('team_id', myTeamData.id)
          .eq('tournament_id', activeTournamentId);

        // Merge in-memory sold players from playerPool
        const poolSold = (playerPool || []).filter(
          (p) => p.teamId === myTeamData.id && p.auctionStatus === 'sold'
        );
        const combined = [...(myPlayersData || [])];
        poolSold.forEach((p) => {
          if (!combined.some((cp) => cp.id === p.id)) {
            combined.push({
              id: p.id,
              name: p.name,
              photo_url: p.photoUrl || null,
              role: p.role,
              batting_style: p.battingStyle || null,
              bowling_style: p.bowlingStyle || null,
              tournament_id: p.tournamentId || activeTournamentId,
              team_id: myTeamData.id,
              jersey_number: p.jerseyNumber || null,
              base_price: p.basePrice || 100,
              sold_price: p.soldPrice || p.basePrice || 100,
              auction_status: 'sold',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any);
          }
        });

        const teamWithPlayers: TeamData = {
          ...myTeamData,
          players: combined,
        };

        setMyTeam(teamWithPlayers);
        calculateMyStats(teamWithPlayers);
      }

      if (!allTeamsError && allTeamsData) {
        // Fetch player counts and spending for each team
        const teamsStatsPromises = allTeamsData.map(async (team) => {
          const { data: players } = await supabase
            .from('players')
            .select('id, name, photo_url, role, base_price, sold_price, auction_status, team_id')
            .eq('team_id', team.id)
            .eq('tournament_id', activeTournamentId);

          const playerList = players || [];
          const totalSpent = playerList.reduce(
            (sum, p: any) => sum + (p.sold_price || p.soldPrice || p.base_price || p.basePrice || 0),
            0
          );
          const soldPlayers = playerList.filter((p: any) => p.auction_status === 'sold' || p.auctionStatus === 'sold').length;

          return {
            teamId: team.id,
            teamName: team.name,
            ownerName: team.owner_name || 'TBD',
            totalPlayers: playerList.length,
            soldPlayers,
            totalSpent,
            remainingPurse: (team.initial_purse || (team as any).initialPurse || 10000) - totalSpent,
            initialPurse: team.initial_purse || (team as any).initialPurse || 10000,
          };
        });

        const allTeamsStats = await Promise.all(teamsStatsPromises);
        // Filter out my team and sort by spending
        const otherTeamsStats = allTeamsStats
          .filter((t) => !myTeamData || t.teamId !== myTeamData.id)
          .sort((a, b) => b.totalSpent - a.totalSpent);

        setOtherTeams(otherTeamsStats);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMyStats = (teamData: TeamData) => {
    const players = teamData.players || [];
    const stats = {
      totalPlayers: players.length,
      batters: players.filter((p) => p.role === 'batter').length,
      bowlers: players.filter((p) => p.role === 'bowler').length,
      allRounders: players.filter((p) => p.role === 'all_rounder').length,
      wicketKeepers: players.filter((p) => p.role === 'wicket_keeper').length,
      totalValue: players.reduce((sum, p) => sum + (p.sold_price || p.soldPrice || p.base_price || p.basePrice || 0), 0),
      soldPlayers: players.filter((p) => p.auction_status === 'sold' || p.auctionStatus === 'sold').length,
    };
    setMyStats(stats);
  };

  if (!isOwner) {
    return null;
  }

  const myTeamInitialPurse = myTeam ? (myTeam.initialPurse || myTeam.initial_purse || 10000) : 10000;
  const myTeamRemainingPurse = Math.max(0, myTeamInitialPurse - myStats.totalValue);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-foreground">Owner Command Center</h1>
                {myTeam && <Badge className="bg-amber-500 text-slate-950 font-black">{myTeam.name}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bid on live auction players, manage your franchise squad, and monitor competitor purse limits
              </p>
            </div>
          </div>

          {/* Quick Wallet Pill */}
          {myTeam && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>Wallet: ₹{myTeamRemainingPurse.toLocaleString()}</span>
              <span className="text-muted-foreground">• Squad: {myStats.totalPlayers}/10</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading franchise dashboard...</div>
        ) : !myTeam ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-8 text-center space-y-3">
              <p className="text-muted-foreground">No franchise team is currently assigned to {user?.email}.</p>
              <p className="text-xs text-muted-foreground">Please request the tournament admin to assign an owner email to your franchise in Admin Settings.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="spotlight" className="w-full space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4 h-auto p-1.5 bg-card/80 backdrop-blur-md border border-white/10 rounded-2xl gap-1">
              <TabsTrigger value="spotlight" className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 touch-manipulation">
                <Radio className="w-3.5 h-3.5" />
                <span>Live Stage</span>
              </TabsTrigger>
              <TabsTrigger value="players" className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 touch-manipulation">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Player Pool</span>
              </TabsTrigger>
              <TabsTrigger value="my-team" className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 touch-manipulation">
                <Crown className="w-3.5 h-3.5" />
                <span>My Squad ({myStats.totalPlayers})</span>
              </TabsTrigger>
              <TabsTrigger value="competition" className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 touch-manipulation">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Competitors</span>
              </TabsTrigger>
            </TabsList>

            {/* 1. SPOTLIGHT / LIVE AUCTION STAGE TAB */}
            <TabsContent value="spotlight" className="space-y-6">
              {currentPlayer ? (
                <SinglePlayerAuctionStage
                  player={currentPlayer}
                  playerPool={playerPool}
                  teams={auctionTeams}
                  isAdmin={profile?.role === 'admin' || profile?.role === 'super_admin'}
                  tournamentId={activeTournamentId}
                  onNext={() => nextPlayer('next')}
                  onPrev={() => nextPlayer('prev')}
                  onSpotlightPlayer={spotlightPlayer}
                  onPlaceBid={placeBid}
                  currentBid={auctionState?.currentBid}
                  highestBidderTeamId={auctionState?.highestBidderTeamId}
                  onDecideSold={adminDecideSold}
                  onDecideUnsold={adminDecideUnsold}
                  onRevert={revertPlayerStatus}
                  salesHistory={salesHistory}
                />
              ) : (
                <Card className="border border-white/10 p-8 text-center bg-card/60 rounded-3xl shadow-xl">
                  <CardContent className="space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                      <Radio className="w-8 h-8 animate-pulse" />
                    </div>
                    <p className="font-bold text-lg text-foreground">Waiting for Auction Spotlight</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      No candidate is currently on the stage. Switch to the Player Pool tab to browse registered candidates and spotlight one.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 2. PLAYERS / CATEGORIES POOL TAB */}
            <TabsContent value="players" className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/10 bg-card/85 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">Auction Player Pool</h3>
                    <p className="text-xs text-muted-foreground">Browse all registered players, filter by role, and click any player to spotlight</p>
                  </div>
                </div>
                <Badge className="bg-blue-500/20 text-blue-300 font-mono text-xs px-2.5 py-1">
                  {playerPool?.length || 0} Registered Candidates
                </Badge>
              </div>

              <CategoryPlayerGrid
                players={playerPool}
                teams={auctionTeams}
                selectedCategory={selectedCategory}
                selectedPlayerId={currentPlayer?.id}
                onSelectCategory={setSelectedCategory}
                onSelectPlayer={(p) => {
                  spotlightPlayer(p);
                  toast.success(`Spotlighted ${p.name} on the auction stage`);
                }}
              />
            </TabsContent>

            {/* 3. MY TEAM FRANCHISE SQUAD TAB */}
            <TabsContent value="my-team" className="space-y-6">
              {/* My Team Header Card */}
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black">{myTeam.name}</CardTitle>
                      <CardDescription>Your Official KAPL 3.0 Franchise Squad</CardDescription>
                    </div>
                    {myTeam.group && (
                      <Badge className="bg-amber-500 text-black font-bold">Group {myTeam.group}</Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* My Team Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Squad Size
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{myStats.totalPlayers} / 10</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {10 - myStats.totalPlayers} Open Draft Slots Left
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-amber-400" />
                      Total Spent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">₹{myStats.totalValue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average: ₹{Math.round(myStats.totalValue / Math.max(myStats.totalPlayers, 1))}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      Remaining Purse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-400">
                      ₹{myTeamRemainingPurse.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of ₹{myTeamInitialPurse.toLocaleString()} total budget
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      Budget Utilization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {Math.round((myStats.totalValue / myTeamInitialPurse) * 100)}%
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((myStats.totalValue / myTeamInitialPurse) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Player Composition Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">🏏 Batters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-400">{myStats.batters}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">⚡ Bowlers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-400">{myStats.bowlers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">👑 All-Rounders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-400">{myStats.allRounders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">🧤 Wicket Keepers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-400">{myStats.wicketKeepers}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Acquired Players Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Drafted Roster ({myTeam.players.length})</CardTitle>
                      <CardDescription>Players acquired by your franchise</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {myTeam.players.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground space-y-2">
                      <p className="font-semibold text-foreground">No players drafted yet</p>
                      <p className="text-xs">Head to the Live Stage tab during the auction to place bids and acquire candidates for your team.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Player</th>
                            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Base Price</th>
                            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Sold Price</th>
                            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myTeam.players.map((player) => (
                            <tr key={player.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-medium">{player.name}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="capitalize">
                                  {player.role?.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">₹{(player.basePrice || player.base_price || 100).toLocaleString()}</td>
                              <td className="py-3 px-4 font-mono font-bold text-amber-400">
                                {player.soldPrice || player.sold_price ? `₹${(player.soldPrice || player.sold_price).toLocaleString()}` : '-'}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className="bg-green-500/20 text-green-300 font-bold">
                                  SOLD
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. COMPETITORS ANALYSIS TAB */}
            <TabsContent value="competition" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Franchise Spending & Competitor Intelligence
                  </CardTitle>
                  <CardDescription>Real-time squad count and remaining purse across all rival teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Franchise</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Owner</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Squad</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Total Spent</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Remaining Purse</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Spending %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherTeams.map((team) => {
                          const spendingPercent = Math.round(
                            (team.totalSpent / team.initialPurse) * 100
                          );
                          return (
                            <tr key={team.teamId} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-medium">{team.teamName}</td>
                              <td className="py-3 px-4 text-muted-foreground">{team.ownerName}</td>
                              <td className="py-3 px-4">
                                {team.soldPlayers}/{team.totalPlayers || 10}
                              </td>
                              <td className="py-3 px-4 font-semibold">
                                ₹{team.totalSpent.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-emerald-400 font-mono font-bold">
                                ₹{team.remainingPurse.toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-amber-400">
                                    {spendingPercent}%
                                  </span>
                                  <div className="w-16 bg-white/10 rounded-full h-2">
                                    <div
                                      className="bg-amber-500 h-2 rounded-full"
                                      style={{ width: `${Math.min(spendingPercent, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
