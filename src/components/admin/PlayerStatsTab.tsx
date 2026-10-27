import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface AggregatedPlayerStats {
  playerId: string;
  playerName: string;
  playerPhoto: string | null;
  teamId: string;
  teamName: string;
  teamColor: string;
  matchesPlayed: number;
  // Batting
  runsScored: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  timesOut: number;
  // Bowling
  oversBowled: number;
  ballsBowled: number;
  runsGiven: number;
  wicketsTaken: number;
  wides: number;
  noBalls: number;
}

export default function PlayerStatsTab() {
  const { teams, matchHistory } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();

  const tournamentTeams = teams.filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  const tournamentMatches = matchHistory.filter(m => (m.tournamentId || 'kapl-3-mens') === activeTournamentId);

  // Aggregate stats for all players across active tournament matches
  const playerStatsMap = new Map<string, AggregatedPlayerStats>();

  // Initialize tournament players
  tournamentTeams.forEach(team => {
    team.players.forEach(player => {
      playerStatsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        playerPhoto: player.photo,
        teamId: team.id,
        teamName: team.name,
        teamColor: team.primaryColor,
        matchesPlayed: 0,
        runsScored: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        timesOut: 0,
        oversBowled: 0,
        ballsBowled: 0,
        runsGiven: 0,
        wicketsTaken: 0,
        wides: 0,
        noBalls: 0,
      });
    });
  });

  // Track matches played per player
  const matchesPlayedSet = new Map<string, Set<string>>();

  // Process all completed matches for this tournament
  tournamentMatches.filter(m => m.status === 'completed').forEach(match => {
    const innings = [match.innings1, match.innings2].filter(Boolean);

    innings.forEach(inning => {
      if (!inning) return;

      // Process batting stats
      Object.entries(inning.batterStats || {}).forEach(([playerId, stats]) => {
        const playerStats = playerStatsMap.get(playerId);
        if (playerStats && stats) {
          playerStats.runsScored += stats.runs || 0;
          playerStats.ballsFaced += stats.ballsFaced || 0;
          playerStats.fours += stats.fours || 0;
          playerStats.sixes += stats.sixes || 0;
          if (stats.isOut) playerStats.timesOut += 1;

          // Track match participation
          if (!matchesPlayedSet.has(playerId)) {
            matchesPlayedSet.set(playerId, new Set());
          }
          matchesPlayedSet.get(playerId)!.add(match.id);
        }
      });

      // Process bowling stats
      Object.entries(inning.bowlerStats || {}).forEach(([playerId, stats]) => {
        const playerStats = playerStatsMap.get(playerId);
        if (playerStats && stats) {
          playerStats.oversBowled += stats.overs || 0;
          playerStats.ballsBowled += stats.balls || 0;
          playerStats.runsGiven += stats.runs || 0;
          playerStats.wicketsTaken += stats.wickets || 0;
          playerStats.wides += stats.wides || 0;
          playerStats.noBalls += stats.noBalls || 0;

          // Track match participation
          if (!matchesPlayedSet.has(playerId)) {
            matchesPlayedSet.set(playerId, new Set());
          }
          matchesPlayedSet.get(playerId)!.add(match.id);
        }
      });
    });
  });

  // Update matches played count
  matchesPlayedSet.forEach((matches, playerId) => {
    const playerStats = playerStatsMap.get(playerId);
    if (playerStats) {
      playerStats.matchesPlayed = matches.size;
    }
  });

  // Convert to array and filter players with at least 1 match
  const allPlayers = Array.from(playerStatsMap.values())
    .filter(p => p.matchesPlayed > 0)
    .sort((a, b) => b.runsScored - a.runsScored);

  const formatOvers = (overs: number, balls: number) => {
    return `${overs}.${balls}`;
  };

  const getBattingAverage = (runs: number, timesOut: number) => {
    if (timesOut === 0) return runs > 0 ? '∞' : '-';
    return (runs / timesOut).toFixed(1);
  };

  const getStrikeRate = (runs: number, balls: number) => {
    if (balls === 0) return '-';
    return ((runs / balls) * 100).toFixed(1);
  };

  const getBowlingEconomy = (runs: number, overs: number, balls: number) => {
    const totalOvers = overs + balls / 6;
    if (totalOvers === 0) return '-';
    return (runs / totalOvers).toFixed(2);
  };

  const getBowlingAverage = (runs: number, wickets: number) => {
    if (wickets === 0) return runs > 0 ? '-' : '-';
    return (runs / wickets).toFixed(1);
  };

  if (allPlayers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Player Statistics Yet</h3>
            <p className="text-muted-foreground">Complete some matches to see player statistics here</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground">
            {currentTournament?.name || "Tournament"} Player Leaderboards
          </h2>
          <p className="text-xs text-muted-foreground">Individual batting and bowling achievements</p>
        </div>
        <Badge variant="outline" className="text-xs font-semibold">
          {currentTournament?.gender === 'women' ? '👑 Women\'s Division' : '🏏 Men\'s Division'}
        </Badge>
      </div>

      {/* Top Run Scorers */}
      <Card>
        <CardHeader>
          <CardTitle>Batting Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Player</TableHead>
                  <TableHead className="text-xs md:text-sm hidden sm:table-cell">Team</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">M</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Runs</TableHead>
                  <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">Balls</TableHead>
                  <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">4s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">6s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Avg</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">SR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPlayers.map((player) => (
                  <TableRow key={player.playerId}>
                    <TableCell className="text-xs md:text-sm">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 md:h-10 md:w-10">
                          <AvatarImage src={player.playerPhoto || undefined} alt={player.playerName} />
                          <AvatarFallback
                            style={{ backgroundColor: `hsl(${player.teamColor})` }}
                            className="text-white font-medium text-xs"
                          >
                            {player.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium line-clamp-1">{player.playerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: `hsl(${player.teamColor})` }}
                      >
                        {player.teamName}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-xs md:text-sm font-semibold">{player.matchesPlayed}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm font-bold text-primary">{player.runsScored}</TableCell>
                    <TableCell className="text-center text-xs hidden sm:table-cell">{player.ballsFaced}</TableCell>
                    <TableCell className="text-center text-xs hidden sm:table-cell">{player.fours}</TableCell>
                    <TableCell className="text-center text-xs hidden sm:table-cell">{player.sixes}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm font-semibold">{getBattingAverage(player.runsScored, player.timesOut)}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm font-semibold">{getStrikeRate(player.runsScored, player.ballsFaced)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bowling Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Bowling Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Player</TableHead>
                  <TableHead className="text-xs md:text-sm hidden sm:table-cell">Team</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">M</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Overs</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Runs</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Wkts</TableHead>
                  <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">Wides</TableHead>
                  <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">NB</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Avg</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Econ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPlayers
                  .filter(p => p.oversBowled > 0 || p.ballsBowled > 0)
                  .sort((a, b) => b.wicketsTaken - a.wicketsTaken)
                  .map((player) => (
                    <TableRow key={player.playerId}>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 md:h-10 md:w-10">
                            <AvatarImage src={player.playerPhoto || undefined} alt={player.playerName} />
                            <AvatarFallback
                              style={{ backgroundColor: `hsl(${player.teamColor})` }}
                              className="text-white font-medium text-xs"
                            >
                              {player.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium line-clamp-1">{player.playerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: `hsl(${player.teamColor})` }}
                        >
                          {player.teamName}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm font-semibold">{player.matchesPlayed}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{formatOvers(player.oversBowled, player.ballsBowled)}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{player.runsGiven}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm font-bold text-primary">{player.wicketsTaken}</TableCell>
                      <TableCell className="text-center text-xs hidden sm:table-cell">{player.wides}</TableCell>
                      <TableCell className="text-center text-xs hidden sm:table-cell">{player.noBalls}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm font-semibold">{getBowlingAverage(player.runsGiven, player.wicketsTaken)}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm font-semibold">{getBowlingEconomy(player.runsGiven, player.oversBowled, player.ballsBowled)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
