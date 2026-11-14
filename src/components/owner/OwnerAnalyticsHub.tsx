import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Crown,
  Users,
  Target,
  BarChart3,
  Sparkles,
  Info,
} from 'lucide-react';
import { PlayerRecord } from '@/lib/cricketTypes';

export interface TeamData {
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

export interface TeamStats {
  teamId: string;
  teamName: string;
  ownerName: string;
  totalPlayers: number;
  soldPlayers: number;
  totalSpent: number;
  remainingPurse: number;
  initialPurse: number;
}

interface OwnerAnalyticsHubProps {
  myTeam: TeamData;
  otherTeams: TeamStats[];
  playerPool?: PlayerRecord[];
}

const ROLE_COLORS: Record<string, string> = {
  batter: '#38bdf8', // sky-400
  bowler: '#34d399', // emerald-400
  all_rounder: '#c084fc', // purple-400
  wicket_keeper: '#facc15', // yellow-400
  unspent: '#10b981', // green-500
};

export function OwnerAnalyticsHub({ myTeam, otherTeams, playerPool = [] }: OwnerAnalyticsHubProps) {
  const initialPurse = myTeam.initialPurse || myTeam.initial_purse || 10000;
  const players = useMemo(() => myTeam.players || [], [myTeam.players]);

  // Total spent and remaining purse
  const totalSpent = useMemo(() => {
    return players.reduce((sum, p) => sum + (Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 0), 0);
  }, [players]);

  const remainingPurse = Math.max(0, initialPurse - totalSpent);
  const slotsFilled = players.length;
  const slotsRemaining = Math.max(0, 10 - slotsFilled);

  // Reserve required: each remaining slot must have at least ₹100 base price
  const reserveNeeded = Math.max(0, slotsRemaining - 1) * 100;
  const maxSafeBid = Math.max(100, remainingPurse - reserveNeeded);

  // Interactive Simulator State: Target bid slider
  const [simulatedBid, setSimulatedBid] = useState<number>(() => Math.min(maxSafeBid, 1000));

  // Role counts
  const battersCount = players.filter((p) => p.role === 'batter').length;
  const bowlersCount = players.filter((p) => p.role === 'bowler').length;
  const allRoundersCount = players.filter((p) => p.role === 'all_rounder').length;
  const keepersCount = players.filter((p) => p.role === 'wicket_keeper').length;

  // 1. SPIDER / RADAR GRAPH: Squad Capability Balance
  const spiderData = useMemo(() => {
    // Batting Score (Target: 3-4 quality batters)
    const battingScore = Math.min(100, Math.round((battersCount / 3) * 70 + (allRoundersCount > 0 ? 30 : 0)));
    // Bowling Score (Target: 3-4 frontline bowlers)
    const bowlingScore = Math.min(100, Math.round((bowlersCount / 3) * 70 + (allRoundersCount > 0 ? 30 : 0)));
    // All-Round Score (Target: 2-3 all-rounders)
    const allRoundScore = Math.min(100, Math.round((allRoundersCount / 2) * 100));
    // Glovework Score (At least 1 specialist keeper)
    const keeperScore = keepersCount >= 1 ? 100 : 25;
    // Purse Health (Ratio of remaining purse to initial purse, with baseline)
    const purseHealthScore = Math.min(100, Math.max(10, Math.round((remainingPurse / initialPurse) * 100)));
    // Squad Completion (Target: 10 players)
    const squadFillScore = Math.min(100, Math.round((slotsFilled / 10) * 100));

    return [
      { dimension: 'Batting Depth', score: battingScore, benchmark: 75 },
      { dimension: 'Bowling Firepower', score: bowlingScore, benchmark: 75 },
      { dimension: 'All-Rounders', score: allRoundScore, benchmark: 60 },
      { dimension: 'Glovework', score: keeperScore, benchmark: 80 },
      { dimension: 'Purse Health', score: purseHealthScore, benchmark: 50 },
      { dimension: 'Squad Fill', score: squadFillScore, benchmark: 50 },
    ];
  }, [battersCount, bowlersCount, allRoundersCount, keepersCount, remainingPurse, initialPurse, slotsFilled]);

  // 2. FRANCHISE FINANCIAL LANDSCAPE: Side-by-Side Comparison
  const franchiseComparisonData = useMemo(() => {
    const list = [
      {
        name: myTeam.name,
        shortName: myTeam.name.length > 12 ? myTeam.name.slice(0, 10) + '..' : myTeam.name,
        remaining: remainingPurse,
        spent: totalSpent,
        isMyTeam: true,
        squadSize: slotsFilled,
      },
      ...otherTeams.map((t) => ({
        name: t.teamName,
        shortName: t.teamName.length > 12 ? t.teamName.slice(0, 10) + '..' : t.teamName,
        remaining: t.remainingPurse,
        spent: t.totalSpent,
        isMyTeam: false,
        squadSize: t.soldPlayers,
      })),
    ];
    // Sort by remaining purse descending
    return list.sort((a, b) => b.remaining - a.remaining);
  }, [myTeam, otherTeams, remainingPurse, totalSpent, slotsFilled]);

  // Top competitor with highest remaining purse
  const topRival = useMemo(() => {
    const rivals = otherTeams.slice().sort((a, b) => b.remainingPurse - a.remainingPurse);
    return rivals[0] || null;
  }, [otherTeams]);

  // 3. SQUAD EXPENDITURE DONUT CHART
  const roleExpenditureData = useMemo(() => {
    const batterSpent = players
      .filter((p) => p.role === 'batter')
      .reduce((sum, p) => sum + (Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 0), 0);

    const bowlerSpent = players
      .filter((p) => p.role === 'bowler')
      .reduce((sum, p) => sum + (Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 0), 0);

    const allRounderSpent = players
      .filter((p) => p.role === 'all_rounder')
      .reduce((sum, p) => sum + (Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 0), 0);

    const keeperSpent = players
      .filter((p) => p.role === 'wicket_keeper')
      .reduce((sum, p) => sum + (Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 0), 0);

    const items = [
      { name: 'Batters', value: batterSpent, color: ROLE_COLORS.batter, count: battersCount },
      { name: 'Bowlers', value: bowlerSpent, color: ROLE_COLORS.bowler, count: bowlersCount },
      { name: 'All-Rounders', value: allRounderSpent, color: ROLE_COLORS.all_rounder, count: allRoundersCount },
      { name: 'Wicket-Keepers', value: keeperSpent, color: ROLE_COLORS.wicket_keeper, count: keepersCount },
      { name: 'Unspent Purse', value: remainingPurse, color: ROLE_COLORS.unspent, count: slotsRemaining },
    ].filter((item) => item.value > 0);

    return items;
  }, [players, battersCount, bowlersCount, allRoundersCount, keepersCount, remainingPurse, slotsRemaining]);

  // 4. ACQUISITIONS VELOCITY (Drafted players list for timeline bar chart)
  const acquisitionsTimelineData = useMemo(() => {
    return players.map((p, idx) => ({
      index: `#${idx + 1}`,
      name: p.name,
      shortName: p.name.length > 10 ? p.name.slice(0, 9) + '..' : p.name,
      price: Number(p.soldPrice || p.sold_price || p.basePrice || p.base_price) || 100,
      basePrice: Number(p.basePrice || p.base_price) || 100,
      role: p.role,
    }));
  }, [players]);

  // Simulator post-bid calculation
  const postBidPurse = Math.max(0, remainingPurse - simulatedBid);
  const isBidSafe = simulatedBid <= maxSafeBid && slotsRemaining > 0;
  const isOverBid = simulatedBid > maxSafeBid;

  return (
    <div className="space-y-6">
      {/* TOP TACTICAL INSIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Max Safe Bid */}
        <Card className="border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-card rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Max Safe Bid
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                1 Marquee
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground font-mono">
              ₹{maxSafeBid.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Guarantees ₹{reserveNeeded.toLocaleString()} reserve for remaining {slotsRemaining} slot{slotsRemaining === 1 ? '' : 's'}.
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Remaining Purse Headroom */}
        <Card className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-card to-card rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" /> Purse Headroom
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">
                {Math.round((remainingPurse / initialPurse) * 100)}% Left
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              ₹{remainingPurse.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Spent ₹{totalSpent.toLocaleString()} across {slotsFilled} acquired player{slotsFilled === 1 ? '' : 's'}.
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Top Rival Challenge */}
        <Card className="border border-blue-500/30 bg-gradient-to-br from-blue-500/15 via-card to-card rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-400" /> Rival Purse Leader
              </span>
              <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">
                Competitor
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topRival ? (
              <>
                <div className="text-xl font-black text-foreground truncate" title={topRival.teamName}>
                  {topRival.teamName}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                  Holds <span className="text-blue-300 font-bold">₹{topRival.remainingPurse.toLocaleString()}</span> ({topRival.soldPlayers}/10 squad)
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No rivals registered</div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Squad Balance Status */}
        <Card className="border border-purple-500/30 bg-gradient-to-br from-purple-500/15 via-card to-card rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" /> Squad Balance
              </span>
              <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300">
                {slotsFilled}/10 Drafted
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-black text-foreground flex items-center gap-1.5">
              <span>{battersCount}B</span>
              <span className="text-muted-foreground">•</span>
              <span>{bowlersCount}BW</span>
              <span className="text-muted-foreground">•</span>
              <span>{allRoundersCount}AR</span>
              <span className="text-muted-foreground">•</span>
              <span>{keepersCount}WK</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {keepersCount === 0 ? '⚠️ Specialist Wicket-Keeper needed' : '✅ Specialist keeper secured'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: SPIDER / RADAR GRAPH + WHAT-IF BID SLIDER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SPIDER / RADAR GRAPH: Squad Capability Matrix (7 cols on lg) */}
        <Card className="lg:col-span-7 border border-white/10 bg-card/85 backdrop-blur-xl rounded-3xl shadow-xl flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <span className="text-amber-400">🕸️</span> Squad Capability Spider Graph
                </CardTitle>
                <CardDescription className="text-xs">
                  Multi-dimensional balance analysis across batting, bowling, all-rounders, glovework, and financial health.
                </CardDescription>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 font-bold border-amber-500/30 self-start sm:self-auto">
                {myTeam.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center pt-2">
            <div className="w-full h-[320px] sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={spiderData}>
                  <PolarGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <Radar
                    name="Benchmark"
                    dataKey="benchmark"
                    stroke="#64748b"
                    fill="#64748b"
                    fillOpacity={0.15}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name={myTeam.name}
                    dataKey="score"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.45}
                    strokeWidth={2.5}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-300 font-semibold">{val}</span>}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
                            <p className="font-bold text-amber-300 text-sm mb-1">{data.dimension}</p>
                            <p className="text-slate-200">
                              Current Rating:{' '}
                              <span className="font-mono font-bold text-white text-sm">{data.score}/100</span>
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              Tournament Benchmark: {data.benchmark}/100
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-white/10 text-center text-xs">
              <div className="bg-white/[0.03] rounded-xl p-2">
                <span className="text-muted-foreground block text-[10px] uppercase">Batting Firepower</span>
                <span className="font-bold text-sky-400 text-sm">{spiderData[0].score}%</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2">
                <span className="text-muted-foreground block text-[10px] uppercase">Pace & Spin</span>
                <span className="font-bold text-emerald-400 text-sm">{spiderData[1].score}%</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2">
                <span className="text-muted-foreground block text-[10px] uppercase">Purse Health</span>
                <span className="font-bold text-amber-400 text-sm">{spiderData[4].score}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* INTERACTIVE BID PLANNER SLIDER GRAPH (5 cols on lg) */}
        <Card className="lg:col-span-5 border border-white/10 bg-card/85 backdrop-blur-xl rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Auction Bid Slider Simulator
                </CardTitle>
                <Badge variant={isBidSafe ? 'outline' : 'destructive'} className="text-[10px] font-bold">
                  {isBidSafe ? 'SAFE' : 'HIGH RISK'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Slide to test a proposed bid amount on the next marquee player and project its impact on your wallet and remaining quota.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Slider Control */}
              <div className="space-y-3 bg-white/[0.03] border border-white/10 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">Test Next Player Bid:</span>
                  <span className="font-mono text-xl font-black text-amber-400">
                    ₹{simulatedBid.toLocaleString()}
                  </span>
                </div>

                <Slider
                  value={[simulatedBid]}
                  min={100}
                  max={Math.max(100, remainingPurse)}
                  step={50}
                  onValueChange={(val) => setSimulatedBid(val[0])}
                  className="py-2"
                />

                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>Base: ₹100</span>
                  <span>Safe Cap: ₹{maxSafeBid.toLocaleString()}</span>
                  <span>Max: ₹{remainingPurse.toLocaleString()}</span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-muted-foreground self-center mr-1">Presets:</span>
                  {[200, 500, 1000, 2500].map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant="outline"
                      onClick={() => setSimulatedBid(Math.min(amt, remainingPurse))}
                      disabled={amt > remainingPurse}
                      className="h-6 text-[10px] px-2 rounded-lg border-white/10 bg-white/[0.04] hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      ₹{amt}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSimulatedBid(maxSafeBid)}
                    className="h-6 text-[10px] px-2 rounded-lg border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 font-bold"
                  >
                    Max Safe (₹{maxSafeBid})
                  </Button>
                </div>
              </div>

              {/* Simulation Result Gauges */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                    <span className="text-muted-foreground block text-[10px]">Projected Remaining Purse</span>
                    <span className="text-lg font-black font-mono text-emerald-400">
                      ₹{postBidPurse.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                    <span className="text-muted-foreground block text-[10px]">Slots Remaining After Pick</span>
                    <span className="text-lg font-black font-mono text-blue-400">
                      {Math.max(0, slotsRemaining - 1)} Slots
                    </span>
                  </div>
                </div>

                {/* Risk / Safety Assessment Message */}
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
                    isOverBid
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  {isOverBid ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {isOverBid ? 'Budget Risk Warning' : 'Safe Auction Strategy'}
                    </span>
                    <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                      {isOverBid
                        ? `A bid of ₹${simulatedBid.toLocaleString()} will leave only ₹${postBidPurse.toLocaleString()}, which is below the ₹${reserveNeeded.toLocaleString()} required to draft remaining ${slotsRemaining} players.`
                        : `Bidding ₹${simulatedBid.toLocaleString()} leaves ₹${postBidPurse.toLocaleString()}, preserving adequate budget (₹${reserveNeeded.toLocaleString()} reserve) to complete your 10-player roster.`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>

          <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 rounded-b-3xl text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>KAPL 3.0 rule: Every franchise must reach 10 drafted players by auction close.</span>
          </div>
        </Card>
      </div>

      {/* SECTION 2: FRANCHISE FINANCIAL LANDSCAPE (SIDE-BY-SIDE BARS) + SQUAD ROLE EXPENDITURE DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FRANCHISE FINANCIAL LANDSCAPE: Side-by-Side Comparison (8 cols on lg) */}
        <Card className="lg:col-span-8 border border-white/10 bg-card/85 backdrop-blur-xl rounded-3xl shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" /> Franchise Purchasing Power Comparison
                </CardTitle>
                <CardDescription className="text-xs">
                  Remaining purse vs total spent across all rival franchises (Ordered by purchasing power).
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Remaining
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Spent
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[300px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={franchiseComparisonData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                  barSize={18}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `₹${val / 1000}k`}
                    domain={[0, 10000]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-white/20 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-foreground text-sm mb-1.5">
                              {data.isMyTeam && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                              <span>{data.name}</span>
                              {data.isMyTeam && (
                                <Badge className="bg-amber-500 text-slate-950 text-[9px] px-1 py-0">YOU</Badge>
                              )}
                            </div>
                            <div className="space-y-1 font-mono">
                              <p className="text-emerald-400">
                                Remaining Purse: <span className="font-bold">₹{data.remaining.toLocaleString()}</span>
                              </p>
                              <p className="text-amber-400">
                                Total Spent: <span className="font-bold">₹{data.spent.toLocaleString()}</span>
                              </p>
                              <p className="text-slate-300">
                                Squad Acquired: <span className="font-bold text-white">{data.squadSize}/10</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="remaining" name="Remaining Purse" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {franchiseComparisonData.map((entry, index) => (
                      <Cell
                        key={`cell-rem-${index}`}
                        fill={entry.isMyTeam ? '#34d399' : '#10b981'}
                        stroke={entry.isMyTeam ? '#f59e0b' : 'none'}
                        strokeWidth={entry.isMyTeam ? 2 : 0}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="spent" name="Total Spent" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    {franchiseComparisonData.map((entry, index) => (
                      <Cell
                        key={`cell-spent-${index}`}
                        fill={entry.isMyTeam ? '#fbbf24' : '#d97706'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* SQUAD ROLE & EXPENDITURE DONUT (4 cols on lg) */}
        <Card className="lg:col-span-4 border border-white/10 bg-card/85 backdrop-blur-xl rounded-3xl shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <span className="text-amber-400">🪙</span> Budget Allocation Donut
            </CardTitle>
            <CardDescription className="text-xs">
              Breakdown of spending by player role plus unallocated wallet funds.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleExpenditureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {roleExpenditureData.map((entry, index) => (
                      <Cell key={`donut-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-xs">
                            <p className="font-bold text-foreground mb-1">{data.name}</p>
                            <p className="text-amber-400 font-mono font-bold">₹{data.value.toLocaleString()}</p>
                            <p className="text-muted-foreground text-[10px]">
                              {Math.round((data.value / initialPurse) * 100)}% of total budget
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Breakdown list */}
            <div className="w-full space-y-1.5 pt-2 border-t border-white/10 text-xs">
              {roleExpenditureData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-foreground">₹{item.value.toLocaleString()}</span>
                    <span className="text-muted-foreground text-[10px]">
                      ({Math.round((item.value / initialPurse) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3: ACQUISITIONS VELOCITY & PRICE PAID BAR CHART */}
      {players.length > 0 && (
        <Card className="border border-white/10 bg-card/85 backdrop-blur-xl rounded-3xl shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" /> Player Acquisition Price Velocity
                </CardTitle>
                <CardDescription className="text-xs">
                  Chronological record of winning hammer prices paid for each acquired squad member.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300">
                Average Paid: ₹{Math.round(totalSpent / Math.max(1, players.length)).toLocaleString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={acquisitionsTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
                            <p className="font-bold text-amber-300 text-sm">{data.name}</p>
                            <Badge variant="outline" className="capitalize text-[10px] my-1">
                              {data.role?.replace('_', ' ')}
                            </Badge>
                            <div className="space-y-0.5 font-mono mt-1 text-slate-200">
                              <p>Winning Price: <span className="font-bold text-emerald-400">₹{data.price.toLocaleString()}</span></p>
                              <p className="text-muted-foreground text-[10px]">Base Price: ₹{data.basePrice.toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="price" name="Acquisition Price" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                    {acquisitionsTimelineData.map((entry, index) => (
                      <Cell
                        key={`cell-price-${index}`}
                        fill={ROLE_COLORS[entry.role] || '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
