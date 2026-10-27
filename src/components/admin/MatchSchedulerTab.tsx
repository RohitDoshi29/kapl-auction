import { useState, useEffect, useMemo } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Calendar, Clock, Plus, Edit, Trash2, Check, Radio, PlayCircle, RotateCcw, Cloud, Trophy } from 'lucide-react';
import { MatchFixture, MATCH_TYPE_LABELS, MatchType } from '@/lib/cricketTypes';
import { getStoredFixtures, saveStoredFixtures, resetToDefaultFixtures, fetchTournamentFixtures } from '@/lib/fixturesData';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface MatchSchedulerTabProps {
  onNavigateToSetup?: (fixture: MatchFixture) => void;
}

export default function MatchSchedulerTab({ onNavigateToSetup }: MatchSchedulerTabProps) {
  const { activeTournamentId, currentTournament } = useTournament();
  const { teams, getTeam, matchState } = useCricketStore(activeTournamentId);
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<MatchFixture | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'A' | 'B' | 'knockout'>('all');

  // Filter registered teams strictly for this tournament
  const tournamentTeams = useMemo(() => {
    return teams.filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  }, [teams, activeTournamentId]);

  // Form state
  const [formData, setFormData] = useState({
    matchNumber: 1,
    team1Id: '',
    team2Id: '',
    scheduledDate: '',
    scheduledTime: '',
    venue: '',
    notes: '',
    status: 'scheduled' as 'scheduled' | 'live' | 'completed',
    group: '' as 'A' | 'B' | '',
    matchType: 'group' as 'group' | 'knockout',
    knockoutType: '' as 'semi_final_1' | 'semi_final_2' | 'final' | '',
  });

  // Load fixtures from DB and sync with local storage & realtime
  useEffect(() => {
    // 1. Initial fast load from memory/localStorage
    setFixtures(getStoredFixtures(activeTournamentId));

    // 2. Refresh from Supabase cloud
    fetchTournamentFixtures(activeTournamentId).then((dbFixtures) => {
      setFixtures(dbFixtures);
    });

    // 3. Listen for realtime events from other windows/admins
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

  const resetForm = () => {
    const nextMatchNumber = fixtures.length > 0
      ? Math.max(...fixtures.map(f => f.matchNumber || 0)) + 1
      : 1;

    setFormData({
      matchNumber: nextMatchNumber,
      team1Id: '',
      team2Id: '',
      scheduledDate: '',
      scheduledTime: '',
      venue: 'Main Stadium',
      notes: '',
      status: 'scheduled',
      group: '',
      matchType: 'group',
      knockoutType: '',
    });
    setEditingFixture(null);
  };

  const handleSaveMatch = async () => {
    if (!formData.team1Id || !formData.team2Id) {
      toast.error('Please select both teams');
      return;
    }

    if (formData.team1Id === formData.team2Id) {
      toast.error('Teams must be different');
      return;
    }

    if (formData.matchType === 'group' && !formData.group) {
      toast.error('Please select a group for group matches');
      return;
    }

    if (formData.matchType === 'knockout' && !formData.knockoutType) {
      toast.error('Please select knockout stage');
      return;
    }

    setIsSaving(true);
    try {
      let updatedFixtures: MatchFixture[];

      const resolvedMatchType: MatchType = formData.matchType === 'knockout' 
        ? (formData.knockoutType as MatchType) 
        : 'group';

      if (editingFixture) {
        updatedFixtures = fixtures.map((f) =>
          f.id === editingFixture.id
            ? {
                ...f,
                matchNumber: Number(formData.matchNumber) || f.matchNumber || 1,
                team1Id: formData.team1Id,
                team2Id: formData.team2Id,
                scheduledDate: formData.scheduledDate,
                scheduledTime: formData.scheduledTime,
                venue: formData.venue,
                notes: formData.notes,
                status: formData.status,
                matchType: resolvedMatchType,
                group: formData.matchType === 'group' ? (formData.group as 'A' | 'B') : undefined,
                knockoutType: formData.matchType === 'knockout' ? formData.knockoutType : undefined,
              }
            : f
        );
        toast.success('Match updated and synced');
        logger.info('Match updated', { matchId: editingFixture.id, team1Id: formData.team1Id, team2Id: formData.team2Id });
      } else {
        const newFixture: MatchFixture = {
          id: `match_${Date.now()}`,
          tournamentId: activeTournamentId,
          matchNumber: Number(formData.matchNumber) || fixtures.length + 1,
          team1Id: formData.team1Id,
          team2Id: formData.team2Id,
          scheduledDate: formData.scheduledDate,
          scheduledTime: formData.scheduledTime,
          venue: formData.venue || 'Main Stadium',
          notes: formData.notes,
          status: formData.status,
          matchType: resolvedMatchType,
          group: formData.matchType === 'group' ? (formData.group as 'A' | 'B') : undefined,
          knockoutType: formData.matchType === 'knockout' ? formData.knockoutType : undefined,
        };
        updatedFixtures = [...fixtures, newFixture];
        toast.success('Match scheduled and synced');
        logger.info('Match scheduled', { team1Id: formData.team1Id, team2Id: formData.team2Id, date: formData.scheduledDate });
      }

      setFixtures(updatedFixtures);
      await saveStoredFixtures(activeTournamentId, updatedFixtures);

      // Explicit broadcast to ensure cross-tab sync
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId: activeTournamentId, fixtures: updatedFixtures }
      }));

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save match schedule');
      logger.error('Failed to save match', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditMatch = (fixture: MatchFixture) => {
    setEditingFixture(fixture);
    setFormData({
      matchNumber: fixture.matchNumber || 1,
      team1Id: fixture.team1Id,
      team2Id: fixture.team2Id,
      scheduledDate: fixture.scheduledDate || '',
      scheduledTime: fixture.scheduledTime || '',
      venue: fixture.venue || '',
      notes: fixture.notes || '',
      status: fixture.status || 'scheduled',
      group: fixture.group || '',
      matchType: fixture.matchType === 'group' ? 'group' : 'knockout',
      knockoutType: (fixture.matchType !== 'group' ? fixture.matchType : '') as any,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteMatch = async (fixtureId: string) => {
    try {
      const updatedFixtures = fixtures.filter((f) => f.id !== fixtureId);
      setFixtures(updatedFixtures);
      await saveStoredFixtures(activeTournamentId, updatedFixtures);

      // Explicit broadcast to ensure cross-tab sync
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId: activeTournamentId, fixtures: updatedFixtures }
      }));

      toast.success('Match deleted from tournament schedule');
      logger.info('Match deleted', { matchId: fixtureId });
    } catch (error) {
      toast.error('Failed to delete match');
      logger.error('Failed to delete match', error);
    }
  };

  const handleResetDefaults = async () => {
    try {
      const defaults = await resetToDefaultFixtures(activeTournamentId);
      setFixtures(defaults);

      // Explicit broadcast to ensure cross-tab sync
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId: activeTournamentId, fixtures: defaults }
      }));

      toast.success('Schedule reset to official KAPL default fixtures');
    } catch (err) {
      toast.error('Failed to reset schedule');
    }
  };

  const getMatchTypeLabel = (fixture: MatchFixture) => {
    if (fixture.matchType === 'group' && fixture.group) {
      return `Group ${fixture.group}`;
    }
    if (fixture.matchType && fixture.matchType !== 'group') {
      return MATCH_TYPE_LABELS[fixture.matchType] || fixture.matchType;
    }
    return 'Group Stage';
  };

  const filteredFixtures = useMemo(() => {
    return fixtures.filter(f => {
      if (activeFilter === 'A') return f.group === 'A';
      if (activeFilter === 'B') return f.group === 'B';
      if (activeFilter === 'knockout') return f.matchType !== 'group';
      return true;
    });
  }, [fixtures, activeFilter]);

  const sortedFixtures = useMemo(() => {
    return [...filteredFixtures].sort((a, b) => {
      if (a.matchNumber && b.matchNumber) return a.matchNumber - b.matchNumber;
      return 0;
    });
  }, [filteredFixtures]);

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-white/[0.04]">
        <CardHeader className="border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-xl font-black">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  Tournament Match Scheduler
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-bold border-emerald-500/30 text-emerald-400 gap-1">
                  <Cloud className="w-3 h-3 text-emerald-400" /> Live Database Sync
                </Badge>
              </div>
              <CardDescription>
                Schedule, edit, or delete matches for {currentTournament?.name || 'KAPL 3.0'}. Changes sync instantly to Public View & Scorer Setup.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8.5 rounded-xl border-white/10 text-xs">
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                    Reset Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Schedule to Default Official Fixtures?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace current scheduled matches with the standard 15-match KAPL group and knockout fixture structure.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetDefaults} className="bg-amber-600 hover:bg-amber-700">
                      Reset Schedule
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(true);
                    }}
                    className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-xs font-bold h-8.5 rounded-xl shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Schedule Match
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingFixture ? 'Edit Match' : 'Schedule New Match'}</DialogTitle>
                    <DialogDescription>
                      {editingFixture ? 'Update match details and sync across all screens' : 'Create a new match in the tournament schedule'}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Match Number */}
                    <div>
                      <Label className="text-sm font-bold">Match Number</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 1"
                        value={formData.matchNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, matchNumber: parseInt(e.target.value) || 1 }))}
                      />
                    </div>

                    {/* Match Type Selection */}
                    <div>
                      <Label className="text-sm font-bold">Stage Type</Label>
                      <Select
                        value={formData.matchType}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, matchType: value as 'group' | 'knockout' }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">Group Stage Match</SelectItem>
                          <SelectItem value="knockout">Playoff / Knockout Match</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Group Selection (for group matches) */}
                    {formData.matchType === 'group' && (
                      <div>
                        <Label className="text-sm font-bold">Group</Label>
                        <Select
                          value={formData.group}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, group: value as 'A' | 'B' }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Group A</SelectItem>
                            <SelectItem value="B">Group B</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Knockout Type (for knockout matches) */}
                    {formData.matchType === 'knockout' && (
                      <div>
                        <Label className="text-sm font-bold">Knockout Stage</Label>
                        <Select
                          value={formData.knockoutType}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, knockoutType: value as any }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Stage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semi_final_1">Semi Final 1</SelectItem>
                            <SelectItem value="semi_final_2">Semi Final 2</SelectItem>
                            <SelectItem value="final">Final</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Team 1 Selection */}
                    <div>
                      <Label className="text-sm font-bold">Team 1 (Batting or Home)</Label>
                      <Select value={formData.team1Id} onValueChange={(value) => setFormData((prev) => ({ ...prev, team1Id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Team 1" />
                        </SelectTrigger>
                        <SelectContent>
                          {tournamentTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} ({team.group ? `Group ${team.group}` : 'Registered Team'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Team 2 Selection */}
                    <div>
                      <Label className="text-sm font-bold">Team 2 (Bowling or Away)</Label>
                      <Select value={formData.team2Id} onValueChange={(value) => setFormData((prev) => ({ ...prev, team2Id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Team 2" />
                        </SelectTrigger>
                        <SelectContent>
                          {tournamentTeams
                            .filter((team) => team.id !== formData.team1Id)
                            .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} ({team.group ? `Group ${team.group}` : 'Registered Team'})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date */}
                    <div>
                      <Label className="text-sm font-bold">Match Date / Day</Label>
                      <Input
                        placeholder="e.g. 2026-10-28 or Day 1 (Morning)"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <Label className="text-sm font-bold">Match Time</Label>
                      <Input
                        placeholder="e.g. 09:30 AM or 14:00"
                        value={formData.scheduledTime}
                        onChange={(e) => setFormData((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                      />
                    </div>

                    {/* Venue */}
                    <div>
                      <Label className="text-sm font-bold">Venue</Label>
                      <Input
                        placeholder="e.g. Ground 1 (Pitch A)"
                        value={formData.venue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, venue: e.target.value }))}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <Label className="text-sm font-bold">Notes / Tagline (Optional)</Label>
                      <Input
                        placeholder="e.g. Tournament Opener • Group A Clash"
                        value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>

                    {/* Status */}
                    {editingFixture && (
                      <div>
                        <Label className="text-sm font-bold">Match Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="live">Live in Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveMatch} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Check className="w-4 h-4" />
                      {isSaving ? 'Saving...' : editingFixture ? 'Update Match' : 'Schedule Match'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-4 overflow-x-auto scrollbar-hide">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter('all')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              All Matches ({fixtures.length})
            </Button>
            <Button
              variant={activeFilter === 'A' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter('A')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              Group A ({fixtures.filter(f => f.group === 'A').length})
            </Button>
            <Button
              variant={activeFilter === 'B' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter('B')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              Group B ({fixtures.filter(f => f.group === 'B').length})
            </Button>
            <Button
              variant={activeFilter === 'knockout' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter('knockout')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold gap-1"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              Knockouts ({fixtures.filter(f => f.matchType !== 'group').length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {sortedFixtures.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium text-sm">No matches scheduled in this category</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
                className="gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule First Match
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFixtures.map((fixture) => {
                const team1 = getTeam(fixture.team1Id);
                const team2 = getTeam(fixture.team2Id);
                const isLive = fixture.status === 'live' || (
                  matchState.currentMatch &&
                  (matchState.currentMatch.status === 'live' || matchState.currentMatch.status === 'super_over') &&
                  ((matchState.currentMatch.team1Id === fixture.team1Id && matchState.currentMatch.team2Id === fixture.team2Id) ||
                   (matchState.currentMatch.team1Id === fixture.team2Id && matchState.currentMatch.team2Id === fixture.team1Id))
                );

                return (
                  <div
                    key={fixture.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all gap-4 shadow-sm"
                  >
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black tracking-wider uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Match {fixture.matchNumber || '?'}
                        </span>
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-300 text-xs font-bold">
                          {getMatchTypeLabel(fixture)}
                        </Badge>
                        {isLive ? (
                          <Badge className="bg-rose-600 text-white text-xs font-black gap-1 animate-pulse">
                            <Radio className="w-3 h-3 animate-ping" /> LIVE NOW
                          </Badge>
                        ) : fixture.status === 'completed' ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 text-xs font-bold gap-1 border-emerald-500/30">
                            <Check className="w-3 h-3" /> Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-500/15 text-blue-300 text-xs font-bold border-blue-500/30">
                            Scheduled
                          </Badge>
                        )}
                        {fixture.notes && (
                          <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">
                            • {fixture.notes}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <TeamBadge team={team1} size="sm" />
                        <span className="text-xs text-muted-foreground font-black">vs</span>
                        <TeamBadge team={team2} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {fixture.scheduledDate && (
                          <div className="flex items-center gap-1 font-medium text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            {fixture.scheduledDate}
                          </div>
                        )}
                        {fixture.scheduledTime && (
                          <div className="flex items-center gap-1 font-medium text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {fixture.scheduledTime}
                          </div>
                        )}
                        {fixture.venue && <div className="text-slate-400">📍 {fixture.venue}</div>}
                      </div>

                      {fixture.summary && (
                        <div className="text-xs text-emerald-300 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block">
                          🏆 {fixture.summary}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {onNavigateToSetup && fixture.status !== 'completed' && (
                        <Button
                          variant="glow"
                          size="sm"
                          onClick={() => onNavigateToSetup(fixture)}
                          className="gap-1.5 h-10 sm:h-8.5 min-w-[44px] rounded-xl text-xs font-bold shadow-sm touch-manipulation"
                        >
                          <PlayCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">Launch in Setup</span>
                          <span className="sm:hidden">Launch</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditMatch(fixture)}
                        className="gap-1 h-10 w-10 sm:h-8.5 sm:w-auto rounded-xl border-white/10 touch-manipulation"
                        title="Edit match"
                      >
                        <Edit className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteMatch(fixture.id)}
                        className="gap-1 h-10 w-10 sm:h-8.5 sm:w-auto rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 touch-manipulation"
                        title="Delete match"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
