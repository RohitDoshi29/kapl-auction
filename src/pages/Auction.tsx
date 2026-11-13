import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuction } from '@/hooks/useAuction';
import { useTournament } from '@/contexts/TournamentContext';
import { Header } from '@/components/cricket/Header';
import { SinglePlayerAuctionStage } from '@/components/auction/SinglePlayerAuctionStage';
import { CategoryPlayerGrid } from '@/components/auction/CategoryPlayerGrid';
import { TeamPurseList } from '@/components/auction/TeamPurseList';
import { AdminAuctionDesk } from '@/components/auction/AdminAuctionDesk';
import { ExportRegistrationsDialog } from '@/components/cricket/ExportRegistrationsDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { Gavel, Wallet, Users, Radio, Sparkles, RotateCcw, Trash2, Zap, FileSpreadsheet } from 'lucide-react';

export default function Auction() {
  const { activeTournamentId, setActiveTournamentId } = useTournament();
  const [activeTab, setActiveTab] = useState<'spotlight' | 'categories' | 'teams' | 'admin'>('spotlight');
  const [isResetting, setIsResetting] = useState(false);

  const {
    currentPlayer,
    playerPool,
    teams,
    isLoading,
    isAdmin,
    selectedCategory,
    setSelectedCategory,
    spotlightPlayer,
    nextPlayer,
    placeBid,
    auctionState,
    adminDecideSold,
    adminDecideUnsold,
    revertPlayerStatus,
    addPlayerToAuction,
    removePlayerFromAuction,
    startAcceleratedUnsoldRound,
    autoAdvanceCountdown,
    cancelAutoAdvance,
    isAutoAdvanceEnabled,
    setIsAutoAdvanceEnabled,
    salesHistory,
    initializeAuctionData,
    clearAllPlayers,
  } = useAuction(activeTournamentId || 'kapl-3-mens');

  const handleResetAuctionData = async () => {
    setIsResetting(true);
    try {
      const res = await initializeAuctionData();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
    } catch (e: any) {
      toast.error('Failed to reset auction data: ' + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleClearAllPlayers = async () => {
    setIsResetting(true);
    try {
      const res = await clearAllPlayers();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || 'Failed to clear players');
      }
    } catch (e: any) {
      toast.error('Failed to clear players: ' + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleTournamentChange = (newTournament: string) => {
    setActiveTournamentId(newTournament);
  };

  const isAllSold = playerPool.length > 0 && playerPool.every((p) => p.auctionStatus === 'sold');

  return (
    <div className="relative min-h-screen bg-background pb-8">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-3 sm:py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Tournament Switcher & Live Status Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 flex items-center justify-center shadow-xs shrink-0">
              <Gavel className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-2xl font-black text-foreground flex flex-wrap items-center gap-1.5 sm:gap-2 font-display tracking-tight">
                Live Player <span className="text-gradient-gold">Auction Room</span>
                <Badge variant="gold" className="text-[9px] sm:text-[10px] font-black tracking-wider px-1.5 sm:px-2">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-300" /> KAPL 3.0
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Category bidding • Player spotlight • Team purse budgets
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">

            <ExportRegistrationsDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-bold border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 gap-1.5 shadow-sm touch-manipulation"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Export to Excel / Text</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              }
            />

            {isAdmin && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isResetting || playerPool.length === 0}
                      className="min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-bold border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-1.5 touch-manipulation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden sm:inline">Clear Players</span>
                      <span className="sm:hidden">Clear</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove All Players from Auction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {playerPool.length} player{playerPool.length === 1 ? '' : 's'} from this auction division, empty team squads, and restore every franchise purse to ₹10,000.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAllPlayers}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Remove All Players
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isResetting}
                      className="min-h-[44px] sm:min-h-0 sm:h-9 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5 touch-manipulation"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Bids &amp; Franchise Purses?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will:
                        <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                          <li>Reset all {playerPool.length} current auction players back to Pending status</li>
                          <li>Clear all team rosters (0 players allocated)</li>
                          <li>Restore each team&apos;s purse to full ₹10,000</li>
                          <li>Clear recent bid history and restart spotlight</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetAuctionData}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                      >
                        Confirm Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* Live or Completed Indicator */}
            {isAllSold ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full text-xs font-black shadow-xs tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {playerPool.length}/{playerPool.length} SOLD
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-black shadow-xs tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                LIVE AUCTION
              </span>
            )}

            {/* Division Switcher */}
            <div className="flex items-center bg-white/[0.04] border border-white/10 p-0.5 rounded-xl text-xs font-semibold backdrop-blur-sm">
              <button
                onClick={() => handleTournamentChange('kapl-3-mens')}
                className={`px-3.5 py-2 min-h-[44px] rounded-lg transition-all touch-manipulation ${
                  activeTournamentId === 'kapl-3-mens'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Men's
              </button>
              <button
                onClick={() => handleTournamentChange('kapl-3-womens')}
                className={`px-3.5 py-2 min-h-[44px] rounded-lg transition-all touch-manipulation ${
                  activeTournamentId === 'kapl-3-womens'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Women's
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as any);
            if (val === 'categories') {
              setSelectedCategory('all');
            }
          }}
          className="w-full space-y-4 md:space-y-6"
        >
          <TabsList className={`flex w-full items-center justify-start sm:grid ${isAdmin ? 'max-w-2xl sm:grid-cols-4' : 'max-w-md sm:grid-cols-3'} gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mx-auto bg-white/[0.04] border border-white/10 rounded-2xl p-1 backdrop-blur-md`}>
            <TabsTrigger value="spotlight" className="shrink-0 sm:shrink flex-none sm:flex-1 gap-1 sm:gap-1.5 text-xs md:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35 touch-manipulation">
              <Gavel className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span>Spotlight</span><span className="hidden sm:inline">&nbsp;Stage</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="shrink-0 sm:shrink flex-none sm:flex-1 gap-1 sm:gap-1.5 text-xs md:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35 touch-manipulation">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span>Categories</span><span className="text-[10px] opacity-80 ml-0.5">({playerPool.length})</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="shrink-0 sm:shrink flex-none sm:flex-1 gap-1 sm:gap-1.5 text-xs md:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35 touch-manipulation">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span>Purses</span><span className="text-[10px] opacity-80 ml-0.5">({teams.length})</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="shrink-0 sm:shrink flex-none sm:flex-1 gap-1 sm:gap-1.5 text-xs md:text-sm font-black rounded-xl min-h-[44px] px-3 sm:px-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/25 data-[state=active]:to-yellow-500/20 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/40 text-amber-400/90 touch-manipulation"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse shrink-0" />
                <span>Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: Single Player Spotlight Stage */}
          <TabsContent value="spotlight" className="space-y-6">
            <SinglePlayerAuctionStage
              player={currentPlayer}
              playerPool={playerPool}
              teams={teams}
              isAdmin={isAdmin}
              tournamentId={activeTournamentId}
              onAddPlayer={addPlayerToAuction}
              onResetAuction={handleResetAuctionData}
              onNext={() => nextPlayer('next')}
              onPrev={() => nextPlayer('prev')}
              onSpotlightPlayer={spotlightPlayer}
              onPlaceBid={placeBid}
              currentBid={auctionState?.currentBid}
              highestBidderTeamId={auctionState?.highestBidderTeamId}
              onDecideSold={adminDecideSold}
              onDecideUnsold={adminDecideUnsold}
              onRevert={revertPlayerStatus}
              salesHistory={salesHistory}
              autoAdvanceCountdown={autoAdvanceCountdown}
              onCancelAutoAdvance={cancelAutoAdvance}
            />

            {/* Category Players Bar Below Spotlight for Quick Navigation */}
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Browse Category Players
              </h3>
              <CategoryPlayerGrid
                players={playerPool}
                teams={teams}
                selectedCategory={selectedCategory}
                selectedPlayerId={currentPlayer?.id}
                onSelectCategory={setSelectedCategory}
                onSelectPlayer={(p) => spotlightPlayer(p)}
              />
            </div>
          </TabsContent>

          {/* TAB 2: Full Category-Wise Players Display */}
          <TabsContent value="categories" className="space-y-4">
            <CategoryPlayerGrid
              players={playerPool}
              teams={teams}
              selectedCategory={selectedCategory}
              selectedPlayerId={currentPlayer?.id}
              onSelectCategory={setSelectedCategory}
              onSelectPlayer={(p) => {
                spotlightPlayer(p);
                setActiveTab('spotlight');
              }}
            />
          </TabsContent>

          {/* TAB 3: Team Purses & Quotas */}
          <TabsContent value="teams">
            <TeamPurseList teams={teams} playerPool={playerPool} />
          </TabsContent>

          {/* TAB 4: Admin Auction Desk (Set Auction Player-by-Player) */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminAuctionDesk
                playerPool={playerPool}
                teams={teams}
                currentPlayer={currentPlayer}
                tournamentId={activeTournamentId}
                onAddPlayer={addPlayerToAuction}
                onSpotlightPlayer={spotlightPlayer}
                onDecideSold={adminDecideSold}
                onDecideUnsold={adminDecideUnsold}
                onRevertStatus={revertPlayerStatus}
                onRemovePlayer={removePlayerFromAuction}
                onResetAuction={handleResetAuctionData}
                onClearAllPlayers={handleClearAllPlayers}
                salesHistory={salesHistory}
                onStartAcceleratedRound={startAcceleratedUnsoldRound}
                autoAdvanceCountdown={autoAdvanceCountdown}
                onCancelAutoAdvance={cancelAutoAdvance}
                isAutoAdvanceEnabled={isAutoAdvanceEnabled}
                onToggleAutoAdvance={setIsAutoAdvanceEnabled}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
