import { Medal, Trophy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BracketTeam {
  name: string | null;
  color?: string;
}

interface TournamentBracketProps {
  a1?: BracketTeam;
  a2?: BracketTeam;
  b1?: BracketTeam;
  b2?: BracketTeam;
  sf1Winner?: BracketTeam;
  sf2Winner?: BracketTeam;
  finalWinner?: BracketTeam;
}

export function TournamentBracket({
  a1,
  a2,
  b1,
  b2,
  sf1Winner,
  sf2Winner,
  finalWinner,
}: TournamentBracketProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex gap-4 md:gap-6 lg:gap-8 p-4 md:p-6 min-w-min">
        {/* Group Winners */}
        <div className="flex flex-col justify-around gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase">A1</div>
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap border',
              a1?.name
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {a1?.name || 'TBD'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase">B2</div>
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap border',
              b2?.name
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {b2?.name || 'TBD'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase">B1</div>
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap border',
              b1?.name
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {b1?.name || 'TBD'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-muted-foreground uppercase">A2</div>
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap border',
              a2?.name
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {a2?.name || 'TBD'}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <div className="text-muted-foreground/40 text-lg">→</div>
        </div>

        {/* Semi-Finals */}
        <div className="flex flex-col justify-around gap-8">
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-400 uppercase">SF1</div>
            <div className={cn(
              'px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap border-2',
              sf1Winner?.name
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {sf1Winner?.name || 'TBD'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-400 uppercase">SF2</div>
            <div className={cn(
              'px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap border-2',
              sf2Winner?.name
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {sf2Winner?.name || 'TBD'}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <div className="text-muted-foreground/40 text-lg">→</div>
        </div>

        {/* Final */}
        <div className="flex flex-col justify-center">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <div className="text-xs font-bold text-yellow-500 uppercase">Champion</div>
            </div>
            <div className={cn(
              'px-5 py-3 rounded-xl text-base font-black whitespace-nowrap border-2',
              finalWinner?.name
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 shadow-lg shadow-yellow-500/20'
                : 'bg-muted/20 border-muted/30 text-muted-foreground'
            )}>
              {finalWinner?.name || 'TBD'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
