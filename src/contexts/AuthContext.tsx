import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { PlayerRecord, PlayerRole } from '@/lib/cricketTypes';
import { getTournamentPlayerId } from '@/lib/utils';
import { saveToPlayerVault } from '@/lib/exportRegistrations';

export const isValidUuid = (id?: string | null): boolean =>
  Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

const isMissingRpcError = (msg?: string, code?: string): boolean => {
  const lower = (msg || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    lower.includes('could not find the function') ||
    lower.includes('does not exist')
  );
};

async function syncRoleRpcByEmail(
  action: 'assign' | 'revoke',
  cleanEmail: string,
  role?: UserRole | null,
  hasSession?: boolean
): Promise<{ error: Error | null }> {
  if (!hasSession) return { error: null };
  const isElevatedRole = Boolean(role && role !== 'player' && role !== 'user');
  const { error } =
    action === 'assign' && isElevatedRole
      ? await supabase.rpc('admin_assign_role_by_email', {
          p_email: cleanEmail,
          p_role: role as any,
        })
      : await supabase.rpc('admin_revoke_role_by_email', {
          p_email: cleanEmail,
          p_role: isElevatedRole ? (role as any) : null,
        });

  if (error && !isMissingRpcError(error.message, error.code)) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function syncPlayerToAuctionAndTournament(playerRecord: PlayerRecord) {
  try {
    const targetTournaments =
      !playerRecord.tournamentId || playerRecord.tournamentId === 'all'
        ? ['kapl-3-mens', 'kapl-3-womens']
        : [playerRecord.tournamentId];
    localStorage.removeItem('kapl_all_players_cleared');
    targetTournaments.forEach((tId) => localStorage.removeItem(`kapl_everything_reset_${tId}`));

    // 0. Save permanently to registration vault
    saveToPlayerVault(playerRecord);

    // 1. Update master kapl_registered_players
    const regRaw = localStorage.getItem('kapl_registered_players');
    const regList: PlayerRecord[] = regRaw ? JSON.parse(regRaw) : [];
    const regIdx = regList.findIndex(
      (p) => p.id === playerRecord.id || (p.userId && playerRecord.userId && p.userId === playerRecord.userId)
    );
    if (regIdx >= 0) {
      regList[regIdx] = { ...regList[regIdx], ...playerRecord };
    } else {
      regList.push(playerRecord);
    }
    localStorage.setItem('kapl_registered_players', JSON.stringify(regList));

    // 2. Update auction pool for the target league(s) while preserving existing auction outcomes
    for (const tId of targetTournaments) {
      const auctionRaw = localStorage.getItem(`kapl_auction_players_${tId}`);
      let auctionList: PlayerRecord[] = [];
      if (auctionRaw) {
        try {
          const parsed = JSON.parse(auctionRaw);
          if (Array.isArray(parsed)) {
            auctionList = parsed.filter((p: any) => p && !/^[ab][1-4]-/.test(p.id));
          }
        } catch {}
      }
      const tournRecordId = getTournamentPlayerId(playerRecord.id, tId, playerRecord.name);
      const tournRecord: PlayerRecord = {
        ...playerRecord,
        id: tournRecordId || playerRecord.id,
        tournamentId: tId,
      };
      const aucIdx = auctionList.findIndex(
        (p) => p.id === tournRecord.id || (p.userId && tournRecord.userId && p.userId === tournRecord.userId)
      );
      if (aucIdx >= 0) {
        auctionList[aucIdx] = { ...tournRecord, ...auctionList[aucIdx], id: tournRecord.id, tournamentId: tId };
      } else {
        auctionList.push(tournRecord);
      }
      localStorage.setItem(`kapl_auction_players_${tId}`, JSON.stringify(auctionList));

      // Ensure active player exists for live bidding
      const activeId = localStorage.getItem(`kapl_auction_active_player_${tId}`);
      if (!activeId || auctionList.length === 1) {
        localStorage.setItem(`kapl_auction_active_player_${tId}`, tournRecord.id);
      }
    }

    // 3. Dispatch window events for instantaneous in-tab reactiveness
    // Dispatch for each tournament separately so filters work correctly
    if (typeof window !== 'undefined') {
      const tournamentsToDispatch = playerRecord.tournamentId === 'all'
        ? ['kapl-3-mens', 'kapl-3-womens']
        : [playerRecord.tournamentId || 'kapl-3-mens'];

      for (const tId of tournamentsToDispatch) {
        const tournRecordId = getTournamentPlayerId(playerRecord.id, tId, playerRecord.name);
        const dispatchRecord = { ...playerRecord, id: tournRecordId || playerRecord.id, tournamentId: tId };
        window.dispatchEvent(
          new CustomEvent('kapl_player_added', {
            detail: { player: dispatchRecord, tournamentId: tId },
          })
        );
        window.dispatchEvent(
          new CustomEvent('kapl-auction-local-update', {
            detail: {
              event: 'auction_player_added',
              player: dispatchRecord,
              tournamentId: tId,
            },
          })
        );
      }
    }

    // 4. Cross-tab synchronization via BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const broadcastTournId = playerRecord.tournamentId || 'all';
        const tabChannel = new BroadcastChannel('kapl-shared-tab-channel');
        tabChannel.postMessage({
          event: 'auction_player_added',
          player: playerRecord,
          tournamentId: broadcastTournId,
        });

        const aucTabChannel = new BroadcastChannel('kapl_auction_tab_sync');
        aucTabChannel.postMessage({
          event: 'auction_player_added',
          player: playerRecord,
          tournamentId: broadcastTournId,
        });

        setTimeout(() => {
          tabChannel.close();
          aucTabChannel.close();
        }, 1000);
      }
    } catch {}

    // 5. Broadcast to Supabase channels for both Men's and Women's leagues
    for (const tId of targetTournaments) {
      try {
        const tournRecord = { ...playerRecord, tournamentId: tId };
        const auctionChannel = supabase.channel(`auction-room-${tId}`);
        await auctionChannel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_player_added',
            player: tournRecord,
            tournamentId: tId,
          },
        });

        const dirChannel = supabase.channel(`player-dir-auction-sync-${tId}`);
        await dirChannel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_player_added',
            player: tournRecord,
            tournamentId: tId,
          },
        });
      } catch {}
    }

    // Global Live Match store channel
    try {
      const globalChannel = supabase.channel('kapl-live-match-sync');
      await globalChannel.send({
        type: 'broadcast',
        event: 'auction_player_added',
        payload: {
          player: playerRecord,
          tournamentId: 'all',
        },
      });
    } catch {}
  } catch (e) {
    console.warn('Failed to sync player to auction and tournament:', e);
  }
}

