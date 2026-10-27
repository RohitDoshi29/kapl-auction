import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trophy, Medal, Award, Sparkles } from 'lucide-react';
import { TournamentCeremonyModal } from '@/components/cricket/TournamentCeremonyModal';
import { TournamentBracket } from '@/components/cricket/TournamentBracket';
import { useTournamentHonors } from '@/hooks/useTournamentHonors';

interface TournamentState {
  id: string;
  qualified_a1: string | null;
  qualified_a2: string | null;
  qualified_b1: string | null;
  qualified_b2: string | null;
  sf1_winner: string | null;
  sf2_winner: string | null;
  final_winner: string | null;
}

export function AdminTournamentTab() {
  const { teams } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const honors = useTournamentHonors(activeTournamentId);

  const tournamentTeams = (teams || []).filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  const groupATeams = tournamentTeams.filter(t => t.group === 'A');
  const groupBTeams = tournamentTeams.filter(t => t.group === 'B');

  const fetchTournamentState = useCallback(async () => {
    let resolvedData: any = null;
    const { data, error: fetchErr } = await supabase
      .from('tournament_state')
      .select('*')
      .eq('id', activeTournamentId)
      .maybeSingle();

    resolvedData = data;
    if (!resolvedData && activeTournamentId === 'kapl-3-mens') {
      const { data: legacyData } = await supabase
        .from('tournament_state')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();
      resolvedData = legacyData;
    }

    if (fetchErr) {
      console.error('Error fetching tournament state:', fetchErr);
      toast.error('Failed to load tournament state');
    } else if (resolvedData) {
      setTournamentState(resolvedData as TournamentState);
    } else {
      setTournamentState({
        id: activeTournamentId,
        qualified_a1: null,
        qualified_a2: null,
        qualified_b1: null,
        qualified_b2: null,
        sf1_winner: null,
        sf2_winner: null,
        final_winner: null,
      });
    }
    setLoading(false);
  }, [activeTournamentId]);

  useEffect(() => {
    fetchTournamentState();
  }, [fetchTournamentState]);

  const updateTournamentState = async (field: keyof TournamentState, value: string | null) => {
    const stateId = tournamentState?.id || activeTournamentId;
    const updates: Partial<TournamentState> = { [field]: value };

    // Clear dependent selections when parent changes
    if (field === 'qualified_a1' || field === 'qualified_b2') {
      updates.sf1_winner = null;
    }
    if (field === 'qualified_b1' || field === 'qualified_a2') {
      updates.sf2_winner = null;
    }
    if (field === 'sf1_winner' || field === 'sf2_winner') {
      updates.final_winner = null;
    }

    const { error } = await supabase
      .from('tournament_state')
      .upsert({
        id: stateId,
        qualified_a1: tournamentState?.qualified_a1 || null,
        qualified_a2: tournamentState?.qualified_a2 || null,
        qualified_b1: tournamentState?.qualified_b1 || null,
        qualified_b2: tournamentState?.qualified_b2 || null,
        sf1_winner: tournamentState?.sf1_winner || null,
        sf2_winner: tournamentState?.sf2_winner || null,
        final_winner: tournamentState?.final_winner || null,
        ...updates,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating tournament state:', error);
      toast.error('Failed to update');
    } else {
      setTournamentState(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Updated successfully');
    }
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return 'Not Selected';
    const team = (teams || []).find(t => t.id === teamId);
    return team?.name || 'Unknown';
  };

  const sf1Teams = [tournamentState?.qualified_a1, tournamentState?.qualified_b2].filter(Boolean);
  const sf2Teams = [tournamentState?.qualified_b1, tournamentState?.qualified_a2].filter(Boolean);
  const finalTeams = [tournamentState?.sf1_winner, tournamentState?.sf2_winner].filter(Boolean);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tournament Bracket Visualization */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Tournament Bracket
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <TournamentBracket
            a1={tournamentState?.qualified_a1 ? { name: getTeamName(tournamentState.qualified_a1) } : undefined}
            a2={tournamentState?.qualified_a2 ? { name: getTeamName(tournamentState.qualified_a2) } : undefined}
            b1={tournamentState?.qualified_b1 ? { name: getTeamName(tournamentState.qualified_b1) } : undefined}
            b2={tournamentState?.qualified_b2 ? { name: getTeamName(tournamentState.qualified_b2) } : undefined}
            sf1Winner={tournamentState?.sf1_winner ? { name: getTeamName(tournamentState.sf1_winner) } : undefined}
            sf2Winner={tournamentState?.sf2_winner ? { name: getTeamName(tournamentState.sf2_winner) } : undefined}
            finalWinner={tournamentState?.final_winner ? { name: getTeamName(tournamentState.final_winner) } : undefined}
          />
        </CardContent>
      </Card>

      {/* Group Qualifiers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="h-4 w-4 text-primary" />
              Group A Qualifiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>A1 (1st Place)</Label>
              <Select
                value={tournamentState?.qualified_a1 || ''}
                onValueChange={(v) => updateTournamentState('qualified_a1', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select A1" />
                </SelectTrigger>
                <SelectContent>
                  {groupATeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>A2 (2nd Place)</Label>
              <Select
                value={tournamentState?.qualified_a2 || ''}
                onValueChange={(v) => updateTournamentState('qualified_a2', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select A2" />
                </SelectTrigger>
                <SelectContent>
                  {groupATeams.filter(t => t.id !== tournamentState?.qualified_a1).map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="h-4 w-4 text-primary" />
              Group B Qualifiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>B1 (1st Place)</Label>
              <Select
                value={tournamentState?.qualified_b1 || ''}
                onValueChange={(v) => updateTournamentState('qualified_b1', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select B1" />
                </SelectTrigger>
                <SelectContent>
                  {groupBTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>B2 (2nd Place)</Label>
              <Select
                value={tournamentState?.qualified_b2 || ''}
                onValueChange={(v) => updateTournamentState('qualified_b2', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select B2" />
                </SelectTrigger>
                <SelectContent>
                  {groupBTeams.filter(t => t.id !== tournamentState?.qualified_b1).map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Semi-Final Winners */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-cricket-accent" />
            Semi-Final Winners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SF1 Winner (A1 vs B2)</Label>
              <Select
                value={tournamentState?.sf1_winner || ''}
                onValueChange={(v) => updateTournamentState('sf1_winner', v)}
                disabled={sf1Teams.length < 2}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sf1Teams.length < 2 ? 'Select qualifiers first' : 'Select winner'} />
                </SelectTrigger>
                <SelectContent>
                  {sf1Teams.map(teamId => (
                    <SelectItem key={teamId} value={teamId!}>{getTeamName(teamId!)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getTeamName(tournamentState?.qualified_a1 || null)} vs {getTeamName(tournamentState?.qualified_b2 || null)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>SF2 Winner (B1 vs A2)</Label>
              <Select
                value={tournamentState?.sf2_winner || ''}
                onValueChange={(v) => updateTournamentState('sf2_winner', v)}
                disabled={sf2Teams.length < 2}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sf2Teams.length < 2 ? 'Select qualifiers first' : 'Select winner'} />
                </SelectTrigger>
                <SelectContent>
                  {sf2Teams.map(teamId => (
                    <SelectItem key={teamId} value={teamId!}>{getTeamName(teamId!)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getTeamName(tournamentState?.qualified_b1 || null)} vs {getTeamName(tournamentState?.qualified_a2 || null)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Winner */}
      <Card className="border-cricket-accent/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Tournament Champion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Final Winner</Label>
            <Select
              value={tournamentState?.final_winner || ''}
              onValueChange={(v) => updateTournamentState('final_winner', v)}
              disabled={finalTeams.length < 2}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder={finalTeams.length < 2 ? 'Select SF winners first' : 'Select champion'} />
              </SelectTrigger>
              <SelectContent>
                {finalTeams.map(teamId => (
                  <SelectItem key={teamId} value={teamId!}>{getTeamName(teamId!)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {getTeamName(tournamentState?.sf1_winner || null)} vs {getTeamName(tournamentState?.sf2_winner || null)}
            </p>

            {tournamentState?.final_winner && (
              <div className="pt-3 border-t border-white/10">
                <Button
                  variant="glow"
                  size="default"
                  onClick={() => setCeremonyOpen(true)}
                  className="w-full gap-2 font-bold rounded-xl"
                >
                  <Trophy className="w-4 h-4 text-slate-950" />
                  🏆 Launch Official Championship Ceremony & Honors
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          const stateId = tournamentState?.id || activeTournamentId;
          const { error } = await supabase
            .from('tournament_state')
            .upsert({
              id: stateId,
              qualified_a1: null,
              qualified_a2: null,
              qualified_b1: null,
              qualified_b2: null,
              sf1_winner: null,
              sf2_winner: null,
              final_winner: null,
              updated_at: new Date().toISOString()
            });
          
          if (!error) {
            setTournamentState({
              id: stateId,
              qualified_a1: null,
              qualified_a2: null,
              qualified_b1: null,
              qualified_b2: null,
              sf1_winner: null,
              sf2_winner: null,
              final_winner: null
            });
            toast.success(`${currentTournament?.name || "Tournament"} bracket reset`);
          }
        }}
      >
        Reset All Selections
      </Button>

      {/* Grand Champions Presentation Ceremony Modal */}
      {tournamentState?.final_winner && (teams || []).find(t => t.id === tournamentState.final_winner) && (
        <TournamentCeremonyModal
          isOpen={ceremonyOpen}
          onClose={() => setCeremonyOpen(false)}
          tournamentName={currentTournament?.name || "KAPL 3.0 Championship"}
          championTeam={(teams || []).find(t => t.id === tournamentState.final_winner)!}
          runnerUpTeam={
            tournamentState?.sf1_winner && tournamentState?.sf2_winner
              ? tournamentState.final_winner === tournamentState.sf1_winner
                ? (teams || []).find(t => t.id === tournamentState.sf2_winner)
                : (teams || []).find(t => t.id === tournamentState.sf1_winner)
              : null
          }
          orangeCapWinner={honors.orangeCap}
          purpleCapWinner={honors.purpleCap}
          maxSixesWinner={honors.maxSixes}
          mvpWinner={honors.mvp}
        />
      )}
    </div>
  );
}