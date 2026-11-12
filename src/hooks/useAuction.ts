import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerRecord, Team, AuctionState, BidHistoryEntry, PlayerRole, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';
import { formatPlayerRole, getTournamentPlayerId } from '@/lib/utils';
import { useAuth, isValidUuid, syncPlayerToAuctionAndTournament } from '@/contexts/AuthContext';
import { saveToPlayerVault, removePlayerFromLocalStores, clearLocalPlayersForTournament } from '@/lib/exportRegistrations';
import { toast } from 'sonner';
import { playAuctionGavel } from '@/lib/soundEffects';
import { triggerQuickBurst } from '@/lib/confetti';

export const AUCTION_CATEGORIES: { id: PlayerRole | 'all'; label: string; icon: string; description: string }[] = [
  { id: 'all', label: 'All Players', icon: '🌟', description: 'Complete roster of tournament candidates' },
  { id: 'batter', label: 'Batters', icon: '🏏', description: 'Top and middle order run-scorers' },
  { id: 'bowler', label: 'Bowlers', icon: '⚡', description: 'Pace spearheads and strike spinners' },
  { id: 'all_rounder', label: 'All-Rounders', icon: '👑', description: 'Impact players with both bat and ball' },
  { id: 'wicket_keeper', label: 'Wicket-Keepers', icon: '🧤', description: 'Specialist keepers and finishers' },
];

function loadLocalRegAndVault(): PlayerRecord[] {
  if (typeof window === 'undefined') return [];
  let regList: PlayerRecord[] = [];
  try {
    const regRaw = localStorage.getItem('kapl_registered_players');
    if (regRaw) {
      const parsed = JSON.parse(regRaw);
      if (Array.isArray(parsed)) {
        regList = parsed.filter((p: any) => p && (p.id || p.name));
      }
    }
  } catch {}

  try {
    const vaultRaw = localStorage.getItem('kapl_player_vault');
    if (vaultRaw) {
      const vaultList: PlayerRecord[] = JSON.parse(vaultRaw);
      if (Array.isArray(vaultList)) {
        vaultList.forEach((vp) => {
          if (
            vp &&
            (vp.id || vp.name) &&
            !regList.some(
              (r) =>
                r.id === vp.id ||
                (r.userId && vp.userId && r.userId === vp.userId) ||
                (r.name && vp.name && r.name.toLowerCase() === vp.name.toLowerCase())
            )
          ) {
            regList.push(vp);
          }
        });
      }
    }
  } catch {}

  return regList;
}

function mergeRegisteredPlayers(
  baseList: PlayerRecord[],
  regList: PlayerRecord[],
  targetTournamentId: string
): PlayerRecord[] {
  const merged = [...baseList];
  regList.forEach((reg) => {
    if (!reg) return;
    if (reg.tournamentId && reg.tournamentId !== 'all' && reg.tournamentId !== targetTournamentId) {
      return;
    }
    const expectedId = getTournamentPlayerId(reg.id, targetTournamentId, reg.name);
    if (!expectedId) return;

    const existingIdx = merged.findIndex(
      (p) =>
        p.id === expectedId ||
        p.id === reg.id ||
        (p.userId && reg.userId && p.userId === reg.userId) ||
        (p.name && reg.name && p.name.toLowerCase() === reg.name.toLowerCase())
    );

    const candidateDefaults: PlayerRecord = {
      ...reg,
      id: expectedId,
      tournamentId: targetTournamentId,
      basePrice: Number(reg.basePrice || 100),
      auctionStatus: reg.auctionStatus || 'pending',
    };

    if (existingIdx >= 0) {
      // Preserve existing auction status, team assignment, and sold price from DB/cache
      merged[existingIdx] = {
        ...candidateDefaults,
        ...merged[existingIdx],
        id: merged[existingIdx].id || expectedId,
        tournamentId: targetTournamentId,
      };
    } else {
      merged.push(candidateDefaults);
    }
  });
  return merged;
}

function filterValidSales(raw: unknown, validPlayers?: PlayerRecord[]): AuctionSaleLog[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((s: any) => s && typeof s === 'object' && (s.id || s.playerName));
  if (!validPlayers) return valid;
  if (validPlayers.length === 0) return [];
  return valid.filter((s) =>
    validPlayers.some(
      (p) =>
        p.id === s.playerId ||
        (p.name && s.playerName && p.name.toLowerCase() === s.playerName.toLowerCase())
    )
  );
}

export interface AuctionSaleLog {
  id: string;
  playerId: string;
  playerName: string;
  playerRole: PlayerRole;
  teamId?: string | null;
  teamName?: string | null;
  teamLogo?: string | null;
  teamColor?: string | null;
  amount: number;
  status: 'sold' | 'unsold';
  timestamp: number;
}

let sharedAuctionBroadcastChannel: any = null;
let sharedAuctionTabSync: BroadcastChannel | null = null;
let sharedSharedTabSync: BroadcastChannel | null = null;
let broadcastChannelSupported = false;

function initializeBroadcastChannels() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return false;
  }

  try {
    sharedAuctionTabSync = new BroadcastChannel('kapl_auction_tab_sync');
    sharedSharedTabSync = new BroadcastChannel('kapl-shared-tab-channel');
    broadcastChannelSupported = true;
    return true;
  } catch (err) {
    console.warn('BroadcastChannel initialization failed, cross-tab sync disabled:', err);
    return false;
  }
}

initializeBroadcastChannels();

