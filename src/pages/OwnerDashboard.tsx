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
import { Users, Wallet, Target, TrendingUp, Crown, BarChart3, Activity, Zap, PieChart, Radio, Gavel, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Team, PlayerRecord } from '@/lib/cricketTypes';
import { SinglePlayerAuctionStage } from '@/components/auction/SinglePlayerAuctionStage';
import { CategoryPlayerGrid } from '@/components/auction/CategoryPlayerGrid';

interface TeamData extends Team {
  players: PlayerRecord[];
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
  const { currentPlayer, teams: auctionTeams, salesHistory, playerPool, selectedCategory, setSelectedCategory } = useAuction(activeTournamentId || 'kapl-3-mens');

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
  }, [isOwner, activeTournamentId, user]);

  const fetchDashboardData = async () => {
    if (!activeTournamentId || !user?.email) return;

    try {
      setIsLoading(true);

      // Fetch my team
      const { data: myTeamData, error: myTeamError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', activeTournamentId)
        .eq('owner_email', user.email)
        .single();

      if (!myTeamError && myTeamData) {
        // Fetch my team's players
        const { data: myPlayersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', myTeamData.id)
          .eq('tournament_id', activeTournamentId);

        const teamWithPlayers: TeamData = {
          ...myTeamData,
          players: myPlayersData || [],
        };

        setMyTeam(teamWithPlayers);
        calculateMyStats(teamWithPlayers);
      }

      // Fetch all teams for comparison
      const { data: allTeamsData, error: allTeamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', activeTournamentId);

      if (!allTeamsError && allTeamsData) {
        // Fetch player counts and spending for each team
        const teamsStatsPromises = allTeamsData.map(async (team) => {
          const { data: players } = await supabase
            .from('players')
            .select('*')
            .eq('team_id', team.id)
            .eq('tournament_id', activeTournamentId);

          const playerList = players || [];
          const totalSpent = playerList.reduce(
            (sum, p) => sum + (p.sold_price || p.base_price || 0),
            0
          );
          const soldPlayers = playerList.filter((p) => p.auction_status === 'sold').length;

          return {
            teamId: team.id,
            teamName: team.name,
            ownerName: team.owner_name || 'TBD',
            totalPlayers: playerList.length,
            soldPlayers,
            totalSpent,
            remainingPurse: (team.initial_purse || 10000) - totalSpent,
            initialPurse: team.initial_purse || 10000,
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
      totalValue: players.reduce((sum, p) => sum + (p.sold_price || p.base_price || 0), 0),
      soldPlayers: players.filter((p) => p.auction_status === 'sold').length,
    };
    setMyStats(stats);
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl p-5 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Owner Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your team and monitor competition</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>
        ) : !myTeam ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-8 text-center space-y-3">
              <p className="text-muted-foreground">No team assigned to your account yet</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="my-team" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="my-team">My Team</TabsTrigger>
              <TabsTrigger value="team-analysis">Analytics</TabsTrigger>
              <TabsTrigger value="spotlight">Spotlight</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="competition">Competitors</TabsTrigger>
            </TabsList>

            {/* MY TEAM TAB */}
            <TabsContent value="my-team" className="space-y-6">
              {/* My Team Header */}
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{myTeam.name}</CardTitle>
                      <CardDescription>Your franchise team</CardDescription>
                    </div>
                    {myTeam.group && (
                      <Badge className="bg-amber-500 text-black">Group {myTeam.group}</Badge>
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
                    <div className="text-3xl font-bold">{myStats.totalPlayers}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {myStats.soldPlayers} sold • {myStats.totalPlayers - myStats.soldPlayers} pending
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
                    <div className="text-3xl font-bold">
                      ₹{((myTeam.initial_purse || 10000) - myStats.totalValue).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of ₹{(myTeam.initial_purse || 10000).toLocaleString()} budget
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      Spending %
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {Math.round(
                        (myStats.totalValue / (myTeam.initial_purse || 10000)) * 100
                      )}%
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (myStats.totalValue / (myTeam.initial_purse || 10000)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Player Composition */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Batters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-400">{myStats.batters}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bowlers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-400">{myStats.bowlers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">All-Rounders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-400">{myStats.allRounders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wicket Keepers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-400">{myStats.wicketKeepers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sold</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-400">{myStats.soldPlayers}</div>
                  </CardContent>
                </Card>
              </div>

              {/* My Squad */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Squad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Role
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Base Price
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Sold Price
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Status
                          </th>
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
                            <td className="py-3 px-4">₹{player.base_price?.toLocaleString()}</td>
                            <td className="py-3 px-4">
                              {player.sold_price ? `₹${player.sold_price.toLocaleString()}` : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                className={
                                  player.auction_status === 'sold'
                                    ? 'bg-green-500/20 text-green-300'
                                    : player.auction_status === 'unsold'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                }
                              >
                                {player.auction_status?.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TEAM ANALYSIS TAB */}
            <TabsContent value="team-analysis" className="space-y-6">
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Detailed Team Analysis</CardTitle>
                      <CardDescription>Comprehensive insights into your squad composition and performance</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* LIVE AUCTION SECTION */}
              {currentPlayer && (
                <Card className="border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center animate-pulse">
                        <Radio className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Gavel className="w-5 h-5" />
                          Live Auction Update
                        </CardTitle>
                        <CardDescription>Currently on stage</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Current Player</p>
                          <p className="text-xl font-bold text-cyan-400">{currentPlayer.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {currentPlayer.role?.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Base Price</p>
                          <p className="text-xl font-bold text-amber-400">
                            ₹{currentPlayer.base_price?.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Category: {currentPlayer.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Status</p>
                          <Badge
                            className={
                              currentPlayer.auction_status === 'sold'
                                ? 'bg-green-500/20 text-green-300'
                                : currentPlayer.auction_status === 'unsold'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-yellow-500/20 text-yellow-300 animate-pulse'
                            }
                          >
                            {currentPlayer.auction_status?.toUpperCase() || 'ON AUCTION'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Recent Sales */}
                    {salesHistory && salesHistory.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-3">Recent Sales (Last 5)</p>
                        <div className="space-y-2">
                          {salesHistory.slice(0, 5).map((sale: any, idx: number) => (
                            <div key={idx} className="bg-white/5 rounded p-3 border border-white/10">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium text-white">{sale.player_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {sale.role?.replace('_', ' ')} • {sale.team_name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-green-400">₹{sale.sold_price?.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">Sold</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Squad Composition Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Role Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-400" />
                      Role Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Batters</span>
                          <span className="text-sm font-bold text-blue-400">{myStats.batters}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${Math.max(
                                (myStats.batters / Math.max(myStats.totalPlayers, 1)) * 100,
                                5
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Bowlers</span>
                          <span className="text-sm font-bold text-emerald-400">{myStats.bowlers}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{
                              width: `${Math.max(
                                (myStats.bowlers / Math.max(myStats.totalPlayers, 1)) * 100,
                                5
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">All-Rounders</span>
                          <span className="text-sm font-bold text-purple-400">{myStats.allRounders}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{
                              width: `${Math.max(
                                (myStats.allRounders / Math.max(myStats.totalPlayers, 1)) * 100,
                                5
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Wicket Keepers</span>
                          <span className="text-sm font-bold text-amber-400">{myStats.wicketKeepers}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{
                              width: `${Math.max(
                                (myStats.wicketKeepers / Math.max(myStats.totalPlayers, 1)) * 100,
                                5
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Investment Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-amber-400" />
                      Investment Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
                        <p className="text-2xl font-bold text-amber-400">
                          ₹{myStats.totalValue.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Average Per Player</p>
                        <p className="text-2xl font-bold text-blue-400">
                          ₹{Math.round(myStats.totalValue / Math.max(myStats.totalPlayers, 1)).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Sold Players Value</p>
                        <p className="text-2xl font-bold text-green-400">
                          ₹{(
                            (myTeam?.players?.reduce(
                              (sum, p) => sum + (p.auction_status === 'sold' ? p.sold_price || 0 : 0),
                              0
                            ) || 0)
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Average Sold Price</p>
                        <p className="text-2xl font-bold text-cyan-400">
                          ₹{(
                            myStats.soldPlayers > 0
                              ? Math.round(
                                  (myTeam?.players?.reduce(
                                    (sum, p) =>
                                      sum + (p.auction_status === 'sold' ? p.sold_price || 0 : 0),
                                    0
                                  ) || 0) / myStats.soldPlayers
                                )
                              : 0
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      Auction Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Sold</span>
                        <span className="text-xs font-bold">{myStats.soldPlayers}/{myStats.totalPlayers}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5">
                        <div
                          className="bg-green-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              (myStats.soldPlayers / Math.max(myStats.totalPlayers, 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-green-400">
                      {Math.round(
                        (myStats.soldPlayers / Math.max(myStats.totalPlayers, 1)) * 100
                      )}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Budget Utilization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Used</span>
                        <span className="text-xs font-bold">
                          {Math.round(
                            (myStats.totalValue / (myTeam?.initial_purse || 10000)) * 100
                          )}%
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5">
                        <div
                          className="bg-yellow-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              (myStats.totalValue / (myTeam?.initial_purse || 10000)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-yellow-400">
                      ₹{(myTeam?.initial_purse || 10000).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-rose-400" />
                      Remaining Budget
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-lg font-bold text-rose-400">
                      ₹{(
                        (myTeam?.initial_purse || 10000) - myStats.totalValue
                      ).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(
                        (((myTeam?.initial_purse || 10000) - myStats.totalValue) /
                          (myTeam?.initial_purse || 10000)) *
                          100
                      )}% of total budget
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Squad Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    Squad Breakdown by Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Count</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Sold</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Unsold</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Total Invested
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Avg Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { role: 'batter', label: 'Batters', color: 'text-blue-400' },
                          { role: 'bowler', label: 'Bowlers', color: 'text-emerald-400' },
                          { role: 'all_rounder', label: 'All-Rounders', color: 'text-purple-400' },
                          { role: 'wicket_keeper', label: 'Wicket Keepers', color: 'text-amber-400' },
                        ].map((roleGroup) => {
                          const rolePlayers = myTeam?.players?.filter(
                            (p) => p.role === roleGroup.role
                          ) || [];
                          const soldCount = rolePlayers.filter(
                            (p) => p.auction_status === 'sold'
                          ).length;
                          const unsoldCount = rolePlayers.length - soldCount;
                          const totalInvested = rolePlayers.reduce(
                            (sum, p) => sum + (p.sold_price || p.base_price || 0),
                            0
                          );
                          const avgPrice =
                            rolePlayers.length > 0 ? Math.round(totalInvested / rolePlayers.length) : 0;

                          return (
                            <tr key={roleGroup.role} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-medium">
                                <span className={roleGroup.color}>{roleGroup.label}</span>
                              </td>
                              <td className="py-3 px-4 font-semibold">{rolePlayers.length}</td>
                              <td className="py-3 px-4 text-green-400">{soldCount}</td>
                              <td className="py-3 px-4 text-rose-400">{unsoldCount}</td>
                              <td className="py-3 px-4 font-semibold">
                                ₹{totalInvested.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-cyan-400">₹{avgPrice.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Price Range Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Range Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        range: '₹0 - ₹500',
                        min: 0,
                        max: 500,
                        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                      },
                      {
                        range: '₹501 - ₹1000',
                        min: 501,
                        max: 1000,
                        color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                      },
                      {
                        range: '₹1001 - ₹2000',
                        min: 1001,
                        max: 2000,
                        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      },
                      {
                        range: '₹2001+',
                        min: 2001,
                        max: Infinity,
                        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                      },
                    ].map((priceRange) => {
                      const playersInRange = myTeam?.players?.filter(
                        (p) => {
                          const price = p.sold_price || p.base_price || 0;
                          return price >= priceRange.min && price <= priceRange.max;
                        }
                      ).length || 0;

                      return (
                        <div key={priceRange.range} className="flex items-center gap-4">
                          <div className="min-w-24">
                            <p className="text-sm font-semibold text-muted-foreground">{priceRange.range}</p>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/10 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${priceRange.color}`}
                                  style={{
                                    width: `${Math.max(
                                      (playersInRange / Math.max(myStats.totalPlayers, 1)) * 100,
                                      3
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className={`text-sm font-bold min-w-8 ${priceRange.color}`}>
                                {playersInRange}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tournament Auction Summary */}
              {auctionTeams && auctionTeams.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-red-400" />
                      Auction Tournament Status
                    </CardTitle>
                    <CardDescription>Overall auction progress across all teams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-xs text-muted-foreground mb-2">Total Teams</p>
                        <p className="text-3xl font-bold text-blue-400">{auctionTeams.length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-xs text-muted-foreground mb-2">Total Budget</p>
                        <p className="text-3xl font-bold text-amber-400">
                          ₹{(
                            auctionTeams.reduce((sum: number, t: any) => sum + (t.initial_purse || 0), 0)
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-xs text-muted-foreground mb-2">Teams in Auction</p>
                        <p className="text-3xl font-bold text-emerald-400">
                          {auctionTeams.filter((t: any) => (t.remaining_purse || 0) > 0).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* SPOTLIGHT (LIVE AUCTION) TAB */}
            <TabsContent value="spotlight" className="space-y-6">
              <Card className="border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center animate-pulse">
                        <Radio className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Live Auction - Spotlight</CardTitle>
                        <CardDescription>Currently on stage - Synced in real-time</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-300 animate-pulse">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                      Live
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {currentPlayer ? (
                <>
                  <Card className="border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Current Auction</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Player: <span className="text-cyan-400 font-semibold">{currentPlayer.name}</span> •
                        Role: <span className="text-blue-400 font-semibold">{currentPlayer.role?.replace('_', ' ')}</span> •
                        Base: <span className="text-amber-400 font-semibold">₹{currentPlayer.base_price?.toLocaleString()}</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <SinglePlayerAuctionStage
                    player={currentPlayer}
                    teams={auctionTeams}
                    selectedPlayerId={currentPlayer?.id}
                  />
                </>
              ) : (
                <Card>
                  <CardContent className="pt-8 text-center">
                    <p className="text-muted-foreground">No player currently on auction stage</p>
                    <p className="text-xs text-muted-foreground mt-2">Waiting for live auction to begin...</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* PLAYERS (CATEGORIES) TAB */}
            <TabsContent value="players" className="space-y-6">
              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Player Pool by Category</CardTitle>
                        <CardDescription>Browse and filter players in the auction pool</CardDescription>
                      </div>
                    </div>
                    {playerPool && playerPool.length > 0 && (
                      <Badge className="bg-blue-500/20 text-blue-300">
                        {playerPool.length} Players
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {playerPool && playerPool.length > 0 ? (
                <>
                  <Card className="border-white/10 bg-white/5">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Players</p>
                          <p className="text-2xl font-bold text-blue-400">{playerPool.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Sold</p>
                          <p className="text-2xl font-bold text-green-400">
                            {playerPool.filter((p: any) => p.auction_status === 'sold').length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Unsold</p>
                          <p className="text-2xl font-bold text-rose-400">
                            {playerPool.filter((p: any) => p.auction_status === 'unsold').length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="text-2xl font-bold text-amber-400">
                            {playerPool.filter((p: any) => !p.auction_status || p.auction_status === 'pending').length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <CategoryPlayerGrid
                    players={playerPool}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    selectedPlayerId={currentPlayer?.id}
                  />
                </>
              ) : (
                <Card>
                  <CardContent className="pt-8 text-center">
                    <p className="text-muted-foreground">No players in pool</p>
                    <p className="text-xs text-muted-foreground mt-2">Waiting for auction to load...</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* COMPETITION TAB */}
            <TabsContent value="competition" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Other Teams Analysis</CardTitle>
                  <CardDescription>Monitor competitor team composition and spending</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Team Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Owner
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Squad Size
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Total Spent
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Remaining
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Spending %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherTeams.map((team) => {
                          const spendingPercent = Math.round(
                            (team.totalSpent / team.initialPurse) * 100
                          );
                          return (
                            <tr
                              key={team.teamId}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="py-3 px-4 font-medium">{team.teamName}</td>
                              <td className="py-3 px-4 text-muted-foreground">{team.ownerName}</td>
                              <td className="py-3 px-4">
                                {team.soldPlayers}/{team.totalPlayers}
                              </td>
                              <td className="py-3 px-4 font-semibold">
                                ₹{team.totalSpent.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-emerald-400">
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