export type UserRole = 'admin' | 'co_admin' | 'primary_scorer' | 'secondary_scorer' | 'owner' | 'captain' | 'player' | 'user' | null;

export type KaplExperienceLevel = 'new' | 'season_2' | 'season_1' | 'veteran';

export interface SignUpMetadata {
  name: string;
  mobileNumber?: string;
  role?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  jerseyNumber?: number | null;
  bio?: string;
  tournamentId?: string;
  accountType?: 'player' | 'owner' | 'captain' | 'spectator' | 'user';
  photoUrl?: string;
  gender?: 'male' | 'female';
  experience?: KaplExperienceLevel;
  previousTeam?: string;
  pastAchievements?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
  jerseyNumber?: number | null;
  mobileNumber?: string | null;
  bio?: string;
  tournamentId?: string;
  playerId?: string | null;
  gender?: 'male' | 'female';
  experience?: KaplExperienceLevel;
  previousTeam?: string;
  pastAchievements?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoAdmin: boolean;
  isSuperAdmin: boolean;
  isMainAdmin: boolean;
  isScorer: boolean;
  isOwner: boolean;
  isCaptain: boolean;
  isPlayer: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadataOrRole?: string | SignUpMetadata) => Promise<{ error: Error | null }>;
  changePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshUserRole: () => Promise<void>;
  assignUserRole: (userId: string, role: UserRole) => Promise<{ error: Error | null }>;
  revokeUserRole: (userId: string, role?: UserRole) => Promise<{ error: Error | null }>;
  assignRoleByEmail: (
    email: string,
    role: UserRole,
    details?: { title?: string; teamName?: string; teamId?: string; assignedBy?: string; userId?: string }
  ) => Promise<{ error: Error | null }>;
  revokeRoleByEmail: (email: string, role?: UserRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userObj: User): Promise<UserProfile> => {
    const meta = userObj.user_metadata || {};
    const defaultName =
      meta.name ||
      meta.full_name ||
      userObj.email?.split('@')[0] ||
      'Player';
    const defaultPhoto = meta.avatar_url || meta.picture || '';

    // Check localStorage cache
    let localProfile: Partial<UserProfile> = {};
    try {
      const raw =
        localStorage.getItem(`kapl_profile_${userObj.id}`) ||
        (userObj.email ? localStorage.getItem(`kapl_profile_${userObj.email.toLowerCase()}`) : null);
      if (raw) localProfile = JSON.parse(raw);
    } catch {}

    let dbPlayer: any = null;
    try {
      const { data: privData } = await supabase.rpc('get_my_private_player_profile');
      if (privData) {
        dbPlayer = privData;
      } else if (localProfile.playerId) {
        const { data } = await supabase
          .from('players')
          .select('id, name, photo_url, role, batting_style, bowling_style, tournament_id, team_id, jersey_number, base_price, sold_price, auction_status, created_at, updated_at')
          .eq('id', localProfile.playerId)
          .maybeSingle();
        if (data) dbPlayer = data;
      }
    } catch (e) {
      console.warn('Could not query players table for user profile:', e);
    }

    // If authenticated user does not have a database player record, create it now!
    if (!dbPlayer && isValidUuid(userObj.id)) {
      try {
        const genId = localProfile.playerId || `p_u_${userObj.id.replace(/-/g, '').slice(0, 10)}`;
        const pTournament = localProfile.tournamentId || meta.tournament_id || 'kapl-3-mens';
        const pRole = localProfile.role || meta.role || 'all_rounder';
        const pName = localProfile.name || defaultName;
        
        const { error: insErr } = await supabase.from('players').insert({
          id: genId,
          user_id: userObj.id,
          name: pName,
          photo_url: localProfile.photoUrl || defaultPhoto || null,
          role: pRole,
          batting_style: localProfile.battingStyle || meta.batting_style || 'Right-hand bat',
          bowling_style: localProfile.bowlingStyle || meta.bowling_style || 'Right-arm medium',
          jersey_number: localProfile.jerseyNumber ? Number(localProfile.jerseyNumber) : (meta.jersey_number ? Number(meta.jersey_number) : null),
          mobile_number: localProfile.mobileNumber || meta.phone || null,
          tournament_id: pTournament,
          base_price: 100,
          auction_status: 'pending',
        });

        if (insErr && (insErr.message?.toLowerCase().includes('foreign key') || insErr.code === '23503')) {
          await supabase.from('players').insert({
            id: genId,
            user_id: null,
            name: pName,
            photo_url: localProfile.photoUrl || defaultPhoto || null,
            role: pRole,
            batting_style: localProfile.battingStyle || meta.batting_style || 'Right-hand bat',
            bowling_style: localProfile.bowlingStyle || meta.bowling_style || 'Right-arm medium',
            jersey_number: localProfile.jerseyNumber ? Number(localProfile.jerseyNumber) : (meta.jersey_number ? Number(meta.jersey_number) : null),
            mobile_number: localProfile.mobileNumber || meta.phone || null,
            tournament_id: pTournament,
            base_price: 100,
            auction_status: 'pending',
          });
        }
      } catch (e) {
        console.warn('Auto player sync on fetchUserProfile exception:', e);
      }
    }

    const merged: UserProfile = {
      name: dbPlayer?.name || localProfile.name || defaultName,
      email: userObj.email || '',
      photoUrl: dbPlayer?.photo_url || localProfile.photoUrl || defaultPhoto,
      role: dbPlayer?.role || localProfile.role || meta.role || 'all_rounder',
      battingStyle: dbPlayer?.batting_style || localProfile.battingStyle || meta.batting_style || 'Right-hand bat',
      bowlingStyle: dbPlayer?.bowling_style || localProfile.bowlingStyle || meta.bowling_style || 'Right-arm medium',
      jerseyNumber: dbPlayer?.jersey_number ?? localProfile.jerseyNumber ?? (meta.jersey_number !== undefined && meta.jersey_number !== null ? Number(meta.jersey_number) : null),
      mobileNumber: dbPlayer?.mobile_number ?? localProfile.mobileNumber ?? meta.phone ?? null,
      bio: localProfile.bio || meta.bio || '',
      tournamentId: dbPlayer?.tournament_id || localProfile.tournamentId || meta.tournament_id || 'kapl-3-mens',
      playerId: dbPlayer?.id || localProfile.playerId || null,
      gender: localProfile.gender || meta.gender || (meta.tournament_id === 'kapl-3-womens' ? 'female' : 'male'),
      experience: localProfile.experience || meta.experience || 'new',
      previousTeam: localProfile.previousTeam || meta.previous_team || '',
      pastAchievements: localProfile.pastAchievements || meta.past_achievements || '',
    };

    return merged;
  }, []);

  const fetchUserRole = useCallback(async (userId: string, userEmail?: string | null): Promise<UserRole> => {
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    // Rohit Doshi is permanent super admin
    if (cleanEmail === 'rohit.doshi2007@gmail.com') {
      return 'admin';
    }

    // Check pre-assigned role by email in localStorage
    if (cleanEmail) {
      try {
        const storedRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
        const assignedRole = storedRoles[cleanEmail];
        if (assignedRole) {
          return assignedRole as UserRole;
        }

        // Check rich role assignments
        const assignments = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
        if (assignments[cleanEmail]?.role) {
          return assignments[cleanEmail].role as UserRole;
        }

        // Check if assigned as owner in team metadata
        const metaMap = JSON.parse(localStorage.getItem('kapl_team_metadata') || '{}');
        for (const tId of Object.keys(metaMap)) {
          const meta = metaMap[tId];
          if (meta?.ownerEmail && String(meta.ownerEmail).toLowerCase().trim() === cleanEmail) {
            return 'owner';
          }
        }
      } catch (e) {}
    }

    try {
      if (isValidUuid(userId)) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (!error && data && data.length > 0) {
          const roles = data.map(r => r.role);
          if (roles.includes('admin')) return 'admin';
          if (roles.includes('co_admin')) return 'co_admin';
          if (roles.includes('primary_scorer')) return 'primary_scorer';
          if (roles.includes('secondary_scorer')) return 'secondary_scorer';
          if (roles.includes('owner')) return 'owner';
          if (roles.includes('captain')) return 'captain';
          if (roles.includes('player')) return 'player';
        }
      }

      // Check Supabase teams table so Team Owner assignments by email or user UUID work across devices
      if (cleanEmail || isValidUuid(userId)) {
        const { data: teamRows } = await supabase
          .from('teams')
          .select('id, owner_email, owner_user_id');

        if (teamRows && teamRows.length > 0) {
          const ownsTeam = teamRows.some((t) => {
            const matchesEmail = cleanEmail && (t.owner_email || '').toLowerCase().trim() === cleanEmail;
            const matchesUuid = isValidUuid(userId) && t.owner_user_id === userId;
            return Boolean(matchesEmail || matchesUuid);
          });
          if (ownsTeam) return 'owner';
        }
      }

      return 'player';
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return isValidUuid(userId) ? null : 'player';
    }
  }, []);

  const refreshUserRole = useCallback(async () => {
    if (user) {
      const role = await fetchUserRole(user.id, user.email);
      setUserRole(role);
      const prof = await fetchUserProfile(user);
      setProfile(prof);
    }
  }, [user, fetchUserRole, fetchUserProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error('You must be signed in to update your profile.') };
    }

    try {
      const current = profile || await fetchUserProfile(user);
      const updated: UserProfile = {
        name: updates.name?.trim() || current.name || user.email?.split('@')[0] || 'Player',
        email: user.email || '',
        photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : (current.photoUrl || ''),
        role: updates.role || current.role || 'all_rounder',
        battingStyle: updates.battingStyle || current.battingStyle || 'Right-hand bat',
        bowlingStyle: updates.bowlingStyle || current.bowlingStyle || 'Right-arm medium',
        jerseyNumber: updates.jerseyNumber !== undefined ? updates.jerseyNumber : current.jerseyNumber,
        mobileNumber: updates.mobileNumber !== undefined ? updates.mobileNumber : current.mobileNumber,
        bio: updates.bio !== undefined ? updates.bio : current.bio,
        tournamentId: updates.tournamentId || current.tournamentId || 'kapl-3-mens',
        playerId: current.playerId,
      };

      // 1. Update Supabase Auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            name: updated.name,
            avatar_url: updated.photoUrl,
            phone: updated.mobileNumber,
          },
        });
      } catch (e) {
        console.warn('Could not update user metadata:', e);
      }

      // 2. Persist to localStorage
      try {
        localStorage.setItem(`kapl_profile_${user.id}`, JSON.stringify(updated));
        if (user.email) {
          localStorage.setItem(`kapl_profile_${user.email.toLowerCase()}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn('Could not save profile to localStorage:', e);
      }

      // 3. Sync with database players table
      try {
        const safeUserId = isValidUuid(user.id) ? user.id : null;
        let existingPlayer: any = null;
        const targetPlayerId = current.playerId || (user.id ? `p_u_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}` : null);

        if (targetPlayerId) {
          const { data } = await supabase
            .from('players')
            .select('id')
            .eq('id', targetPlayerId)
            .maybeSingle();
          existingPlayer = data;
        }

        if (existingPlayer) {
          await supabase
            .from('players')
            .update({
              name: updated.name,
              photo_url: updated.photoUrl || null,
              role: updated.role,
              batting_style: updated.battingStyle || null,
              bowling_style: updated.bowlingStyle || null,
              jersey_number: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
              mobile_number: updated.mobileNumber || null,
              tournament_id: updated.tournamentId || 'kapl-3-mens',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPlayer.id);
          updated.playerId = existingPlayer.id;
        } else if (targetPlayerId) {
          const { error: insErr } = await supabase
            .from('players')
            .insert({
              id: targetPlayerId,
              user_id: safeUserId,
              name: updated.name,
              photo_url: updated.photoUrl || null,
              role: updated.role,
              batting_style: updated.battingStyle || null,
              bowling_style: updated.bowlingStyle || null,
              jersey_number: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
              mobile_number: updated.mobileNumber || null,
              tournament_id: updated.tournamentId || 'kapl-3-mens',
              base_price: 100,
              auction_status: 'pending',
            });
          if (insErr && (insErr.message?.toLowerCase().includes('foreign key') || insErr.code === '23503')) {
            await supabase
              .from('players')
              .insert({
                id: targetPlayerId,
                user_id: null,
                name: updated.name,
                photo_url: updated.photoUrl || null,
                role: updated.role,
                batting_style: updated.battingStyle || null,
                bowling_style: updated.bowlingStyle || null,
                jersey_number: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
                mobile_number: updated.mobileNumber || null,
                tournament_id: updated.tournamentId || 'kapl-3-mens',
                base_price: 100,
                auction_status: 'pending',
              });
          }
          updated.playerId = targetPlayerId;
        }

        // Look up existing player record in kapl_registered_players to preserve team/sold states
        let existingAuctionStatus: any = 'pending';
        let existingTeamId: string | null = null;
        let existingSoldPrice: number | null = null;
        try {
          const regRaw = localStorage.getItem('kapl_registered_players');
          if (regRaw) {
            const regList: PlayerRecord[] = JSON.parse(regRaw);
            const found = regList.find(p => p.id === targetPlayerId || (p.userId && p.userId === user.id));
            if (found) {
              existingAuctionStatus = found.auctionStatus || 'pending';
              existingTeamId = found.teamId || null;
              existingSoldPrice = found.soldPrice || null;
            }
          }
        } catch {}

        const finalPlayerId = updated.playerId || targetPlayerId || `p_u_${user.id.slice(0, 8)}`;
        const updatedRecord: PlayerRecord = {
          id: finalPlayerId,
          tournamentId: updated.tournamentId || 'kapl-3-mens',
          teamId: existingTeamId,
          userId: user.id,
          name: updated.name,
          role: (updated.role as PlayerRole) || 'all_rounder',
          battingStyle: updated.battingStyle || 'Right-hand bat',
          bowlingStyle: updated.bowlingStyle || 'Right-arm medium',
          photoUrl: updated.photoUrl || null,
          basePrice: 100,
          soldPrice: existingSoldPrice,
          auctionStatus: existingAuctionStatus,
          jerseyNumber: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
          mobileNumber: updated.mobileNumber || null,
          updatedAt: new Date().toISOString(),
        };

        saveToPlayerVault({ ...updatedRecord, email: user.email || '' });
        syncPlayerToAuctionAndTournament(updatedRecord);
      } catch (dbErr) {
        console.warn('Non-fatal error syncing player record with database:', dbErr);
      }

      setProfile(updated);
      return { error: null };
    } catch (err: any) {
      console.error('Error in updateProfile:', err);
      return { error: new Error(err.message || 'Failed to update profile') };
    }
  }, [user, profile, fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never stay stuck on loading for more than 1.5s
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 1500);

    const checkSession = async () => {
      try {
        const { data: { session: supaSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (!supaSession?.user) {
          try {
            localStorage.removeItem('kapl_active_session');
            localStorage.removeItem('kapl_active_user');
          } catch {}
        }

        const effectiveSession = supaSession ?? null;
        setSession(effectiveSession);
        setUser(effectiveSession?.user ?? null);

        if (effectiveSession?.user) {
          const cleanEmail = (effectiveSession.user.email || '').toLowerCase().trim();
          if (cleanEmail === 'rohit.doshi2007@gmail.com') {
            setUserRole('admin');
          }
          const [role, prof] = await Promise.all([
            fetchUserRole(effectiveSession.user.id, effectiveSession.user.email),
            fetchUserProfile(effectiveSession.user),
          ]);
          if (isMounted) {
            setUserRole(cleanEmail === 'rohit.doshi2007@gmail.com' ? 'admin' : role);
            setProfile(prof);
            setIsLoading(false);
          }
        } else {
          if (isMounted) {
            setUserRole(null);
            setProfile(null);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn('Session check error, resolving loading:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session) {
        try {
          localStorage.setItem('kapl_active_session', JSON.stringify(session));
          localStorage.setItem('kapl_active_user', JSON.stringify(session.user));
        } catch {}
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const cleanEmail = (session.user.email || '').toLowerCase().trim();
        if (cleanEmail === 'rohit.doshi2007@gmail.com') {
          setUserRole('admin');
        }
        try {
          const [role, prof] = await Promise.all([
            fetchUserRole(session.user.id, session.user.email),
            fetchUserProfile(session.user),
          ]);
          if (isMounted) {
            setUserRole(cleanEmail === 'rohit.doshi2007@gmail.com' ? 'admin' : role);
            setProfile(prof);
            setIsLoading(false);
          }
        } catch {
          if (isMounted) setIsLoading(false);
        }
      } else {
        try {
          localStorage.removeItem('kapl_active_session');
          localStorage.removeItem('kapl_active_user');
        } catch {}
        if (isMounted) {
          setUserRole(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchUserRole, fetchUserProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();

    // 1. First attempt Supabase native sign in
    let supaError: Error | null = null;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data?.session) {
        setSession(data.session);
        setUser(data.user);
        try {
          localStorage.setItem('kapl_active_session', JSON.stringify(data.session));
          localStorage.setItem('kapl_active_user', JSON.stringify(data.user));
        } catch {}
        const [role, prof] = await Promise.all([
          fetchUserRole(data.user.id, cleanEmail),
          fetchUserProfile(data.user),
        ]);
        setUserRole(role);
        setProfile(prof);
        return { error: null };
      }

      supaError = error ? new Error(error.message) : new Error('No active Supabase session returned. Check Email confirmation or credentials.');
    } catch (e: any) {
      supaError = e instanceof Error ? e : new Error(String(e?.message || 'Sign in failed'));
    }

    return { error: supaError };
  }, [fetchUserRole, fetchUserProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadataOrRole?: string | SignUpMetadata
  ) => {
    const meta: SignUpMetadata = typeof metadataOrRole === 'string'
      ? { name: email.split('@')[0], role: metadataOrRole }
      : (metadataOrRole || { name: email.split('@')[0] });

    const cleanEmail = email.toLowerCase().trim();
    const effectiveRole = meta.role || 'all_rounder';
    const effectiveAccountType = meta.accountType || (meta.role ? 'player' : 'player');

    // 1. Attempt Supabase Auth creation in background (email confirmation disabled)
    let supaUser: User | null = null;
    let supaSession: Session | null = null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: meta.name,
            full_name: meta.name,
            phone: meta.mobileNumber || null,
            desired_role: effectiveAccountType,
            account_type: effectiveAccountType,
            role: effectiveRole,
            batting_style: meta.battingStyle || 'Right-hand bat',
            bowling_style: meta.bowlingStyle || 'Right-arm medium',
            jersey_number: meta.jerseyNumber ?? null,
            tournament_id: meta.tournamentId || 'kapl-3-mens',
            gender: meta.gender || (meta.tournamentId === 'kapl-3-womens' ? 'female' : 'male'),
            experience: meta.experience || 'new',
            previous_team: meta.previousTeam || '',
            past_achievements: meta.pastAchievements || '',
            bio: meta.bio || '',
          },
        },
      });

      if (!error && data?.user) {
        supaUser = data.user;
        supaSession = data.session;
      } else if (error) {
        const msg = error.message.toLowerCase();
        // Disregard email rate limit or mailer errors as email confirmation is intentionally removed
        if (msg.includes('rate limit') || msg.includes('email_send') || msg.includes('mailer')) {
          console.warn('Supabase mailer rate limit bypassed (email confirmation removed):', error.message);
        } else if (msg.includes('already registered')) {
          return { error: new Error('This email is already registered. Please sign in instead.') };
        } else {
          console.warn('Supabase auth notice:', error.message);
        }
      }
    } catch (e: any) {
      console.warn('Supabase signUp network notice:', e);
    }

    // 2. Build verified active user immediately without requiring email confirmation
    const effectiveUserId = supaUser?.id || `u_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const generatedPlayerId = `p_u_${effectiveUserId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
    const safeDbUserId = isValidUuid(supaUser?.id) ? supaUser!.id : null;

    const profileData: UserProfile = {
      name: meta.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      photoUrl: meta.photoUrl || '',
      role: effectiveRole,
      battingStyle: meta.battingStyle || 'Right-hand bat',
      bowlingStyle: meta.bowlingStyle || 'Right-arm medium',
      jerseyNumber: meta.jerseyNumber ?? null,
      mobileNumber: meta.mobileNumber ?? null,
      bio: meta.bio || '',
      tournamentId: meta.tournamentId || 'kapl-3-mens',
      playerId: generatedPlayerId,
      gender: meta.gender || (meta.tournamentId === 'kapl-3-womens' ? 'female' : 'male'),
      experience: meta.experience || 'new',
      previousTeam: meta.previousTeam,
      pastAchievements: meta.pastAchievements,
    };

    const activeUser: User = supaUser
      ? ({
          ...supaUser,
          email_confirmed_at: supaUser.email_confirmed_at || new Date().toISOString(),
          confirmed_at: (supaUser as any).confirmed_at || new Date().toISOString(),
        } as User)
      : ({
          id: effectiveUserId,
          app_metadata: { provider: 'email' },
          user_metadata: {
            name: meta.name,
            full_name: meta.name,
            phone: meta.mobileNumber || null,
            desired_role: effectiveAccountType,
            account_type: effectiveAccountType,
            role: effectiveRole,
            batting_style: meta.battingStyle || 'Right-hand bat',
            bowling_style: meta.bowlingStyle || 'Right-arm medium',
            jersey_number: meta.jerseyNumber ?? null,
            tournament_id: meta.tournamentId || 'kapl-3-mens',
            gender: meta.gender || (meta.tournamentId === 'kapl-3-womens' ? 'female' : 'male'),
            experience: meta.experience || 'new',
            previous_team: meta.previousTeam || '',
            past_achievements: meta.pastAchievements || '',
            bio: meta.bio || '',
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: cleanEmail,
          email_confirmed_at: new Date().toISOString(),
          phone: meta.mobileNumber || '',
          role: 'authenticated',
          updated_at: new Date().toISOString(),
        } as User);

    const activeSession: Session = supaSession || ({
      access_token: `kapl_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      refresh_token: `kapl_ref_${Date.now()}`,
      expires_in: 3600 * 24 * 365,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
      token_type: 'bearer',
      user: activeUser,
    } as Session);

    // 3. Immediately persist profile and active session for zero-latency authentication
    try {
      localStorage.setItem(`kapl_profile_${activeUser.id}`, JSON.stringify(profileData));
      localStorage.setItem(`kapl_profile_${cleanEmail}`, JSON.stringify(profileData));
      localStorage.setItem('kapl_active_session', JSON.stringify(activeSession));
      localStorage.setItem('kapl_active_user', JSON.stringify(activeUser));

      const registeredAccounts = JSON.parse(localStorage.getItem('kapl_registered_accounts') || '{}');
      registeredAccounts[cleanEmail] = {
        id: activeUser.id,
        email: cleanEmail,
        password: password,
        name: profileData.name,
        role: effectiveAccountType,
        profile: profileData,
        registeredAt: new Date().toISOString(),
      };
      localStorage.setItem('kapl_registered_accounts', JSON.stringify(registeredAccounts));

      if (effectiveAccountType === 'owner') {
        const emailRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
        emailRoles[cleanEmail] = 'owner';
        localStorage.setItem('kapl_email_roles', JSON.stringify(emailRoles));
      } else if (effectiveAccountType === 'captain') {
        const emailRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
        emailRoles[cleanEmail] = 'captain';
        localStorage.setItem('kapl_email_roles', JSON.stringify(emailRoles));
      }
    } catch (e) {
      console.warn('Could not store profile in localStorage:', e);
    }

    const roleToAssign = effectiveAccountType === 'owner'
      ? 'owner'
      : effectiveAccountType === 'captain'
      ? 'captain'
      : effectiveAccountType === 'spectator'
      ? 'user'
      : 'player';

    if (supaUser?.id) {
      try {
        await supabase
          .from('user_roles')
          .insert({ user_id: supaUser.id, role: roleToAssign as any })
          .select();
      } catch (e) {
        console.warn('Could not assign role directly:', e);
      }
    }

    const newPlayerRecord: PlayerRecord = {
      id: generatedPlayerId,
      tournamentId: 'all', // Entered into both tournaments
      teamId: null,
      userId: supaUser?.id || activeUser.id,
      name: profileData.name,
      role: (profileData.role as PlayerRole) || 'all_rounder',
      battingStyle: profileData.battingStyle || 'Right-hand bat',
      bowlingStyle: profileData.bowlingStyle || 'Right-arm medium',
      photoUrl: profileData.photoUrl || null,
      basePrice: 100,
      soldPrice: null,
      auctionStatus: 'pending',
      jerseyNumber: profileData.jerseyNumber ? Number(profileData.jerseyNumber) : null,
      mobileNumber: profileData.mobileNumber || null,
      gender: profileData.gender || 'male',
      experience: meta.experience || 'new',
      previousTeam: meta.previousTeam,
      pastAchievements: meta.pastAchievements,
      bio: meta.bio,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save permanently to unresettable player vault
    saveToPlayerVault({
      ...newPlayerRecord,
      email: cleanEmail,
      gender: profileData.gender,
    });

    if (effectiveAccountType === 'player' || effectiveAccountType === 'captain' || effectiveAccountType === 'user' || effectiveAccountType === 'spectator' || !effectiveAccountType) {
      const dualTournaments = ['kapl-3-mens', 'kapl-3-womens'];
      for (const tId of dualTournaments) {
        const idForTourn = tId === 'kapl-3-womens' ? `${generatedPlayerId}_w` : generatedPlayerId;
        // 1. Try atomic database RPC (bypasses RLS with SECURITY DEFINER)
        try {
          await supabase.rpc('register_new_player', {
            p_id: idForTourn,
            p_user_id: safeDbUserId,
            p_name: profileData.name,
            p_role: profileData.role,
            p_batting_style: profileData.battingStyle || 'Right-hand bat',
            p_bowling_style: profileData.bowlingStyle || 'Right-arm medium',
            p_jersey_number: profileData.jerseyNumber ? Number(profileData.jerseyNumber) : null,
            p_mobile_number: profileData.mobileNumber || null,
            p_photo_url: profileData.photoUrl || null,
            p_tournament_id: tId,
            p_base_price: 100,
          });
        } catch (rpcErr) {
          console.warn(`register_new_player RPC notice (${tId}):`, rpcErr);
        }

        // 2. Direct database insert with resilient fallback
        try {
          const { error: insErr } = await supabase.from('players').insert({
            id: idForTourn,
            user_id: safeDbUserId,
            name: profileData.name,
            photo_url: profileData.photoUrl || null,
            role: profileData.role,
            batting_style: profileData.battingStyle || null,
            bowling_style: profileData.bowlingStyle || null,
            jersey_number: profileData.jerseyNumber ? Number(profileData.jerseyNumber) : null,
            mobile_number: profileData.mobileNumber || null,
            tournament_id: tId,
            base_price: 100,
            auction_status: 'pending',
          });

          if (insErr) {
            if (insErr.message?.toLowerCase().includes('foreign key') || insErr.code === '23503') {
              await supabase.from('players').insert({
                id: idForTourn,
                user_id: null,
                name: profileData.name,
                photo_url: profileData.photoUrl || null,
                role: profileData.role,
                batting_style: profileData.battingStyle || null,
                bowling_style: profileData.bowlingStyle || null,
                jersey_number: profileData.jerseyNumber ? Number(profileData.jerseyNumber) : null,
                mobile_number: profileData.mobileNumber || null,
                tournament_id: tId,
                base_price: 100,
                auction_status: 'pending',
              });
            } else if (insErr.code === '23505') {
              await supabase.from('players').update({
                name: profileData.name,
                photo_url: profileData.photoUrl || null,
                role: profileData.role,
                batting_style: profileData.battingStyle || null,
                bowling_style: profileData.bowlingStyle || null,
                jersey_number: profileData.jerseyNumber ? Number(profileData.jerseyNumber) : null,
                mobile_number: profileData.mobileNumber || null,
                tournament_id: tId,
              }).eq('id', idForTourn);
            }
          }
        } catch (dbErr) {
          console.warn(`Could not insert new player into players table (${tId}):`, dbErr);
        }
      }

      // 3. Sync player to auction and directory across all roles and tabs
      await syncPlayerToAuctionAndTournament(newPlayerRecord);
    }

    // Set state immediately - user is now 100% active and logged in
    setSession(activeSession);
    setUser(activeUser);
    setProfile(profileData);
    setUserRole(roleToAssign as any);
    setIsLoading(false);

    return { error: null };
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!newPassword || newPassword.length < 8) {
      return { error: new Error('Password must be at least 8 characters') };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const revokeUserRole = useCallback(async (userId: string, role?: UserRole) => {
    if (!isValidUuid(userId)) return { error: null };
    try {
      const baseQuery = supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error } = role && role !== 'player' && role !== 'user'
        ? await baseQuery.eq('role', role as any)
        : await baseQuery.in('role', ['co_admin', 'owner', 'primary_scorer', 'secondary_scorer', 'captain'] as any);

      return { error: error ? new Error(error.message) : null };
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to revoke role') };
    }
  }, []);

  const assignUserRole = useCallback(async (userId: string, role: UserRole) => {
    if (!isValidUuid(userId)) return { error: null };
    if (!role || role === 'player' || role === 'user') {
      return revokeUserRole(userId);
    }
    try {
      const { data: existing, error: selErr } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', userId);

      if (selErr) {
        return { error: new Error(selErr.message) };
      }

      if (existing && existing.some((r) => r.role === (role as any))) {
        return { error: null };
      }

      // Remove stale elevated roles first to keep a single effective elevated role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .in('role', ['co_admin', 'owner', 'primary_scorer', 'secondary_scorer', 'captain'] as any);

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: role as any });
      return { error: error ? new Error(error.message) : null };
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to assign role') };
    }
  }, [revokeUserRole]);

  const assignRoleByEmail = useCallback(async (
    email: string,
    role: UserRole,
    details?: { title?: string; teamName?: string; teamId?: string; assignedBy?: string; userId?: string }
  ) => {
    if (!email.trim() || !role) return { error: null };
    try {
      const cleanEmail = email.toLowerCase().trim();
      const rpcRes = await syncRoleRpcByEmail('assign', cleanEmail, role, Boolean(session?.user));
      if (rpcRes.error) return rpcRes;

      const storedRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
      storedRoles[cleanEmail] = role;
      localStorage.setItem('kapl_email_roles', JSON.stringify(storedRoles));

      const assignments = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
      assignments[cleanEmail] = {
        email: cleanEmail,
        role,
        title: details?.title,
        teamName: details?.teamName,
        teamId: details?.teamId,
        userId: details?.userId,
        assignedBy: details?.assignedBy || 'Rohit Doshi (Main Admin)',
        assignedAt: new Date().toISOString(),
      };
      localStorage.setItem('kapl_role_assignments', JSON.stringify(assignments));

      // If user currently signed in matches this email, immediately update active role
      if (user && user.email && user.email.toLowerCase().trim() === cleanEmail) {
        setUserRole(role);
      }
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to assign role by email') };
    }
  }, [user, session]);

  const revokeRoleByEmail = useCallback(async (email: string, role?: UserRole) => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return { error: null };
    try {
      const storedRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
      if (!role || storedRoles[cleanEmail] === role || role === 'owner' || role === 'co_admin') {
        delete storedRoles[cleanEmail];
        localStorage.setItem('kapl_email_roles', JSON.stringify(storedRoles));
      }

      const assignments = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
      if (!role || assignments[cleanEmail]?.role === role || role === 'owner' || role === 'co_admin') {
        delete assignments[cleanEmail];
        localStorage.setItem('kapl_role_assignments', JSON.stringify(assignments));
      }

      if (!role || role === 'co_admin') {
        const coAdmins = JSON.parse(localStorage.getItem('kapl_co_admins') || '[]');
        if (Array.isArray(coAdmins)) {
          const filtered = coAdmins.filter(
            (c: any) => (c?.email || '').toLowerCase().trim() !== cleanEmail
          );
          localStorage.setItem('kapl_co_admins', JSON.stringify(filtered));
        }
      }

      if (!role || role === 'owner') {
        const metaMap = JSON.parse(localStorage.getItem('kapl_team_metadata') || '{}');
        let metaChanged = false;
        for (const tId of Object.keys(metaMap)) {
          const meta = metaMap[tId];
          if ((meta?.ownerEmail || '').toLowerCase().trim() === cleanEmail) {
            metaMap[tId] = {
              ...meta,
              ownerName: null,
              ownerEmail: null,
              ownerUserId: null,
            };
            metaChanged = true;
            localStorage.removeItem(`kapl_team_meta_${tId}`);
          }
        }
        if (metaChanged) {
          localStorage.setItem('kapl_team_metadata', JSON.stringify(metaMap));
        }

        for (const tId of ['kapl-3-mens', 'kapl-3-womens']) {
          const rawTeams = localStorage.getItem(`kapl_auction_teams_${tId}`);
          if (rawTeams) {
            const parsed = JSON.parse(rawTeams);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.map((t: any) =>
                (t?.ownerEmail || '').toLowerCase().trim() === cleanEmail
                  ? { ...t, ownerName: undefined, ownerEmail: null, ownerUserId: null }
                  : t
              );
              localStorage.setItem(`kapl_auction_teams_${tId}`, JSON.stringify(cleaned));
            }
          }
        }

        const registeredAccounts = JSON.parse(localStorage.getItem('kapl_registered_accounts') || '{}');
        if (registeredAccounts[cleanEmail] && registeredAccounts[cleanEmail].role === 'owner') {
          registeredAccounts[cleanEmail].role = 'player';
          localStorage.setItem('kapl_registered_accounts', JSON.stringify(registeredAccounts));
        }
      }

      const rpcRes = await syncRoleRpcByEmail('revoke', cleanEmail, role, Boolean(session?.user));

      if (user && user.email && user.email.toLowerCase().trim() === cleanEmail) {
        setUserRole('player');
      }
      return rpcRes;
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to revoke role by email') };
    }
  }, [user, session]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem('kapl_active_session');
      localStorage.removeItem('kapl_active_user');
      localStorage.removeItem('kapl_ground_override');
      sessionStorage.removeItem('kapl_ground_override');
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setSession(null);
    setUserRole(null);
    setProfile(null);
    return { error: null };
  }, []);

  const cleanUserEmail = (user?.email || session?.user?.email || '').toLowerCase().trim();
  const isMainAdmin = cleanUserEmail === 'rohit.doshi2007@gmail.com';

  const hasGroundOverride = typeof window !== 'undefined' && (
    localStorage.getItem('kapl_ground_override') === 'admin' ||
    sessionStorage.getItem('kapl_ground_override') === 'admin'
  );

  const effectiveUserRole: UserRole = isMainAdmin || hasGroundOverride ? 'admin' : userRole;
  const isCoAdmin = !isMainAdmin && !hasGroundOverride && effectiveUserRole === 'co_admin';
  const isSuperAdmin = isMainAdmin || (effectiveUserRole === 'admin' && !isCoAdmin);
  const isAdmin = isMainAdmin || hasGroundOverride || effectiveUserRole === 'admin' || effectiveUserRole === 'co_admin';
  const isScorer = isAdmin || effectiveUserRole === 'primary_scorer' || effectiveUserRole === 'secondary_scorer';
  const isOwner = effectiveUserRole === 'owner';
  const isCaptain = isAdmin || effectiveUserRole === 'captain';
  const isPlayer = !isAdmin && (effectiveUserRole === 'player' || !effectiveUserRole || effectiveUserRole === 'user');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole: effectiveUserRole,
        profile,
        isLoading,
        isAuthenticated: !!session || hasGroundOverride,
        isAdmin,
        isCoAdmin,
        isSuperAdmin,
        isMainAdmin,
        isScorer,
        isOwner,
        isCaptain,
        isPlayer,
        signInWithPassword,
        signUp,
        changePassword,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshUserRole,
        assignUserRole,
        revokeUserRole,
        assignRoleByEmail,
        revokeRoleByEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