export function useAuction(initialTournamentId: string = 'kapl-3-mens') {
  const { user, userRole, isAdmin } = useAuth();
  const [tournamentId, setTournamentId] = useState<string>(initialTournamentId);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);

  // Initialize pool from cached auction state & registered candidates
  const [playerPool, setPlayerPool] = useState<PlayerRecord[]>(() => {
    try {
      const regList = loadLocalRegAndVault();
      let baseList: PlayerRecord[] = [];
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`kapl_auction_players_${initialTournamentId}`) : null;
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          baseList = parsed.filter((p: any) => p && (p.id || p.name) && !/^[ab][1-4]-/.test(p.id || ''));
        }
      }

      if (regList.length > 0) {
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem(`kapl_everything_reset_${initialTournamentId}`);
        } catch {}
        baseList = mergeRegisteredPlayers(baseList, regList, initialTournamentId);
      }

      return baseList;
    } catch {}
    return [];
  });

  const [currentPlayer, setCurrentPlayer] = useState<PlayerRecord | null>(() => {
    try {
      const regList = loadLocalRegAndVault();
      const activeId = typeof window !== 'undefined' ? localStorage.getItem(`kapl_auction_active_player_${initialTournamentId}`) : null;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`kapl_auction_players_${initialTournamentId}`) : null;
      let list: PlayerRecord[] = [];
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((p: any) => p && (p.id || p.name) && !/^[ab][1-4]-/.test(p.id || ''));
        }
      }
      if (regList.length > 0) {
        list = mergeRegisteredPlayers(list, regList, initialTournamentId);
      }

      if (activeId) {
        const found = list.find((p: any) => p.id === activeId);
        if (found) return found;
      }
      if (list.length > 0) {
        return list.find((p) => p.auctionStatus === 'pending') || list[0] || null;
      }
      return null;
    } catch {}
    return null;
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const fallback = initialTournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      const isReset = localStorage.getItem(`kapl_auction_manually_reset_${initialTournamentId}`) === 'true';
      if (isCleared || isReset) {
        return fallback.map(t => ({ ...t, initialPurse: 10000, remainingPurse: 10000, players: [], playerCount: 0 }));
      }
      const raw = localStorage.getItem(`kapl_auction_teams_${initialTournamentId}`);
      if (raw) {
        const parsed: Team[] = JSON.parse(raw);
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return fallback.map(t => ({ ...t, initialPurse: 10000, remainingPurse: 10000, players: [], playerCount: 0 }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlayerRole | 'all'>('all');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [salesHistory, setSalesHistory] = useState<AuctionSaleLog[]>(() => {
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      const isReset = localStorage.getItem(`kapl_auction_manually_reset_${initialTournamentId}`) === 'true';
      if (isCleared || isReset) return [];
      const raw = localStorage.getItem(`kapl_auction_sales_${initialTournamentId}`);
      if (raw) {
        const parsed = filterValidSales(JSON.parse(raw));
        if (parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const lastAddedPlayerIdRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDataDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance celebration countdown state & refs
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState<boolean>(true);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
    setAutoAdvanceCountdown(null);
  }, []);

  useEffect(() => {
    if (initialTournamentId !== tournamentId) {
      setTournamentId(initialTournamentId);
    }
  }, [initialTournamentId, tournamentId]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch auction state for this tournament
      const { data: stateData, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .maybeSingle();

      if (stateError) throw stateError;

      let activePlayerId: string | null = null;

      if (stateData) {
        const state: AuctionState = {
          id: stateData.id,
          tournamentId: stateData.tournament_id,
          currentPlayerId: stateData.current_player_id,
          currentBid: Number(stateData.current_bid || 0),
          highestBidderTeamId: stateData.highest_bidder_team_id,
          bidHistory: (stateData.bid_history as unknown as BidHistoryEntry[]) || [],
          status: stateData.status as any,
          timerEndsAt: stateData.timer_ends_at,
          updatedAt: stateData.updated_at,
        };
        setAuctionState(state);
        activePlayerId = state.currentPlayerId || null;
      }

      // 2. Fetch non-legacy players from Supabase (public safe columns)
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('id, name, photo_url, role, batting_style, bowling_style, tournament_id, team_id, jersey_number, base_price, sold_price, auction_status')
        .order('name');

      if (playersError) throw playersError;

      let mappedPlayers: PlayerRecord[] = (allPlayers || [])
        .filter((p: any) => {
          if (!p || !p.name || /^[ab][1-4]-/.test(p.id)) return false;
          if (p.tournament_id && p.tournament_id !== tournamentId && p.tournament_id !== 'all') {
            return false;
          }
          return true;
        })
        .map((p: any) => ({
          id: p.id,
          userId: p.user_id || undefined,
          tournamentId: tournamentId,
          teamId: p.team_id,
          name: p.name,
          role: (p.role as PlayerRole) || 'all_rounder',
          battingStyle: p.batting_style || undefined,
          bowlingStyle: p.bowling_style || undefined,
          photoUrl: p.photo_url,
          basePrice: Number(p.base_price || 100),
          soldPrice: p.sold_price ? Number(p.sold_price) : null,
          auctionStatus: p.auction_status || 'pending',
          jerseyNumber: p.jersey_number,
          mobileNumber: (p as any).mobile_number || null,
        }));

      // Cache all remote DB players into local vault (preserving original tournamentId such as 'all')
      (allPlayers || []).forEach((rawPlayer: any) => {
        if (!rawPlayer || !rawPlayer.name || /^[ab][1-4]-/.test(rawPlayer.id)) return;
        if (rawPlayer.tournament_id && rawPlayer.tournament_id !== tournamentId && rawPlayer.tournament_id !== 'all') {
          return;
        }
        saveToPlayerVault({
          id: rawPlayer.id,
          userId: rawPlayer.user_id || undefined,
          tournamentId: rawPlayer.tournament_id || tournamentId,
          teamId: rawPlayer.team_id,
          name: rawPlayer.name,
          role: (rawPlayer.role as PlayerRole) || 'all_rounder',
          battingStyle: rawPlayer.batting_style || undefined,
          bowlingStyle: rawPlayer.bowling_style || undefined,
          photoUrl: rawPlayer.photo_url,
          basePrice: Number(rawPlayer.base_price || 100),
          soldPrice: rawPlayer.sold_price ? Number(rawPlayer.sold_price) : null,
          auctionStatus: rawPlayer.auction_status || 'pending',
          jerseyNumber: rawPlayer.jersey_number,
          mobileNumber: rawPlayer.mobile_number || null,
        });
      });

      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${tournamentId}`) === 'true'
      );

      const regList = loadLocalRegAndVault();

      if (mappedPlayers.length > 0 || regList.length > 0) {
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
        } catch {}
      } else if (isCleared) {
        setPlayerPool([]);
        setCurrentPlayer(null);
        setAuctionState({
          id: tournamentId,
          tournamentId,
          currentPlayerId: null,
          currentBid: 100,
          highestBidderTeamId: null,
          bidHistory: [],
          status: 'idle',
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
        });
        setTeams((tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t) => ({
          ...t,
          initialPurse: 10000,
          remainingPurse: 10000,
          players: [],
          playerCount: 0,
        })));
        setSalesHistory([]);
        setIsLoading(false);
        return;
      }

      if (mappedPlayers.length === 0) {
        let cachedPlayers: PlayerRecord[] = [];
        try {
          const raw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              cachedPlayers = parsed.filter((p: any) => p && !/^[ab][1-4]-/.test(p.id));
            }
          }
        } catch {}

        mappedPlayers = cachedPlayers;
      } else {
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
        } catch {}
      }

      // Merge all user-registered players from kapl_registered_players and vault into mappedPlayers
      if (regList.length > 0) {
        mappedPlayers = mergeRegisteredPlayers(mappedPlayers, regList, tournamentId);
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
        } catch {}
      }

      if (mappedPlayers.length > 0 && mappedPlayers.every((p) => p.auctionStatus === 'sold')) {
        setAuctionState((prev) => ({
          id: tournamentId,
          tournamentId,
          currentPlayerId: mappedPlayers[mappedPlayers.length - 1]?.id || null,
          currentBid: mappedPlayers[mappedPlayers.length - 1]?.soldPrice || 350,
          highestBidderTeamId: mappedPlayers[mappedPlayers.length - 1]?.teamId || null,
          bidHistory: [],
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
          ...(prev || {}),
          status: 'completed',
        }));
      }

      if (mappedPlayers.length === 0) {
        setPlayerPool([]);
        setCurrentPlayer(null);
      } else {
        setPlayerPool(mappedPlayers);
        let targetActivePlayer: PlayerRecord | null = null;
        if (activePlayerId) {
          targetActivePlayer = mappedPlayers.find((p) => p.id === activePlayerId) || null;
        }
        if (!targetActivePlayer) {
          const localActive = typeof window !== 'undefined' ? localStorage.getItem(`kapl_auction_active_player_${tournamentId}`) : null;
          if (localActive) {
            targetActivePlayer = mappedPlayers.find((p) => p.id === localActive) || null;
          }
        }
        if (!targetActivePlayer) {
          const firstPending = mappedPlayers.find((p) => p.auctionStatus === 'pending');
          targetActivePlayer = firstPending || mappedPlayers[0] || null;
        }
        setCurrentPlayer(targetActivePlayer);
        if (targetActivePlayer) {
          try {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, targetActivePlayer.id);
          } catch {}
        }
      }

      // 3. Fetch teams for this tournament
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (teamsError) throw teamsError;

      let metaMap: Record<string, any> = {};
      try {
        metaMap = JSON.parse(localStorage.getItem('kapl_team_metadata') || '{}');
      } catch {}

      const cachedTeamsMap: Record<string, Team> = {};
      try {
        const raw = localStorage.getItem(`kapl_auction_teams_${tournamentId}`);
        if (raw) {
          const parsed: Team[] = JSON.parse(raw);
          parsed.forEach(t => { cachedTeamsMap[t.id] = t; });
        }
      } catch {}

      if (teamsData && teamsData.length > 0) {
        const mappedTeams: Team[] = teamsData.map((t: any) => {
          const meta = metaMap[t.id] || {};
          const localCached = cachedTeamsMap[t.id];

          // Determine sold players for this team from the auction player pool
          const soldFromPool = mappedPlayers.filter(
            (p) => p.teamId === t.id && p.auctionStatus === 'sold'
          );

          // Squad derivation: DB / real-time pool is the source of truth
          let teamPlayers: any[] = [];
          if (soldFromPool.length > 0) {
            teamPlayers = soldFromPool.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photoUrl,
              role: p.role,
              soldPrice: p.soldPrice || p.basePrice || 0,
            }));
          } else if (mappedPlayers.length > 0 && Array.isArray(t.players) && t.players.length > 0) {
            const validIds = new Set(mappedPlayers.map((mp) => mp.id));
            teamPlayers = t.players.filter((p: any) => p && validIds.has(p.id) && !/^[ab][1-4]-/.test(p.id));
          }

          const initialPurse = Number(t.initial_purse || 10000);
          // Ground truth calculation: remaining purse = initialPurse - sum of sold prices in squad
          const totalSpent = teamPlayers.reduce((sum: number, p: any) => sum + (Number(p.soldPrice) || 0), 0);
          const currentPurse = Math.max(0, initialPurse - totalSpent);

          return {
            id: t.id,
            name: t.name,
            group: t.group as any,
            logo: t.logo,
            primaryColor: t.primary_color,
            players: teamPlayers,
            playerCount: teamPlayers.length,
            tournamentId: t.tournament_id,
            initialPurse: initialPurse,
            remainingPurse: currentPurse,
            maxSquadSize: t.max_squad_size || 10,
            captainUserId: t.captain_user_id || meta.captainUserId || null,
            ownerName: t.owner_name ?? undefined,
            ownerEmail: t.owner_email ?? null,
            ownerUserId: t.owner_user_id ?? null,
            captainName: meta.captainName || t.captain_name || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.captainName || (teamPlayers[0]?.name || undefined),
            captainPlayerId: meta.captainPlayerId || t.captain_player_id || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.captainPlayerId || (teamPlayers[0]?.id || null),
          };
        });

        setTeams(mappedTeams);
        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(mappedTeams));
        } catch {}
      } else {
        const fallback = tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
        const mappedTeams: Team[] = fallback.map((t) => {
          const meta = metaMap[t.id] || {};
          const localCached = cachedTeamsMap[t.id];
          const soldFromPool = mappedPlayers.filter(
            (p) => p.teamId === t.id && p.auctionStatus === 'sold'
          );

          let teamPlayers: any[] = [];
          if (soldFromPool.length > 0) {
            teamPlayers = soldFromPool.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photoUrl,
              role: p.role,
              soldPrice: p.soldPrice || p.basePrice || 0,
            }));
          } else if (mappedPlayers.length > 0 && localCached && Array.isArray(localCached.players) && localCached.players.length > 0) {
            const validIds = new Set(mappedPlayers.map((mp) => mp.id));
            teamPlayers = localCached.players.filter((p: any) => p && validIds.has(p.id) && !/^[ab][1-4]-/.test(p.id));
          }

          const initialPurse = t.initialPurse || 10000;
          const totalSpent = teamPlayers.reduce((sum: number, p: any) => sum + (Number(p.soldPrice) || 0), 0);
          const currentPurse = Math.max(0, initialPurse - totalSpent);

          return {
            ...t,
            initialPurse,
            remainingPurse: currentPurse,
            players: teamPlayers,
            playerCount: teamPlayers.length,
            ownerName: 'ownerName' in meta ? (meta.ownerName ?? undefined) : t.ownerName,
            ownerEmail: 'ownerEmail' in meta ? (meta.ownerEmail ?? null) : (t.ownerEmail ?? null),
            ownerUserId: 'ownerUserId' in meta ? (meta.ownerUserId ?? null) : t.ownerUserId,
            captainName: meta.captainName || t.captainName || (teamPlayers[0]?.name || undefined),
            captainPlayerId: meta.captainPlayerId || t.captainPlayerId || (teamPlayers[0]?.id || null),
          };
        });
        setTeams(mappedTeams);
        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(mappedTeams));
        } catch {}
      }

      // 4. Load sales history from DB with fallback to localStorage
      try {
        const { data: bidsData } = await supabase
          .from('auction_bids')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: false });

        if (bidsData && bidsData.length > 0) {
          const loadedHistory: AuctionSaleLog[] = bidsData.map((b) => {
            const player = mappedPlayers.find((p) => p.id === b.player_id);
            const team = (teamsData || []).find((t: any) => t.id === b.team_id);
            return {
              id: b.id,
              playerId: b.player_id,
              playerName: player?.name || 'Player',
              playerRole: (player?.role as any) || 'all_rounder',
              teamId: b.team_id,
              teamName: team?.name || 'Team',
              teamLogo: team?.logo || null,
              teamColor: team?.primary_color || '0 0% 50%',
              amount: Number(b.bid_amount),
              status: 'sold',
              timestamp: new Date(b.created_at).getTime(),
            };
          });
          setSalesHistory(loadedHistory);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(loadedHistory));
          } catch {}
        } else {
          // Reconstruct from sold players in DB
          const soldFromDb = mappedPlayers.filter((p) => p.auctionStatus === 'sold' && p.teamId);
          if (soldFromDb.length > 0) {
            const reconstructed: AuctionSaleLog[] = soldFromDb.map((p) => {
              const team = (teamsData || []).find((t: any) => t.id === p.teamId);
              return {
                id: `sale_${p.id}`,
                playerId: p.id,
                playerName: p.name,
                playerRole: p.role,
                teamId: p.teamId!,
                teamName: team?.name || 'Team',
                teamLogo: team?.logo || null,
                teamColor: team?.primary_color || '0 0% 50%',
                amount: p.soldPrice || p.basePrice || 100,
                status: 'sold',
                timestamp: Date.now(),
              };
            });
            setSalesHistory(reconstructed);
          } else {
            let loadedSales: AuctionSaleLog[] = [];
            try {
              const rawSales = localStorage.getItem(`kapl_auction_sales_${tournamentId}`);
              if (rawSales) loadedSales = JSON.parse(rawSales);
            } catch {}
            setSalesHistory(filterValidSales(loadedSales, mappedPlayers));
          }
        }
      } catch (histErr) {
        console.warn('Error loading auction history from DB, falling back to local cache:', histErr);
        let loadedSales: AuctionSaleLog[] = [];
        try {
          const rawSales = localStorage.getItem(`kapl_auction_sales_${tournamentId}`);
          if (rawSales) loadedSales = JSON.parse(rawSales);
        } catch {}
        setSalesHistory(filterValidSales(loadedSales, mappedPlayers));
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching auction data:', err);
      setIsLoading(false);
    }
  }, [tournamentId]);

  const setTournamentIdAndReset = useCallback(async (newTournamentId: string) => {
    if (newTournamentId === tournamentId) return;

    setTournamentId(newTournamentId);
    if (fetchDataDebounceRef.current) {
      clearTimeout(fetchDataDebounceRef.current);
    }
    await fetchData();
  }, [tournamentId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Network recovery: automatically re-synchronize when connection is restored
  useEffect(() => {
    let recoveryAttempt = 0;
    const maxRetries = 3;

    const handleOnline = async () => {
      recoveryAttempt = 0;
      toast.success('🌐 Connection restored! Re-synchronizing live auction...');

      const attemptRecovery = async () => {
        try {
          await fetchData();
          toast.success('✅ Live auction data synchronized.');
        } catch (err) {
          recoveryAttempt++;
          if (recoveryAttempt < maxRetries) {
            toast.warning(`Retry ${recoveryAttempt}/${maxRetries}...`);
            setTimeout(attemptRecovery, 1000 * recoveryAttempt);
          } else {
            toast.error('Unable to sync. Please refresh the page.');
          }
        }
      };

      attemptRecovery();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchData]);

  // Realtime Subscriptions with sub-50ms Broadcast Sync across all viewers and devices
  useEffect(() => {
    const handleSyncPayload = (envelope: any) => {
      if (!envelope || (envelope.tournamentId && envelope.tournamentId !== tournamentId && envelope.tournamentId !== 'all')) return;
      const { event, log, targetPlayerId, player, newRemainingPurse } = envelope;

      if (event === 'auction_spotlight' && player) {
        setCurrentPlayer(player);
        setSelectedCategory((prev) => (prev === 'all' ? 'all' : (player.role || 'all_rounder')));
        try {
          localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, player.id);
        } catch {}
      } else if (event === 'auction_sold' && log) {
        setSalesHistory(prev => {
          const updated = [log, ...prev.filter(l => l.playerId !== log.playerId)];
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
          } catch {}
          return updated;
        });

        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === log.playerId ? { ...p, auctionStatus: 'sold' as const, teamId: log.teamId, soldPrice: log.amount } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setTeams(prev => {
          const updated = prev.map(t => {
            if (t.id === log.teamId) {
              const currentSquad = t.players || [];
              const updatedSquad = [
                ...currentSquad.filter((p: any) => p.id !== log.playerId),
                { id: log.playerId, name: log.playerName, photo: null, role: log.playerRole, soldPrice: log.amount }
              ];
              const updatedPurse = newRemainingPurse ?? Math.max(0, (t.remainingPurse ?? 10000) - log.amount);
              return {
                ...t,
                remainingPurse: updatedPurse,
                players: updatedSquad,
                playerCount: updatedSquad.length,
              };
            }
            return t;
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updated }));
            }
          } catch {}
          return updated;
        });

        setCurrentPlayer(prev => prev && prev.id === log.playerId ? { ...prev, auctionStatus: 'sold', teamId: log.teamId, soldPrice: log.amount } : prev);
        playAuctionGavel();
        triggerQuickBurst();
        toast.success(`🎉 SOLD! ${log.playerName} bought by ${log.teamName} for ₹${log.amount.toLocaleString('en-IN')}!`, { duration: 6000 });
      } else if (event === 'auction_unsold') {
        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === targetPlayerId ? { ...p, auctionStatus: 'unsold' as const, teamId: null, soldPrice: null } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCurrentPlayer(prev => prev && prev.id === targetPlayerId ? { ...prev, auctionStatus: 'unsold', teamId: null, soldPrice: null } : prev);
        toast.warning(`❌ Player marked UNSOLD.`);
      } else if (event === 'auction_revert') {
        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === targetPlayerId ? { ...p, auctionStatus: 'pending' as const, teamId: null, soldPrice: null } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCurrentPlayer(prev => prev && prev.id === targetPlayerId ? { ...prev, auctionStatus: 'pending', teamId: null, soldPrice: null } : prev);

        setTeams(prev => {
          const updated = prev.map(t => {
            const hadPlayer = (t.players || []).some((p: any) => p.id === targetPlayerId);
            if (hadPlayer) {
              const refundedPlayer = (t.players || []).find((p: any) => p.id === targetPlayerId);
              const remainingSquad = (t.players || []).filter((p: any) => p.id !== targetPlayerId);
              return {
                ...t,
                remainingPurse: (t.remainingPurse ?? 10000) + (refundedPlayer?.soldPrice || 0),
                players: remainingSquad,
                playerCount: remainingSquad.length,
              };
            }
            return t;
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updated }));
            }
          } catch {}
          return updated;
        });

        setSalesHistory(prev => {
          const updated = prev.filter(l => l.playerId !== targetPlayerId);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        toast.info(`Player status reverted to Pending.`);
      } else if (event === 'auction_reset') {
        const resetTeams: Team[] = envelope.teams || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t: Team) => ({
          ...t,
          initialPurse: 10000,
          remainingPurse: 10000,
          players: [],
          playerCount: 0,
        }));
        const resetPlayers: PlayerRecord[] = Array.isArray(envelope.players) ? envelope.players : [];
        const resetCurrent = envelope.currentPlayer || resetPlayers[0] || null;

        setTeams(resetTeams);
        setPlayerPool(resetPlayers);
        setCurrentPlayer(resetCurrent);
        setSelectedCategory('all');
        setSalesHistory([]);

        try {
          localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(resetTeams));
          localStorage.setItem('kapl_teams', JSON.stringify(resetTeams));
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(resetPlayers));
          if (resetCurrent) {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, resetCurrent.id);
          } else {
            localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
          }
          localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: resetTeams }));
          }
        } catch {}

        toast.info('🔄 Auction bids reset! All franchise purses restored to ₹10,000.');
      } else if (event === 'auction_cleared') {
        const cleanTeams: Team[] = envelope.teams || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t: Team) => ({
          ...t,
          initialPurse: 10000,
          remainingPurse: 10000,
          players: [],
          playerCount: 0,
        }));

        clearLocalPlayersForTournament(tournamentId);
        setTeams(cleanTeams);
        setPlayerPool([]);
        setCurrentPlayer(null);
        setSelectedCategory('all');
        setSalesHistory([]);

        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: cleanTeams }));
          }
        } catch {}

        toast.info('🗑️ All players cleared from the auction pool.');
      } else if (event === 'auction_unsold_round_start') {
        setPlayerPool((prev) =>
          prev.map((p) => (p.auctionStatus === 'unsold' ? { ...p, auctionStatus: 'pending' as const, teamId: null, soldPrice: null } : p))
        );
        if (envelope.firstPlayer) {
          setCurrentPlayer(envelope.firstPlayer);
          setSelectedCategory((prev) => (prev === 'all' ? 'all' : (envelope.firstPlayer.role || 'all_rounder')));
        }
        setSalesHistory((prev) => prev.filter((l) => l.status !== 'unsold'));
        toast.info('⚡ Accelerated Round Started! All unsold players are back on the podium.');
      } else if (event === 'auction_player_added' && envelope.player) {
        const addedPlayer: PlayerRecord = envelope.player;
        const isSelfAdded = lastAddedPlayerIdRef.current === addedPlayer.id;
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
        } catch {}

        let isNewPlayer = false;
        setPlayerPool((prev) => {
          const exists = prev.some((p) => p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId));
          if (!exists) isNewPlayer = true;
          const updated = exists
            ? prev.map((p) => (p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId)) ? { ...p, ...addedPlayer } : p)
            : [...prev, addedPlayer];
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        // Spotlight player on stage ready for live bidding if stage is empty or player matches
        setCurrentPlayer((current) => {
          if (!current || current.auctionStatus === 'sold' || current.auctionStatus === 'unsold' || current.id === addedPlayer.id) {
            try {
              localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, addedPlayer.id);
            } catch {}
            return addedPlayer;
          }
          return current;
        });

        if (!isSelfAdded && isNewPlayer) {
          toast.info(`🏏 New player added: ${addedPlayer.name}!`);
        }
      } else if (event === 'auction_player_removed' && envelope.playerId) {
        const removedId = envelope.playerId;
        removePlayerFromLocalStores(removedId, tournamentId);
        let remainingPool: PlayerRecord[] = [];
        setPlayerPool((prev) => {
          remainingPool = prev.filter((p) => p.id !== removedId);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(remainingPool));
          } catch {}
          return remainingPool;
        });

        setCurrentPlayer((current) => {
          if (current?.id === removedId) {
            const replacement = remainingPool.find((p) => p.auctionStatus === 'pending') || remainingPool[0] || null;
            try {
              if (replacement) {
                localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, replacement.id);
              } else {
                localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
              }
            } catch {}
            return replacement;
          }
          return current;
        });

        setSalesHistory((prev) => {
          const updated = prev.filter((l) => l.playerId !== removedId);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setTeams((prevTeams) => {
          const updated = prevTeams.map((t) => {
            const hasPlayer = (t.players || []).some((p) => p.id === removedId);
            if (!hasPlayer) return t;
            const targetPlayer = (t.players || []).find((p) => p.id === removedId);
            const refund = targetPlayer?.soldPrice || 0;
            return {
              ...t,
              players: (t.players || []).filter((p) => p.id !== removedId),
              playerCount: Math.max(0, (t.playerCount || 1) - 1),
              remainingPurse: (t.remainingPurse ?? 10000) + refund,
            };
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    };

    const debouncedFetchData = () => {
      if (fetchDataDebounceRef.current) {
        clearTimeout(fetchDataDebounceRef.current);
      }
      fetchDataDebounceRef.current = setTimeout(() => {
        fetchData();
        fetchDataDebounceRef.current = null;
      }, 300);
    };

    const channel = supabase
      .channel(`auction-room-${tournamentId}`, {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'auction_sync' }, (msg) => {
        if (msg?.payload) handleSyncPayload(msg.payload);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_state', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          debouncedFetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          debouncedFetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          debouncedFetchData();
        }
      )
      .subscribe();

    sharedAuctionBroadcastChannel = channel;

    // Cross-tab broadcast channel listener
    const handleTabMessage = (e: MessageEvent) => {
      if (e.data) handleSyncPayload(e.data);
    };
    if (sharedAuctionTabSync) {
      sharedAuctionTabSync.addEventListener('message', handleTabMessage);
    }
    if (sharedSharedTabSync) {
      sharedSharedTabSync.addEventListener('message', handleTabMessage);
    }

    // Local DOM event listener
    const handleLocalEvent = (e: any) => {
      if (e.detail) handleSyncPayload(e.detail);
    };
    window.addEventListener('kapl-auction-local-update', handleLocalEvent);

    // Listen for localStorage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `kapl_auction_players_${tournamentId}` || e.key === 'kapl_registered_players') {
        try {
          const updated = e.newValue ? JSON.parse(e.newValue) : [];
          if (Array.isArray(updated) && updated.length > 0) {
            setPlayerPool(updated);
            // Reload from localStorage to ensure fresh state
            const aucRaw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
            if (aucRaw) {
              const parsed = JSON.parse(aucRaw);
              if (Array.isArray(parsed)) {
                setPlayerPool(parsed);
              }
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Local window event for newly registered player or reset
    const handlePlayerAdded = (e: any) => {
      const { player: addedPlayer, tournamentId: targetTournamentId } = e.detail || {};
      if (addedPlayer === null) {
        setPlayerPool([]);
        setCurrentPlayer(null);
        return;
      }
      if (!addedPlayer || (targetTournamentId && targetTournamentId !== tournamentId && targetTournamentId !== 'all')) return;
      try {
        localStorage.removeItem('kapl_all_players_cleared');
        localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
      } catch {}

      setPlayerPool((prev) => {
        const exists = prev.some((p) => p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId));
        const updated = exists
          ? prev.map((p) => (p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId)) ? { ...p, ...addedPlayer } : p)
          : [...prev, addedPlayer];
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setCurrentPlayer((current) => {
        if (!current || current.auctionStatus === 'sold' || current.auctionStatus === 'unsold' || current.id === addedPlayer.id) {
          try {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, addedPlayer.id);
          } catch {}
          return addedPlayer;
        }
        return current;
      });
    };
    window.addEventListener('kapl_player_added', handlePlayerAdded);

    const handlePlayerRemoved = (e: any) => {
      const { playerId, tournamentId: targetTournamentId } = e.detail || {};
      if (playerId && (!targetTournamentId || targetTournamentId === tournamentId || targetTournamentId === 'all')) {
        handleSyncPayload({ event: 'auction_player_removed', playerId, tournamentId });
      }
    };
    window.addEventListener('kapl_player_removed', handlePlayerRemoved);

    return () => {
      supabase.removeChannel(channel);
      sharedAuctionBroadcastChannel = null;
      if (fetchDataDebounceRef.current) {
        clearTimeout(fetchDataDebounceRef.current);
      }
      if (sharedAuctionTabSync) {
        sharedAuctionTabSync.removeEventListener('message', handleTabMessage);
      }
      if (sharedSharedTabSync) {
        sharedSharedTabSync.removeEventListener('message', handleTabMessage);
      }
      window.removeEventListener('kapl-auction-local-update', handleLocalEvent);
      window.removeEventListener('kapl_player_added', handlePlayerAdded);
      window.removeEventListener('kapl_player_removed', handlePlayerRemoved);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [tournamentId, fetchData]);

  // Broadcast helper with fallback for failed channels
  const broadcastAuctionEvent = useCallback((event: string, data: any) => {
    const envelope = { event, ...data, tournamentId };

    if (sharedAuctionBroadcastChannel) {
      sharedAuctionBroadcastChannel
        .send({ type: 'broadcast', event: 'auction_sync', payload: envelope })
        .catch(() => {
          console.warn('Supabase broadcast channel send failed, falling back to local events');
        });
    }

    if (broadcastChannelSupported) {
      try {
        if (sharedAuctionTabSync) {
          sharedAuctionTabSync.postMessage(envelope);
        }
        if (sharedSharedTabSync) {
          sharedSharedTabSync.postMessage(envelope);
        }
      } catch (err) {
        console.warn('BroadcastChannel postMessage failed:', err);
        if (!broadcastChannelSupported) {
          initializeBroadcastChannels();
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl-auction-local-update', { detail: envelope }));
    }
  }, [tournamentId]);

  // Countdown timer handler with server-time sync
  useEffect(() => {
    if (!auctionState?.timerEndsAt || auctionState.status === 'idle' || auctionState.status === 'sold' || auctionState.status === 'unsold') {
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const end = new Date(auctionState.timerEndsAt!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((end - now) / 1000));

      if (diff <= 0 && (auctionState.status === 'bidding' || auctionState.status === 'fair_warning')) {
        setTimeLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
        toast.warning('⏰ Auction timer expired. Admin action required.');
      } else {
        setTimeLeft(diff);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auctionState?.timerEndsAt, auctionState?.status]);

  // Spotlight a specific player on the auction podium (broadcast to all users)
  const spotlightPlayer = async (player: PlayerRecord) => {
    cancelAutoAdvance();
    setCurrentPlayer(player);
    setSelectedCategory((prev) => (prev === 'all' ? 'all' : player.role));

    try {
      localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, player.id);
    } catch {}

    // Broadcast immediately so every viewer's screen updates in <30ms
    broadcastAuctionEvent('auction_spotlight', {
      player,
      playerId: player.id,
    });

    try {
      const stateId = auctionState?.id || tournamentId;
      const { error } = await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: player.id,
          current_bid: player.soldPrice || player.basePrice,
          highest_bidder_team_id: player.teamId || null,
          status: player.auctionStatus === 'sold' ? 'sold' : player.auctionStatus === 'unsold' ? 'unsold' : 'idle',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to update spotlight in auction_state:', error);
        toast.error('Spotlight sync notice: ' + error.message);
      } else {
        toast.info(`⚡ Now in Spotlight: ${player.name || 'Player'} (${formatPlayerRole(player.role)})`);
      }
    } catch (err: any) {
      console.error('DB update exception for spotlight player:', err);
    }
  };

  // Navigate to Next Player in Category
  const nextPlayer = (direction: 'next' | 'prev' = 'next') => {
    const categoryPlayers = selectedCategory === 'all'
      ? playerPool
      : playerPool.filter((p) => p.role === selectedCategory);
    if (categoryPlayers.length === 0) return;

    const currentIndex = categoryPlayers.findIndex((p) => p.id === currentPlayer?.id);
    let targetIndex = 0;

    if (direction === 'next') {
      targetIndex = currentIndex >= 0 && currentIndex < categoryPlayers.length - 1 ? currentIndex + 1 : 0;
    } else {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : categoryPlayers.length - 1;
    }

    const targetPlayer = categoryPlayers[targetIndex];
    if (targetPlayer) {
      spotlightPlayer(targetPlayer);
    }
  };

  // ADMIN ACTION: Decide SOLD (Select Team & Price)
  const adminDecideSold = async (playerId: string, teamId: string, soldPrice: number) => {
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) {
      toast.error('No player selected');
      return;
    }

    if (targetPlayer.auctionStatus === 'sold') {
      toast.warning(`⚠️ ${targetPlayer.name} is already marked SOLD! Please revert the status first if you wish to re-auction.`);
      return;
    }

    const targetTeam = (teams || []).find((t) => t.id === teamId);
    if (!targetTeam) {
      toast.error('Please select a valid franchise team');
      return;
    }

    const currentSquadCount = (targetTeam.players || []).filter((p: any) => p.id !== targetPlayer.id).length;
    const maxSquad = targetTeam.maxSquadSize || 10;
    if (currentSquadCount >= maxSquad) {
      toast.error(`⛔ ${targetTeam.name} has already reached the maximum squad limit of ${maxSquad} players!`);
      return;
    }

    const minBasePrice = targetPlayer.basePrice || 100;
    if (!Number.isFinite(soldPrice) || soldPrice < minBasePrice) {
      toast.error(`⛔ Winning bid must be at least the base price (₹${minBasePrice.toLocaleString('en-IN')}).`);
      return;
    }

    const availablePurse =
      currentSquadCount === 0
        ? (targetTeam.initialPurse || 10000)
        : (targetTeam.remainingPurse !== undefined && targetTeam.remainingPurse !== null
            ? targetTeam.remainingPurse
            : (targetTeam.initialPurse || 10000));

    if (soldPrice > availablePurse) {
      toast.error(`⛔ Insufficient purse! ${targetTeam.name} only has ₹${availablePurse.toLocaleString('en-IN')} available.`);
      return;
    }

    const now = new Date().toISOString();
    const newRemainingPurse = Math.max(0, availablePurse - soldPrice);
    const updatedPlayersJson = [
      ...(targetTeam.players || []).filter((p) => p.id !== targetPlayer.id),
      { id: targetPlayer.id, name: targetPlayer.name, photo: targetPlayer.photoUrl, role: targetPlayer.role, soldPrice },
    ];

    // 1. Persist directly to Supabase tables (players, teams, auction_state, auction_bids)
    try {
      const dbTournamentId =
        targetPlayer.tournamentId && targetPlayer.tournamentId !== 'all'
          ? targetPlayer.tournamentId
          : tournamentId;

      const { error: playerError } = await supabase
        .from('players')
        .upsert(
          {
            id: targetPlayer.id,
            tournament_id: dbTournamentId,
            name: targetPlayer.name,
            role: targetPlayer.role || 'all_rounder',
            batting_style: targetPlayer.battingStyle || null,
            bowling_style: targetPlayer.bowlingStyle || null,
            photo_url: targetPlayer.photoUrl || null,
            jersey_number: targetPlayer.jerseyNumber ?? null,
            base_price: minBasePrice,
            team_id: targetTeam.id,
            sold_price: soldPrice,
            auction_status: 'sold',
            updated_at: now,
          },
          { onConflict: 'id' }
        );

      if (playerError) {
        console.error('Auction player update failed:', playerError);
        toast.error(`❌ Auction sale failed: ${playerError.message}`);
        return;
      }

      const { error: teamError } = await supabase
        .from('teams')
        .update({
          remaining_purse: newRemainingPurse,
          players: updatedPlayersJson as any,
          player_count: updatedPlayersJson.length,
          updated_at: now,
        })
        .eq('id', targetTeam.id);

      if (teamError) {
        console.error('Auction team purse update failed:', teamError);
        toast.error(`❌ Team purse update failed: ${teamError.message}`);
        return;
      }

      const { error: stateError } = await supabase
        .from('auction_state')
        .upsert({
          id: auctionState?.id || tournamentId,
          tournament_id: tournamentId,
          current_player_id: targetPlayer.id,
          current_bid: soldPrice,
          highest_bidder_team_id: targetTeam.id,
          status: 'sold',
          timer_ends_at: null,
          updated_at: now,
        });
      if (stateError) {
        console.warn('Auction state sync warning:', stateError);
      }

      await supabase
        .from('auction_bids')
        .delete()
        .eq('player_id', targetPlayer.id)
        .eq('tournament_id', tournamentId);

      const { error: bidError } = await supabase
        .from('auction_bids')
        .insert({
          tournament_id: tournamentId,
          player_id: targetPlayer.id,
          team_id: targetTeam.id,
          bid_amount: soldPrice,
          bidder_user_id: isValidUuid(user?.id) ? user!.id : null,
        });
      if (bidError) {
        console.warn('Auction bid log sync warning:', bidError);
      }
    } catch (dbErr: any) {
      console.error('Auction sale persistence error:', dbErr);
      toast.error(`❌ Auction sale failed: ${dbErr?.message || 'Network error'}`);
      return;
    }

    // 2. Database confirmed sale. Now update UI state, vault, localStorage, and broadcast.
    const soldPlayerRecord: PlayerRecord = {
      ...targetPlayer,
      auctionStatus: 'sold',
      teamId: targetTeam.id,
      soldPrice,
    };
    saveToPlayerVault(soldPlayerRecord);

    const updatedPool = playerPool.map((p) => (p.id === targetPlayer.id ? soldPlayerRecord : p));
    const updatedTeams = teams.map((t) =>
      t.id === targetTeam.id
        ? { ...t, remainingPurse: newRemainingPurse, players: updatedPlayersJson, playerCount: updatedPlayersJson.length }
        : t
    );
    
    setPlayerPool(updatedPool);
    setTeams(updatedTeams);
    setCurrentPlayer(prev => prev && prev.id === targetPlayer.id ? { ...prev, auctionStatus: 'sold', teamId: targetTeam.id, soldPrice } : prev);

    // Persist to localStorage
    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
    } catch {}

    const saleLog: AuctionSaleLog = {
      id: `${targetPlayer.id}-${Date.now()}`,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerRole: targetPlayer.role,
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      teamLogo: targetTeam.logo,
      teamColor: targetTeam.primaryColor,
      amount: soldPrice,
      status: 'sold',
      timestamp: Date.now(),
    };

    setSalesHistory(prev => {
      const updated = [saleLog, ...prev.filter(l => l.playerId !== targetPlayer.id)];
      try {
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    // Broadcast across all devices & anonymous viewers
    broadcastAuctionEvent('auction_sold', {
      log: saleLog,
      targetPlayerId: targetPlayer.id,
      targetTeamId: targetTeam.id,
      soldPrice,
      newRemainingPurse,
    });

    toast.success(`🎉 SOLD! ${targetPlayer.name} assigned to ${targetTeam.name} for ₹${soldPrice.toLocaleString('en-IN')}!`);
    playAuctionGavel();
    triggerQuickBurst();

    // Auto-advance to next pending player with 3.5s celebration window
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0 && isAutoAdvanceEnabled) {
      cancelAutoAdvance();
      let secondsLeft = 3;
      setAutoAdvanceCountdown(secondsLeft);
      autoAdvanceIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
        } else {
          setAutoAdvanceCountdown(secondsLeft);
        }
      }, 1000);

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceCountdown(null);
        spotlightPlayer(remainingPending[0]);
      }, 3500);
    }
  };

  // ADMIN ACTION: Decide UNSOLD
  const adminDecideUnsold = async (playerId: string) => {
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) return;

    const updatedPool = playerPool.map(p => p.id === targetPlayer.id ? { ...p, auctionStatus: 'unsold' as const, teamId: null, soldPrice: null } : p);
    setPlayerPool(updatedPool);
    setCurrentPlayer(prev => prev && prev.id === targetPlayer.id ? { ...prev, auctionStatus: 'unsold', teamId: null, soldPrice: null } : prev);

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
    } catch {}

    const unsoldLog: AuctionSaleLog = {
      id: `${targetPlayer.id}-${Date.now()}`,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerRole: targetPlayer.role,
      amount: targetPlayer.basePrice,
      status: 'unsold',
      timestamp: Date.now(),
    };

    setSalesHistory(prev => {
      const updated = [unsoldLog, ...prev.filter(l => l.playerId !== targetPlayer.id)];
      try {
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    broadcastAuctionEvent('auction_unsold', {
      targetPlayerId: targetPlayer.id,
      log: unsoldLog,
    });

    toast.warning(`❌ ${targetPlayer.name} marked UNSOLD.`);

    // Auto-advance to next pending player with 3.5s window
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0 && isAutoAdvanceEnabled) {
      cancelAutoAdvance();
      let secondsLeft = 3;
      setAutoAdvanceCountdown(secondsLeft);
      autoAdvanceIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
        } else {
          setAutoAdvanceCountdown(secondsLeft);
        }
      }, 1000);

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceCountdown(null);
        spotlightPlayer(remainingPending[0]);
      }, 3500);
    }

    try {
      const now = new Date().toISOString();
      const dbTournamentId =
        targetPlayer.tournamentId && targetPlayer.tournamentId !== 'all'
          ? targetPlayer.tournamentId
          : tournamentId;

      saveToPlayerVault({ ...targetPlayer, auctionStatus: 'unsold', teamId: null, soldPrice: null });

      const { error: pErr } = await supabase
        .from('players')
        .upsert(
          {
            id: targetPlayer.id,
            tournament_id: dbTournamentId,
            name: targetPlayer.name,
            role: targetPlayer.role || 'all_rounder',
            batting_style: targetPlayer.battingStyle || null,
            bowling_style: targetPlayer.bowlingStyle || null,
            photo_url: targetPlayer.photoUrl || null,
            jersey_number: targetPlayer.jerseyNumber ?? null,
            base_price: targetPlayer.basePrice || 100,
            auction_status: 'unsold',
            team_id: null,
            sold_price: null,
            updated_at: now,
          },
          { onConflict: 'id' }
        );
      if (pErr) console.error('Failed to update player status to unsold:', pErr);

      const stateId = auctionState?.id || tournamentId;
      const { error: sErr } = await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: targetPlayer.id,
          status: 'unsold',
          highest_bidder_team_id: null,
          timer_ends_at: null,
          updated_at: now,
        });
      if (sErr) console.error('Failed to update auction_state to unsold:', sErr);
    } catch (err: any) {
      console.error('DB persistence error for unsold player:', err?.message || err);
    }
  };

  // ADMIN ACTION: Revert / Re-auction a player
  const revertPlayerStatus = async (playerId: string) => {
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const previousTeamId = targetPlayer.teamId;
    const previousPrice = targetPlayer.soldPrice || 0;

    const revertedPlayer: PlayerRecord = {
      ...targetPlayer,
      auctionStatus: 'pending',
      teamId: null,
      soldPrice: null,
    };
    const updatedPool = playerPool.map((p) => (p.id === targetPlayer.id ? revertedPlayer : p));
    let updatedTeamRecord: Team | null = null;
    const updatedTeams = teams.map((t) => {
      const hadPlayer = (t.players || []).some((p) => p.id === targetPlayer.id);
      if (t.id === previousTeamId || hadPlayer) {
        const remainingSquad = (t.players || []).filter((p) => p.id !== targetPlayer.id);
        const totalSpent = remainingSquad.reduce((sum: number, p: any) => sum + (Number(p.soldPrice) || 0), 0);
        const restoredPurse = Math.max(0, (t.initialPurse || 10000) - totalSpent);
        updatedTeamRecord = {
          ...t,
          remainingPurse: previousTeamId && remainingSquad.length === (t.players || []).length
            ? (t.remainingPurse ?? 10000) + previousPrice
            : restoredPurse,
          players: remainingSquad,
          playerCount: remainingSquad.length,
        };
        return updatedTeamRecord;
      }
      return t;
    });

    const nextSales = salesHistory.filter((l) => l.playerId !== targetPlayer.id);

    setPlayerPool(updatedPool);
    setTeams(updatedTeams);
    setCurrentPlayer((prev) => (prev && prev.id === targetPlayer.id ? revertedPlayer : prev));
    setSalesHistory(nextSales);
    saveToPlayerVault(revertedPlayer);

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(nextSales));
      localStorage.setItem('kapl_teams', JSON.stringify(updatedTeams));
    } catch {}

    broadcastAuctionEvent('auction_revert', {
      targetPlayerId: targetPlayer.id,
    });

    toast.info(`${targetPlayer.name} has been reset to Pending.`);

    try {
      const now = new Date().toISOString();
      if (updatedTeamRecord) {
        const ut = updatedTeamRecord as Team;
        await supabase
          .from('teams')
          .update({
            remaining_purse: ut.remainingPurse,
            players: (ut.players || []) as any,
            player_count: ut.playerCount,
            updated_at: now,
          })
          .eq('id', ut.id);
      }

      await supabase
        .from('players')
        .update({
          auction_status: 'pending',
          team_id: null,
          sold_price: null,
          updated_at: now,
        })
        .eq('id', targetPlayer.id);

      await supabase
        .from('auction_bids')
        .delete()
        .eq('player_id', targetPlayer.id)
        .eq('tournament_id', tournamentId);

      if (auctionState?.currentPlayerId === targetPlayer.id || currentPlayer?.id === targetPlayer.id) {
        await supabase
          .from('auction_state')
          .upsert({
            id: auctionState?.id || tournamentId,
            tournament_id: tournamentId,
            current_player_id: targetPlayer.id,
            current_bid: targetPlayer.basePrice || 100,
            highest_bidder_team_id: null,
            status: 'idle',
            timer_ends_at: null,
            updated_at: now,
          });
      }
    } catch (err: any) {
      console.warn('DB persistence notice for revert player:', err?.message || err);
    }
  };

  // ADMIN ACTION: Start Accelerated Round (Re-auction all unsold players)
  const startAcceleratedUnsoldRound = async () => {
    cancelAutoAdvance();
    const unsoldPlayers = playerPool.filter((p) => p.auctionStatus === 'unsold');
    if (unsoldPlayers.length === 0) {
      toast.info('No unsold players available to re-auction.');
      return;
    }

    const updatedPool = playerPool.map((p) =>
      p.auctionStatus === 'unsold'
        ? { ...p, auctionStatus: 'pending' as const, teamId: null, soldPrice: null }
        : p
    );
    const nextSales = salesHistory.filter((l) => l.status !== 'unsold');
    setPlayerPool(updatedPool);
    setSalesHistory(nextSales);
    unsoldPlayers.forEach((p) =>
      saveToPlayerVault({ ...p, auctionStatus: 'pending', teamId: null, soldPrice: null })
    );

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(nextSales));
    } catch {}

    spotlightPlayer({ ...unsoldPlayers[0], auctionStatus: 'pending', teamId: null, soldPrice: null });

    broadcastAuctionEvent('auction_unsold_round_start', {
      unsoldIds: unsoldPlayers.map((p) => p.id),
      firstPlayer: { ...unsoldPlayers[0], auctionStatus: 'pending', teamId: null, soldPrice: null },
    });

    toast.success(`⚡ Accelerated Round Started! ${unsoldPlayers.length} unsold players are back on the podium.`);

    try {
      await supabase
        .from('players')
        .update({ auction_status: 'pending', team_id: null, sold_price: null, updated_at: new Date().toISOString() })
        .in('id', unsoldPlayers.map((p) => p.id));
    } catch (err: any) {
      console.warn('DB update for accelerated round:', err);
    }
  };

  const removePlayerFromAuction = useCallback(async (playerId: string) => {
    const remainingPool = playerPool.filter((p) => p.id !== playerId);
    const nextSpotlight =
      currentPlayer?.id === playerId
        ? remainingPool.find((p) => p.auctionStatus === 'pending') || remainingPool[0] || null
        : currentPlayer;

    // 1. Remove from local pool, stage, sales history & all local stores (including vault)
    setPlayerPool(remainingPool);
    setCurrentPlayer(nextSpotlight);
    const nextSales = salesHistory.filter((l) => l.playerId !== playerId);
    setSalesHistory(nextSales);
    removePlayerFromLocalStores(playerId, tournamentId);

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(remainingPool));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(nextSales));
      if (nextSpotlight) {
        localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, nextSpotlight.id);
      } else {
        localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
      }
    } catch {}

    // 2. Refund team if drafted
    const affectedTeams: Team[] = [];
    const updatedTeams = teams.map((t) => {
      const hasPlayer = (t.players || []).some((p) => p.id === playerId);
      if (!hasPlayer) return t;
      const targetPlayer = (t.players || []).find((p) => p.id === playerId);
      const refund = targetPlayer?.soldPrice || 0;
      const filteredSquad = (t.players || []).filter((p) => p.id !== playerId);
      const nextTeam: Team = {
        ...t,
        players: filteredSquad,
        playerCount: filteredSquad.length,
        remainingPurse: (t.remainingPurse ?? 10000) + refund,
      };
      affectedTeams.push(nextTeam);
      return nextTeam;
    });
    setTeams(updatedTeams);
    try {
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
      localStorage.setItem('kapl_teams', JSON.stringify(updatedTeams));
    } catch {}

    // 3. Broadcast event across tabs & Supabase
    broadcastAuctionEvent('auction_player_removed', { playerId, tournamentId });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl_player_removed', { detail: { playerId, tournamentId } }));
      window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updatedTeams }));
    }

    // 4. Delete from database & sync affected teams/state
    try {
      const now = new Date().toISOString();
      await supabase.from('auction_bids').delete().eq('player_id', playerId);
      if (isAdmin && isValidUuid(user?.id)) {
        await supabase.rpc('delete_player_by_id', { p_id: playerId });
      }
      await supabase.from('players').delete().eq('id', playerId);

      for (const ut of affectedTeams) {
        await supabase
          .from('teams')
          .update({
            remaining_purse: ut.remainingPurse,
            players: (ut.players || []) as any,
            player_count: ut.playerCount,
            updated_at: now,
          })
          .eq('id', ut.id);
      }

      if (currentPlayer?.id === playerId || auctionState?.currentPlayerId === playerId) {
        await supabase
          .from('auction_state')
          .upsert({
            id: auctionState?.id || tournamentId,
            tournament_id: tournamentId,
            current_player_id: nextSpotlight?.id || null,
            current_bid: nextSpotlight?.soldPrice || nextSpotlight?.basePrice || 100,
            highest_bidder_team_id: nextSpotlight?.teamId || null,
            status: nextSpotlight?.auctionStatus === 'sold' ? 'sold' : nextSpotlight?.auctionStatus === 'unsold' ? 'unsold' : 'idle',
            timer_ends_at: null,
            updated_at: now,
          });
      }
    } catch (e) {
      console.warn('DB player delete error in auction:', e);
    }
    toast.success('Player permanently deleted from auction');
  }, [tournamentId, playerPool, teams, currentPlayer, salesHistory, auctionState?.id, auctionState?.currentPlayerId, broadcastAuctionEvent, isAdmin, user?.id]);

  // ADD NEW PLAYER DIRECTLY TO AUCTION POOL & TOURNAMENTS
  const addPlayerToAuction = useCallback(async (playerInput: {
    name: string;
    role: PlayerRole;
    battingStyle?: string;
    bowlingStyle?: string;
    basePrice?: number;
    jerseyNumber?: number | null;
    mobileNumber?: string | null;
    photoUrl?: string | null;
    gender?: 'male' | 'female';
    tournamentId?: string;
  }): Promise<{ success: boolean; player?: PlayerRecord; error?: string }> => {
    try {
      if (!isAdmin) {
        const msg = 'Only administrators can add players to the auction.';
        toast.error(msg);
        return { success: false, error: msg };
      }
      const cleanName = playerInput.name.trim();
      if (!cleanName) {
        return { success: false, error: 'Player name is required' };
      }

      const targetTourn = playerInput.tournamentId || 'all';
      const generatedId = `p_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const basePrice = Number(playerInput.basePrice || 100);

      const dualTournaments = targetTourn === 'all'
        ? ['kapl-3-mens', 'kapl-3-womens']
        : [targetTourn];

      let createdForCurrent: PlayerRecord | null = null;

      for (const tId of dualTournaments) {
        const idForTourn = tId === 'kapl-3-womens' ? `${generatedId}_w` : generatedId;

        const playerRecord: PlayerRecord = {
          id: idForTourn,
          name: cleanName,
          role: playerInput.role || 'all_rounder',
          battingStyle: playerInput.battingStyle || 'Right-hand bat',
          bowlingStyle: playerInput.bowlingStyle || 'Right-arm medium',
          basePrice: basePrice,
          soldPrice: null,
          auctionStatus: 'pending',
          tournamentId: tId,
          jerseyNumber: playerInput.jerseyNumber ? Number(playerInput.jerseyNumber) : null,
          mobileNumber: playerInput.mobileNumber || null,
          photoUrl: playerInput.photoUrl || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (tId === tournamentId || !createdForCurrent) {
          createdForCurrent = playerRecord;
        }

        let dbSuccess = false;

        // 1. Primary: RPC for atomic insertion with validation when signed in with Supabase auth
        if (isValidUuid(user?.id)) {
          try {
            const { error: rpcError } = await supabase.rpc('register_new_player', {
              p_id: idForTourn,
              p_name: cleanName,
              p_role: playerInput.role || 'all_rounder',
              p_batting_style: playerInput.battingStyle || 'Right-hand bat',
              p_bowling_style: playerInput.bowlingStyle || 'Right-arm medium',
              p_jersey_number: playerInput.jerseyNumber ? Number(playerInput.jerseyNumber) : null,
              p_mobile_number: playerInput.mobileNumber || null,
              p_photo_url: playerInput.photoUrl || null,
              p_tournament_id: tId,
              p_base_price: basePrice,
            });

            if (!rpcError) {
              dbSuccess = true;
            } else {
              console.warn(`RPC register_new_player failed for ${idForTourn}:`, rpcError);
            }
          } catch (rpcErr) {
            console.warn(`RPC register_new_player exception for ${idForTourn}:`, rpcErr);
          }
        }

        // 2. Direct insert with update fallback
        if (!dbSuccess) {
          try {
            const { error: insError } = await supabase.from('players').insert({
              id: idForTourn,
              name: cleanName,
              photo_url: playerInput.photoUrl || null,
              role: playerInput.role || 'all_rounder',
              batting_style: playerInput.battingStyle || null,
              bowling_style: playerInput.bowlingStyle || null,
              jersey_number: playerInput.jerseyNumber ? Number(playerInput.jerseyNumber) : null,
              mobile_number: playerInput.mobileNumber || null,
              tournament_id: tId,
              base_price: basePrice,
              auction_status: 'pending',
            });

            if (!insError) {
              dbSuccess = true;
            } else if (insError.code === '23505') {
              const { error: updateErr } = await supabase.from('players').update({
                name: cleanName,
                photo_url: playerInput.photoUrl || null,
                role: playerInput.role || 'all_rounder',
                batting_style: playerInput.battingStyle || null,
                bowling_style: playerInput.bowlingStyle || null,
                jersey_number: playerInput.jerseyNumber ? Number(playerInput.jerseyNumber) : null,
                mobile_number: playerInput.mobileNumber || null,
                tournament_id: tId,
                base_price: basePrice,
              }).eq('id', idForTourn);
              if (!updateErr) {
                dbSuccess = true;
              }
            } else {
              console.warn(`Could not insert player via direct insert (${tId}):`, insError);
            }
          } catch (dbErr) {
            console.warn(`Insert exception for ${idForTourn}:`, dbErr);
          }
        }

        if (!dbSuccess && tId === tournamentId) {
          throw new Error(`Failed to persist player ${idForTourn} to database after retries`);
        }
      }

      const masterRecord: PlayerRecord = {
        id: generatedId,
        name: cleanName,
        role: playerInput.role || 'all_rounder',
        battingStyle: playerInput.battingStyle || 'Right-hand bat',
        bowlingStyle: playerInput.bowlingStyle || 'Right-arm medium',
        basePrice: basePrice,
        soldPrice: null,
        auctionStatus: 'pending',
        tournamentId: targetTourn,
        jerseyNumber: playerInput.jerseyNumber ? Number(playerInput.jerseyNumber) : null,
        mobileNumber: playerInput.mobileNumber || null,
        photoUrl: playerInput.photoUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Save to unresettable registration vault
      saveToPlayerVault({
        ...masterRecord,
        gender: playerInput.gender || (targetTourn === 'kapl-3-womens' ? 'female' : 'male'),
      });

      // 4. Update in-memory state & localStorage for current tournament immediately
      const activeCandidate = createdForCurrent || masterRecord;
      lastAddedPlayerIdRef.current = activeCandidate.id;

      setPlayerPool((prev) => {
        const exists = prev.some((p) => p.id === activeCandidate.id);
        const updated = exists
          ? prev.map((p) => p.id === activeCandidate.id ? { ...p, ...activeCandidate } : p)
          : [...prev, activeCandidate];
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setCurrentPlayer((current) => {
        if (!current || current.auctionStatus === 'sold' || current.auctionStatus === 'unsold') {
          try {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, activeCandidate.id);
          } catch {}
          return activeCandidate;
        }
        return current;
      });

      setSelectedCategory('all');

      // 5. Sync to registered players list and auction across all tabs
      await syncPlayerToAuctionAndTournament(masterRecord);

      // 6. Broadcast across tabs and Supabase channels
      broadcastAuctionEvent('auction_player_added', {
        player: activeCandidate,
        tournamentId: targetTourn,
      });

      toast.success(`🏏 ${cleanName} added to the Live Auction pool!`);
      return { success: true, player: activeCandidate };
    } catch (err: any) {
      console.error('Error adding player to auction:', err);
      toast.error('Failed to add player: ' + err.message);
      return { success: false, error: err.message };
    }
  }, [tournamentId, broadcastAuctionEvent, user?.id, isAdmin]);

  return {
    tournamentId,
    setTournamentId: setTournamentIdAndReset,
    auctionState,
    currentPlayer,
    setCurrentPlayer,
    playerPool,
    teams,
    isLoading,
    isAdmin,
    selectedCategory,
    setSelectedCategory,
    spotlightPlayer,
    nextPlayer,
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
    initializeAuctionData: async () => {
      cancelAutoAdvance();
      const resetPlayers: PlayerRecord[] = playerPool.map((p) => ({
        ...p,
        auctionStatus: 'pending',
        teamId: null,
        soldPrice: null,
      }));
      const baseTeams = teams.length > 0 ? teams : (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS);
      const freshTeams: Team[] = baseTeams.map((t) => ({
        ...t,
        initialPurse: 10000,
        remainingPurse: 10000,
        players: [],
        playerCount: 0,
      }));
      const firstSpotlight = resetPlayers[0] || null;

      setPlayerPool(resetPlayers);
      setTeams(freshTeams);
      setCurrentPlayer(firstSpotlight);
      setSelectedCategory('all');
      setSalesHistory([]);
      resetPlayers.forEach((p) => saveToPlayerVault(p));

      try {
        localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
        localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(resetPlayers));
        localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(freshTeams));
        if (firstSpotlight) {
          localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, firstSpotlight.id);
        } else {
          localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
        }
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
        localStorage.setItem('kapl_teams', JSON.stringify(freshTeams));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: freshTeams }));
        }
      } catch {}

      broadcastAuctionEvent('auction_reset', {
        teams: freshTeams,
        players: resetPlayers,
        currentPlayer: firstSpotlight,
      });

      try {
        const now = new Date().toISOString();
        await supabase.from('auction_bids').delete().eq('tournament_id', tournamentId);
        if (resetPlayers.length > 0) {
          await supabase
            .from('players')
            .update({ auction_status: 'pending', team_id: null, sold_price: null, updated_at: now })
            .in('id', resetPlayers.map((p) => p.id));
        }
        await supabase
          .from('teams')
          .update({ remaining_purse: 10000, players: [] as any, player_count: 0, updated_at: now })
          .eq('tournament_id', tournamentId);
        await supabase
          .from('auction_state')
          .upsert({
            id: auctionState?.id || tournamentId,
            tournament_id: tournamentId,
            current_player_id: firstSpotlight?.id || null,
            current_bid: firstSpotlight?.basePrice || 100,
            highest_bidder_team_id: null,
            status: 'idle',
            timer_ends_at: null,
            updated_at: now,
          });
      } catch (err: any) {
        console.warn('DB reset background notice:', err);
      }

      return {
        success: true,
        count: resetPlayers.length,
        message:
          resetPlayers.length > 0
            ? `Auction reset! All ${resetPlayers.length} players set to Pending and all franchise purses restored to ₹10,000.`
            : 'All franchise purses restored to ₹10,000.',
      };
    },
    clearAllPlayers: async () => {
      cancelAutoAdvance();
      const baseTeams = teams.length > 0 ? teams : (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS);
      const freshTeams: Team[] = baseTeams.map((t) => ({
        ...t,
        initialPurse: 10000,
        remainingPurse: 10000,
        players: [],
        playerCount: 0,
      }));

      clearLocalPlayersForTournament(tournamentId);
      setPlayerPool([]);
      setCurrentPlayer(null);
      setTeams(freshTeams);
      setSelectedCategory('all');
      setSalesHistory([]);

      try {
        localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(freshTeams));
        localStorage.setItem('kapl_teams', JSON.stringify(freshTeams));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: freshTeams }));
        }
      } catch {}

      broadcastAuctionEvent('auction_cleared', { teams: freshTeams });

      try {
        const now = new Date().toISOString();
        await supabase.from('auction_bids').delete().eq('tournament_id', tournamentId);
        await supabase.from('players').delete().or(`tournament_id.eq.${tournamentId},tournament_id.eq.all`);
        await supabase
          .from('teams')
          .update({ remaining_purse: 10000, players: [] as any, player_count: 0, updated_at: now })
          .eq('tournament_id', tournamentId);
        await supabase
          .from('auction_state')
          .upsert({
            id: auctionState?.id || tournamentId,
            tournament_id: tournamentId,
            current_player_id: null,
            current_bid: 100,
            highest_bidder_team_id: null,
            status: 'idle',
            timer_ends_at: null,
            updated_at: now,
          });
      } catch (err: any) {
        console.warn('DB clear players background notice:', err);
      }

      return {
        success: true,
        message: 'All players cleared from the auction pool and franchise purses restored to ₹10,000.',
      };
    },
    refreshData: fetchData,
  };
}
