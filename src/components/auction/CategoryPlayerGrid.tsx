import { useState, useMemo } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { formatPlayerRole, formatMoney } from '@/lib/utils';
import { AUCTION_CATEGORIES } from '@/hooks/useAuction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, Search, Filter, Sparkles, Gavel, User } from 'lucide-react';

interface CategoryPlayerGridProps {
  players: PlayerRecord[];
  teams: Team[];
  selectedCategory: PlayerRole | 'all';
  selectedPlayerId?: string;
  onSelectCategory: (role: PlayerRole | 'all') => void;
  onSelectPlayer: (player: PlayerRecord) => void;
}

export function CategoryPlayerGrid({
  players = [],
  teams = [],
  selectedCategory,
  selectedPlayerId,
  onSelectCategory,
  onSelectPlayer,
}: CategoryPlayerGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sold' | 'unsold'>('all');

  // Filter players by selected category, status, and search query
  const filteredPlayers = useMemo(() => {
    return (players || []).filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.role !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && p.auctionStatus !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesJersey = p.jerseyNumber?.toString().includes(query);
        const matchesRole = (p.role || '').toLowerCase().includes(query);
        const assignedTeam = (teams || []).find((t) => t.id === p.teamId);
        const matchesTeam = (assignedTeam?.name || '').toLowerCase().includes(query);
        if (!matchesName && !matchesJersey && !matchesRole && !matchesTeam) {
          return false;
        }
      }
      return true;
    });
  }, [players, selectedCategory, statusFilter, searchQuery, teams]);

  const activeCategoryInfo = (AUCTION_CATEGORIES || []).find((c) => c.id === selectedCategory) || AUCTION_CATEGORIES[0];

  return (
    <div className="space-y-4">
      {/* Category Selection Cards (All 80, Batters 25, Bowlers 25, All-Rounders 20, Keepers 10) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {AUCTION_CATEGORIES.map((cat) => {
          const catPlayers = cat.id === 'all' ? (players || []) : (players || []).filter((p) => p.role === cat.id);
          const soldCount = catPlayers.filter((p) => p.auctionStatus === 'sold').length;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between touch-manipulation ${
                isSelected
                  ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/15'
                  : 'border-white/10 bg-card/85 backdrop-blur-md hover:bg-white/[0.06] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xl">{cat.icon}</span>
                <Badge
                  variant={isSelected ? 'default' : 'secondary'}
                  className={`text-[10px] font-bold ${
                    isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/10 text-muted-foreground'
                  }`}
                >
                  {soldCount}/{catPlayers.length} Sold
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-black text-foreground">{cat.label}</h4>
                <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Players Container with Filter & Search Controls */}
      <Card className="border border-white/10 bg-card/85 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="p-4 md:p-5 border-b border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base md:text-lg font-black flex items-center gap-2">
              <span className="text-xl">{activeCategoryInfo.icon}</span>
              <span>{activeCategoryInfo.label} Pool</span>
              <Badge variant="outline" className="text-xs font-mono border-amber-500/30 text-amber-400 font-bold">
                {filteredPlayers.length} / {players.length} Players
              </Badge>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Click any candidate to put them under the live hammer spotlight
            </span>
          </div>

          {/* Search Bar & Status Chips */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search player by name or jersey #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-white/[0.04] border-white/10 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'pending', 'sold', 'unsold'] as const).map((st) => {
                const count = (selectedCategory === 'all'
                  ? players
                  : players.filter((p) => p.role === selectedCategory)
                ).filter((p) => (st === 'all' ? true : p.auctionStatus === st)).length;

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap touch-manipulation ${
                      statusFilter === st
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground'
                    }`}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-5">
          {filteredPlayers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center">
                <User className="w-6 h-6 opacity-40" />
              </div>
              <p className="font-semibold text-sm text-foreground">No players match the current criteria.</p>
              <p className="text-xs text-muted-foreground">Try clearing your search query or switching status filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredPlayers.map((player) => {
                const isSelected = player.id === selectedPlayerId;
                const assignedTeam = (teams || []).find((t) => t.id === player.teamId);
                const isSold = player.auctionStatus === 'sold';
                const isUnsold = player.auctionStatus === 'unsold';

                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className={`cursor-pointer p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-200 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/15 scale-[1.01]'
                        : isSold
                        ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                        : isUnsold
                        ? 'border-destructive/30 bg-destructive/5 opacity-80 hover:opacity-100'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-amber-400/50 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-11 h-11 border border-white/10 shrink-0 shadow-xs">
                        <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                        <AvatarFallback className="bg-amber-500/10 text-amber-400 text-xs font-black">
                          {(player.name || 'P').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground truncate">
                            {player.name}
                          </span>
                          {player.jerseyNumber && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{player.jerseyNumber}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-muted-foreground block truncate capitalize">
                          {formatPlayerRole(player.role)} • Base: {formatMoney(player.basePrice)}
                        </span>

                        {isSold && assignedTeam && (
                          <span className="text-[11px] text-emerald-400 font-bold block truncate">
                            ✓ {assignedTeam.name} ({formatMoney(player.soldPrice || player.basePrice)})
                          </span>
                        )}
                        {isUnsold && (
                          <span className="text-[11px] text-destructive font-semibold block">
                            ✗ Unsold
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isSold ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isUnsold ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : isSelected ? (
                        <Badge className="bg-amber-500 text-slate-950 text-[10px] font-black tracking-wider">
                          LIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-white/15">
                          PENDING
                        </Badge>
                      )}
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
