import { useState, useEffect, useMemo } from 'react';
import { MatchFixture, Team, MATCH_TYPE_LABELS } from '@/lib/cricketTypes';
import { getStoredFixtures, resetToDefaultFixtures, fetchTournamentFixtures } from '@/lib/fixturesData';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TeamBadge } from './TeamBadge';
import { Calendar, Clock, MapPin, Play, Trophy, RotateCcw, Radio, CheckCircle2, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MatchFixturesCalendarProps {
  onSelectFixtureForScoring?: (fixture: MatchFixture) => void;
  isAdminView?: boolean;
  className?: string;
}

export function MatchFixturesCalendar({
  onSelectFixtureForScoring,
  isAdminView = false,
  className,
}: MatchFixturesCalendarProps) {
  const { activeTournamentId, currentTournament } = useTournament();
  const { teams, getTeam, matchState, matchHistory, formatOvers } = useCricketStore(activeTournamentId);
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<'all' | 'A' | 'B' | 'knockout'>('all');
  const [activeDayFilter, setActiveDayFilter] = useState<string>('all');

  // Load fixtures from DB and localStorage
  useEffect(() => {
    // 1. Initial fast local load
    setFixtures(getStoredFixtures(activeTournamentId));

    // 2. Fetch latest from Supabase cloud
    fetchTournamentFixtures(activeTournamentId).then((dbFixtures) => {
      setFixtures(dbFixtures);
    });

    const handleUpdate = (e: any) => {
      if (e.detail?.tournamentId === activeTournamentId) {
        setFixtures(e.detail.fixtures);
      }
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === `kapl_fixtures_${activeTournamentId}` && e.newValue) {
        try {
          const updatedFixtures = JSON.parse(e.newValue);
          setFixtures(updatedFixtures);
        } catch (err) {
          console.warn('Failed to parse fixtures from storage event:', err);
        }
      }
    };

    window.addEventListener('kapl-fixtures-updated', handleUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('kapl-fixtures-updated', handleUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [activeTournamentId]);

  // Extract unique days
  const availableDays = useMemo(() => {
    const days = new Set<string>();
    fixtures.forEach((f) => {
      if (f.scheduledDate) days.add(f.scheduledDate);
    });
    return Array.from(days);
  }, [fixtures]);

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (activeGroupTab === 'A' && f.group !== 'A') return false;
      if (activeGroupTab === 'B' && f.group !== 'B') return false;
      if (activeGroupTab === 'knockout' && f.matchType === 'group') return false;
      if (activeDayFilter !== 'all' && f.scheduledDate !== activeDayFilter) return false;
      return true;
    });
  }, [fixtures, activeGroupTab, activeDayFilter]);

  const handleReset = async () => {
    const defaults = await resetToDefaultFixtures(activeTournamentId);
    setFixtures(defaults);
    toast.success('Fixtures reset to official tournament schedule');
  };

  const currentMatch = matchState.currentMatch;
  const isMatchLive = (fixture: MatchFixture) => {
    return Boolean(
      currentMatch &&
      (currentMatch.status === 'live' || currentMatch.status === 'super_over') &&
      ((currentMatch as any).fixtureId === fixture.id ||
        ((currentMatch.team1Id === fixture.team1Id && currentMatch.team2Id === fixture.team2Id) ||
         (currentMatch.team1Id === fixture.team2Id && currentMatch.team2Id === fixture.team1Id)))
    );
  };

  const getCompletedMatch = (fixture: MatchFixture) => {
    return (matchHistory || []).find((m) =>
      m.status === 'completed' &&
      (((m as any).fixtureId && (m as any).fixtureId === fixture.id) ||
        ((m.team1Id === fixture.team1Id && m.team2Id === fixture.team2Id) ||
         (m.team1Id === fixture.team2Id && m.team2Id === fixture.team1Id)))
    );
  };

  const getStatusBadge = (fixture: MatchFixture) => {
    const isLive = isMatchLive(fixture) || fixture.status === 'live';
    if (isLive) {
      return (
        <Badge className="bg-rose-600 text-white font-black text-xs gap-1.5 animate-pulse border border-rose-400/50 shadow-md shadow-rose-600/30">
          <Radio className="w-3 h-3 animate-ping" /> LIVE NOW
        </Badge>
      );
    }

    const completed = getCompletedMatch(fixture);
    if (fixture.status === 'completed' || completed) {
      return (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 font-bold text-xs gap-1 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> COMPLETED
        </Badge>
      );
    }

    if (fixture.scheduledDate || fixture.scheduledTime) {
      return (
        <Badge variant="outline" className="bg-blue-500/15 text-blue-300 font-bold text-xs border-blue-500/30">
          SCHEDULED
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-300 font-bold text-xs border-amber-500/30">
        TBD
      </Badge>
    );
  };

  const hasLiveMatchOverall = Boolean(currentMatch && (currentMatch.status === 'live' || currentMatch.status === 'super_over'));

  return (
    <Card className={cn('overflow-hidden rounded-2xl border-white/[0.08] bg-card/90 backdrop-blur-md shadow-xl', className)}>
      <CardHeader className="pb-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg font-bold flex flex-wrap items-center gap-2">
                Tournament Fixtures & Schedule
                {hasLiveMatchOverall && (
                  <Badge className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                    ● MATCH IN PROGRESS
                  </Badge>
                )}
                <Badge variant="gold" className="text-[10px]">
                  {currentTournament?.name || 'KAPL 3.0'}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Official fixtures, match timings, results, and quick launch setup
              </p>
            </div>
          </div>

          {isAdminView && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs h-8 gap-1.5 border-white/10"
              title="Reset schedule to default official fixtures"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Schedule
            </Button>
          )}
        </div>

        {/* Tab filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3">
          {/* Stage Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full scrollbar-hide">
            <Button
              variant={activeGroupTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('all')}
              className="h-8 text-xs px-2.5 rounded-lg font-bold shrink-0 touch-manipulation"
            >
              All Matches ({fixtures.length})
            </Button>
            <Button
              variant={activeGroupTab === 'A' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('A')}
              className="h-8 text-xs px-2.5 rounded-lg font-bold shrink-0 touch-manipulation"
            >
              Group A ({fixtures.filter(f => f.group === 'A').length})
            </Button>
            <Button
              variant={activeGroupTab === 'B' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('B')}
              className="h-8 text-xs px-2.5 rounded-lg font-bold shrink-0 touch-manipulation"
            >
              Group B ({fixtures.filter(f => f.group === 'B').length})
            </Button>
            <Button
              variant={activeGroupTab === 'knockout' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('knockout')}
              className="h-8 text-xs px-2.5 rounded-lg font-bold gap-1 shrink-0 touch-manipulation"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              Knockouts ({fixtures.filter(f => f.matchType !== 'group').length})
            </Button>
          </div>

          {/* Day Filter */}
          {availableDays.length > 1 && (
            <div className="flex items-center gap-1 text-xs overflow-x-auto max-w-full scrollbar-hide">
              <span className="text-muted-foreground font-medium hidden sm:inline shrink-0">Day:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant={activeDayFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setActiveDayFilter('all')}
                  className="h-8 text-[11px] px-2.5 rounded-lg touch-manipulation"
                >
                  All Days
                </Button>
                {availableDays.map((d) => (
                  <Button
                    key={d}
                    variant={activeDayFilter === d ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDayFilter(d)}
                    className="h-8 text-[11px] px-2.5 rounded-lg touch-manipulation"
                  >
                    {d.split(' ')[0]}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-6 space-y-4">
        {/* Active Schedule Header Banner */}
        {hasLiveMatchOverall ? (
          <div className="flex items-start sm:items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-red-500/10 to-transparent border border-rose-500/30 text-xs">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/30">
              <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-black text-rose-300">
                <span>Match In Progress on Ground 1</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-200">
                  Live Action
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Follow real-time ball-by-ball scoring, strike rotation, and commentary above.
              </p>
            </div>
          </div>
        ) : fixtures.length > 0 ? (
          <div className="flex items-start sm:items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 text-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <span className="text-sm font-black">Official Tournament Schedule</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-200">
                  {fixtures.length} Matches Planned
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Matches are scheduled across Group A, Group B, and Knockouts. When a match starts, live scores appear below automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start sm:items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/5 border border-amber-500/30 text-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-md">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 font-bold text-amber-300">
                <span className="text-sm font-black">Official Schedule: Pending Draws</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Official tournament fixtures will appear here once finalized by tournament committee.
              </p>
            </div>
          </div>
        )}

        {filteredFixtures.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No fixtures found for the selected category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFixtures.map((fixture) => {
              const team1 = getTeam(fixture.team1Id);
              const team2 = getTeam(fixture.team2Id);
              const isKnockout = fixture.matchType !== 'group';
              const isLive = isMatchLive(fixture) || fixture.status === 'live';
              const completedMatch = getCompletedMatch(fixture);
              const isCompleted = fixture.status === 'completed' || Boolean(completedMatch);

              // Live score if active
              const liveInnings = isLive && currentMatch ? (
                currentMatch.currentInnings === 1 ? currentMatch.innings1 : currentMatch.innings2
              ) : null;
              const liveBattingTeam = isLive && currentMatch ? getTeam(
                currentMatch.currentInnings === 1 ? currentMatch.team1Id : currentMatch.team2Id
              ) : null;

              return (
                <div
                  key={fixture.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all hover:border-white/[0.18] relative flex flex-col justify-between gap-3 shadow-md',
                    isLive
                      ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                      : isKnockout
                      ? 'bg-gradient-to-br from-amber-500/[0.08] via-card to-card border-amber-500/30'
                      : 'bg-card/70 border-white/[0.08]'
                  )}
                >
                  {/* Top Header: Match Number + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wider uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {isKnockout ? MATCH_TYPE_LABELS[fixture.matchType] : `Match ${fixture.matchNumber || '?'}`}
                      </span>
                      {fixture.group && (
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          Group {fixture.group}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(fixture)}
                  </div>

                  {/* Teams Matchup Center */}
                  <div className="py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    {/* Team 1 */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      {team1 && <TeamBadge team={team1} size="sm" showName={false} className="shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {team1 ? (team1.shortName || team1.name) : fixture.team1Id}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">
                          {fixture.team1Score ? `Score: ${fixture.team1Score}` : 'Team 1'}
                        </div>
                      </div>
                    </div>

                    {/* VS Pill */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center font-bold text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
                      VS
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0 text-right">
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {team2 ? (team2.shortName || team2.name) : fixture.team2Id}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">
                          {fixture.team2Score ? `Score: ${fixture.team2Score}` : 'Team 2'}
                        </div>
                      </div>
                      {team2 && <TeamBadge team={team2} size="sm" showName={false} className="shrink-0" />}
                    </div>
                  </div>

                  {/* Live in-match ticker */}
                  {isLive && liveInnings && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-300 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>{liveBattingTeam?.name || 'Batting'}:</span>
                        <span className="text-white text-sm">{liveInnings.runs}/{liveInnings.wickets}</span>
                        <span className="text-muted-foreground text-[11px]">
                          ({formatOvers(liveInnings.currentOver, liveInnings.currentBall)} ov)
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">
                        Innings {currentMatch?.currentInnings || 1}
                      </span>
                    </div>
                  )}

                  {/* Summary / Notes */}
                  {fixture.notes && !isLive && (
                    <div className="text-xs text-amber-300/80 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 italic">
                      ✨ {fixture.notes}
                    </div>
                  )}

                  {(fixture.summary || completedMatch) && (
                    <div className="text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">
                      🏆 {fixture.summary || (completedMatch?.winner ? `${getTeam(completedMatch.winner)?.name || completedMatch.winner} won` : 'Match Completed')}
                    </div>
                  )}

                  {/* Bottom Footer: Timing & Action */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {fixture.scheduledDate || 'Date TBD'}
                          {fixture.scheduledTime ? ` • ${fixture.scheduledTime}` : ''}
                        </span>
                      </div>
                      {fixture.venue && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{fixture.venue}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {onSelectFixtureForScoring ? (
                      <Button
                        variant="glow"
                        size="sm"
                        onClick={() => onSelectFixtureForScoring(fixture)}
                        className="h-8 text-xs font-bold gap-1 shadow-sm"
                      >
                        <Play className="w-3 h-3" /> Launch Match
                      </Button>
                    ) : isLive ? (
                      <Link to="/">
                        <Button variant="destructive" size="sm" className="h-8 text-xs font-bold gap-1.5 shadow-md animate-pulse">
                          <Radio className="w-3 h-3" /> Watch Live
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
