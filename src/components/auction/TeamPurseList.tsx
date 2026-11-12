import { Team, PlayerRecord } from '@/lib/cricketTypes';
import { formatMoney } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Wallet, Users } from 'lucide-react';

interface TeamPurseListProps {
  teams: Team[];
  playerPool: PlayerRecord[];
}

export function TeamPurseList({ teams, playerPool }: TeamPurseListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {teams.map((team) => {
        const teamPlayers = playerPool.filter((p) => p.teamId === team.id && p.auctionStatus === 'sold');
        const teamInitial = team.initialPurse || 10000;
        const spent = teamPlayers.reduce((acc, p) => acc + (p.soldPrice || p.basePrice || 0), 0);
        const teamRemaining = Math.max(0, teamInitial - spent);
        const pursePercentage = Math.round((teamRemaining / teamInitial) * 100);
        const squadCount = teamPlayers.length;
        const maxSquad = team.maxSquadSize || 10;

        return (
          <Card key={team.id} className="overflow-hidden border hover:border-primary/40 transition-colors shadow-sm">
            <CardHeader className="p-3 pb-2.5 bg-muted/40 border-b space-y-1.5">
              <div className="flex items-center justify-between">
                <TeamBadge team={team} size="sm" showName={true} />
                <Badge variant="outline" className="text-[11px] font-semibold">
                  Grp {team.group}
                </Badge>
              </div>

              {/* Owner & Captain Governance Display */}
              {(team.ownerName || team.captainName) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  {team.ownerName && team.captainName && (team.captainPlayerId === 'owner' || team.ownerName === team.captainName) ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                      👑⚡ Owner & Captain: {team.ownerName}
                    </span>
                  ) : (
                    <>
                      {team.ownerName && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          👑 Owner: {team.ownerName}
                        </span>
                      )}
                      {team.captainName && (
                        <span className="inline-flex items-center gap-1 text-primary font-semibold bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                          ⚡ Captain: {team.captainName}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Purse Status */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1 font-medium">
                    <Wallet className="w-3.5 h-3.5 text-primary" /> Remaining Purse
                  </span>
                  <span className="font-extrabold text-foreground">{formatMoney(teamRemaining)}</span>
                </div>
                <Progress value={pursePercentage} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Spent: {formatMoney(spent)}</span>
                  <span>Total: {formatMoney(teamInitial)}</span>
                </div>
              </div>

              {/* Squad Slots */}
              <div className="flex items-center justify-between pt-1 border-t text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Squad
                </span>
                <span className="font-bold">
                  {squadCount} / {maxSquad} Players
                </span>
              </div>

              {/* Acquired Players Mini-List */}
              <div className="space-y-1 pt-1 max-h-36 overflow-y-auto scrollbar-hide">
                {teamPlayers.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic text-center py-2">
                    No players signed yet
                  </p>
                ) : (
                  teamPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-[11px] bg-muted/50 rounded-lg px-2 py-1"
                    >
                      <span className="font-medium truncate max-w-[110px]">{p.name}</span>
                      <span className="text-primary font-bold">{formatMoney(p.soldPrice || p.basePrice)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

