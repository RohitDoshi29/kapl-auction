import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTournament } from '@/contexts/TournamentContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/cricket/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Wallet, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Team, PlayerRecord } from '@/lib/cricketTypes';

interface TeamData extends Team {
  players: PlayerRecord[];
}

export default function OwnerTeamAnalysis() {
  const { isOwner, user, profile } = useAuth();
  const { activeTournamentId } = useTournament();
  const navigate = useNavigate();

  const [team, setTeam] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
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
      fetchTeamData();
    }
  }, [isOwner, activeTournamentId, user]);

  const fetchTeamData = async () => {
    if (!activeTournamentId || !user?.email) return;

    try {
      setIsLoading(true);

      // Fetch team where owner email matches
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', activeTournamentId)
        .eq('owner_email', user.email)
        .single();

      if (teamError) throw teamError;
      if (!teamData) {
        toast.info('No team assigned to your account');
        setTeam(null);
        return;
      }

      // Fetch team players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamData.id)
        .eq('tournament_id', activeTournamentId);

      if (playersError) throw playersError;

      const teamWithPlayers: TeamData = {
        ...teamData,
        players: playersData || [],
      };

      setTeam(teamWithPlayers);
      calculateStats(teamWithPlayers);
    } catch (err) {
      console.error('Error fetching team data:', err);
      toast.error('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (teamData: TeamData) => {
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
    setStats(stats);
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-black text-foreground">Team Analysis</h1>
              <p className="text-sm text-muted-foreground mt-1">Detailed team and player information</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading team data...</div>
        ) : !team ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-8 text-center space-y-3">
              <p className="text-muted-foreground">No team assigned to your account yet</p>
              <Button onClick={() => navigate('/')}>Go to Auction</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Team Header Card */}
            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{team.name}</CardTitle>
                    <CardDescription>
                      Owner: {team.owner_name || profile?.name || 'You'}
                    </CardDescription>
                  </div>
                  <Badge className="bg-amber-500 text-black">
                    {team.group && `Group ${team.group}`}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Squad Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalPlayers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.soldPlayers} sold • {stats.totalPlayers - stats.soldPlayers} pending
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
                  <div className="text-3xl font-bold">₹{stats.totalValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average: ₹{Math.round(stats.totalValue / Math.max(stats.totalPlayers, 1))}
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
                    ₹{((team.initial_purse || 10000) - stats.totalValue).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    of ₹{(team.initial_purse || 10000).toLocaleString()} budget
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
                      (stats.totalValue / (team.initial_purse || 10000)) * 100
                    )}%
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (stats.totalValue / (team.initial_purse || 10000)) * 100,
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
                  <div className="text-2xl font-bold text-blue-400">{stats.batters}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bowlers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">{stats.bowlers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">All-Rounders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-400">{stats.allRounders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Wicket Keepers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-400">{stats.wicketKeepers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">{stats.soldPlayers}</div>
                </CardContent>
              </Card>
            </div>

            {/* Players List */}
            <Card>
              <CardHeader>
                <CardTitle>Squad Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Base Price</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Sold Price</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.players.map((player) => (
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
          </>
        )}
      </main>
    </div>
  );
}
