import * as XLSX from 'xlsx';
import { PlayerRecord } from './cricketTypes';
import { getTournamentPlayerId } from './utils';
import { supabase } from '@/integrations/supabase/client';

export interface RegistrationExportRow {
  'Player Name': string;
  'Email': string;
  'Phone Number': string;
  'Playing Role': string;
  'Batting Style': string;
  'Bowling Style': string;
  'Jersey Number': string | number;
  'Gender': string;
  'Tournament': string;
  'Base Price (₹)': number;
  'Auction Status': string;
  'Sold Price (₹)': string | number;
  'Allocated Team': string;
  'Added Date': string;
  'Player ID': string;
}

/**
 * Permanently save a player to the unresettable local vault.
 * This vault is NEVER touched by auction resets or seasonal clear commands.
 */
export function saveToPlayerVault(player: Partial<PlayerRecord> & { email?: string; gender?: string }) {
  try {
    if (!player || (!player.id && !player.name)) return;
    
    // Clear any lingering "cleared" flags
    localStorage.removeItem('kapl_all_players_cleared');
    localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
    localStorage.removeItem('kapl_everything_reset_kapl-3-womens');

    const enriched = {
      ...player,
      vaultSavedAt: new Date().toISOString(),
    };

    // 1. Save to persistent vault
    const raw = localStorage.getItem('kapl_player_vault');
    const vault: any[] = raw ? JSON.parse(raw) : [];

    const idx = vault.findIndex(
      (p) =>
        (player.id && p.id === player.id) ||
        (player.email && p.email && p.email.toLowerCase() === player.email.toLowerCase()) ||
        (player.name && p.name && p.name.toLowerCase() === player.name.toLowerCase())
    );

    if (idx >= 0) {
      vault[idx] = { ...vault[idx], ...enriched };
    } else {
      vault.push(enriched);
    }

    localStorage.setItem('kapl_player_vault', JSON.stringify(vault));

    // 2. Also keep kapl_registered_players synced
    const regRaw = localStorage.getItem('kapl_registered_players');
    const regList: any[] = regRaw ? JSON.parse(regRaw) : [];
    const rIdx = regList.findIndex(
      (p) =>
        (player.id && p.id === player.id) ||
        (player.email && p.email && p.email.toLowerCase() === player.email.toLowerCase()) ||
        (player.name && p.name && p.name.toLowerCase() === player.name.toLowerCase())
    );
    if (rIdx >= 0) {
      regList[rIdx] = { ...regList[rIdx], ...enriched };
    } else {
      regList.push(enriched);
    }
    localStorage.setItem('kapl_registered_players', JSON.stringify(regList));
  } catch (e) {
    console.warn('Failed to save player to persistent vault:', e);
  }
}

const PLAYER_PURGE_MIGRATION_KEY = 'kapl_players_purged_v2';

function purgeLegacyLocalPlayersOnce(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(PLAYER_PURGE_MIGRATION_KEY) === 'true') {
      return false;
    }
    const keysToClear = [
      'kapl_player_vault',
      'kapl_registered_players',
      'kapl_auction_players_kapl-3-mens',
      'kapl_auction_players_kapl-3-womens',
      'kapl_auction_active_player_kapl-3-mens',
      'kapl_auction_active_player_kapl-3-womens',
      'kapl_auction_sales_kapl-3-mens',
      'kapl_auction_sales_kapl-3-womens',
      'kapl_auction_teams_kapl-3-mens',
      'kapl_auction_teams_kapl-3-womens',
      'kapl_teams',
      'kapl_auction_manually_reset_kapl-3-mens',
      'kapl_auction_manually_reset_kapl-3-womens',
    ];
    keysToClear.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('kapl_all_players_cleared', 'true');
    localStorage.setItem(PLAYER_PURGE_MIGRATION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export function removePlayerFromLocalStores(playerId: string, tournamentId?: string) {
  if (typeof window === 'undefined' || !playerId) return;
  const baseId = playerId.replace(/_w$/, '');
  const womensId = `${baseId}_w`;
  const matchesTarget = (p: any) => p && (p.id === playerId || p.id === baseId || p.id === womensId);

  try {
    const filterStorageArray = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(key, JSON.stringify(parsed.filter((p: any) => !matchesTarget(p))));
      }
    };

    filterStorageArray('kapl_player_vault');
    filterStorageArray('kapl_registered_players');

    const tournaments = tournamentId ? [tournamentId] : ['kapl-3-mens', 'kapl-3-womens'];
    for (const tid of tournaments) {
      filterStorageArray(`kapl_auction_players_${tid}`);
      const salesRaw = localStorage.getItem(`kapl_auction_sales_${tid}`);
      if (salesRaw) {
        const parsedSales = JSON.parse(salesRaw);
        if (Array.isArray(parsedSales)) {
          localStorage.setItem(
            `kapl_auction_sales_${tid}`,
            JSON.stringify(parsedSales.filter((s: any) => s && s.playerId !== playerId && s.playerId !== baseId && s.playerId !== womensId))
          );
        }
      }
    }
  } catch (e) {
    console.warn('removePlayerFromLocalStores notice:', e);
  }
}

export function clearLocalPlayersForTournament(tournamentId: string) {
  if (typeof window === 'undefined') return;
  try {
    const oppositeTid = tournamentId === 'kapl-3-womens' ? 'kapl-3-mens' : 'kapl-3-womens';
    localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify([]));
    localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
    localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
    localStorage.removeItem(`kapl_auction_teams_${tournamentId}`);
    localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);

    const filterForTournament = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      const remaining = parsed.filter((p: any) => {
        if (!p) return false;
        const pTid = p.tournamentId;
        return pTid && pTid !== 'all' && pTid === oppositeTid;
      });
      localStorage.setItem(key, JSON.stringify(remaining));
      return remaining.length;
    };

    const remainingVault = filterForTournament('kapl_player_vault');
    const remainingReg = filterForTournament('kapl_registered_players');
    if (remainingVault === 0 && remainingReg === 0) {
      localStorage.setItem('kapl_all_players_cleared', 'true');
    }
  } catch (e) {
    console.warn('clearLocalPlayersForTournament notice:', e);
  }
}

/**
 * Automatically repairs and synchronizes local player state across tabs and reloads:
 * 1. Purges zombie clear flags ('kapl_all_players_cleared', etc.) if any vault or registered players exist.
 * 2. Keeps `kapl_player_vault` and `kapl_registered_players` bidirectional in sync.
 * 3. Populates league caches while respecting tournament assignments and preserving auction outcomes.
 */
export function repairAndSyncLocalPlayerState() {
  if (typeof window === 'undefined') return;
  if (purgeLegacyLocalPlayersOnce()) return;
  try {
    const vaultRaw = localStorage.getItem('kapl_player_vault');
    let vaultList: any[] = vaultRaw ? JSON.parse(vaultRaw) : [];
    if (!Array.isArray(vaultList)) vaultList = [];

    const regRaw = localStorage.getItem('kapl_registered_players');
    let regList: any[] = regRaw ? JSON.parse(regRaw) : [];
    if (!Array.isArray(regList)) regList = [];

    // Also check accounts registry if any players registered
    try {
      const accRaw = localStorage.getItem('kapl_registered_accounts');
      if (accRaw) {
        const accounts = JSON.parse(accRaw);
        Object.values(accounts).forEach((acc: any) => {
          if (acc && (acc.role === 'player' || !acc.role) && acc.profile) {
            const p = acc.profile;
            if (p.name && !vaultList.some((v: any) => v.name && v.name.toLowerCase() === p.name.toLowerCase())) {
              vaultList.push({
                id: p.playerId || `p_u_${(acc.id || p.name || 'anon').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
                name: p.name,
                role: p.role || 'all_rounder',
                battingStyle: p.battingStyle || 'Right-hand bat',
                bowlingStyle: p.bowlingStyle || 'Right-arm medium',
                jerseyNumber: p.jerseyNumber ? Number(p.jerseyNumber) : null,
                mobileNumber: p.mobileNumber || null,
                email: acc.email,
                gender: p.gender || 'male',
                tournamentId: 'all',
                basePrice: 100,
                auctionStatus: 'pending',
              });
            }
          }
        });
      }
    } catch {}

    const totalLocalPlayers = Math.max(vaultList.length, regList.length);

    // If any registered players exist, immediately kill any "cleared" or "everything_reset" flags
    if (totalLocalPlayers > 0) {
      localStorage.removeItem('kapl_all_players_cleared');
      localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
      localStorage.removeItem('kapl_everything_reset_kapl-3-womens');
    }

    // Merge vault into registered players if missing
    if (vaultList.length > 0) {
      vaultList.forEach((vp: any) => {
        if (!regList.some((r: any) => r.id === vp.id || (r.name && vp.name && r.name.toLowerCase() === vp.name.toLowerCase()))) {
          regList.push(vp);
        }
      });
      localStorage.setItem('kapl_registered_players', JSON.stringify(regList));
    }

    // Merge registered players into vault if missing
    if (regList.length > 0) {
      regList.forEach((rp: any) => {
        if (!vaultList.some((v: any) => v.id === rp.id || (v.name && rp.name && v.name.toLowerCase() === rp.name.toLowerCase()))) {
          vaultList.push(rp);
        }
      });
      localStorage.setItem('kapl_player_vault', JSON.stringify(vaultList));
    }

    // Populate auction caches for both leagues so switching tabs never flashes 0 players
    const masterList = vaultList.length > 0 ? vaultList : regList;
    if (masterList.length > 0) {
      for (const tid of ['kapl-3-mens', 'kapl-3-womens']) {
        const rawAuc = localStorage.getItem(`kapl_auction_players_${tid}`);
        let aucList = rawAuc ? JSON.parse(rawAuc) : [];
        if (!Array.isArray(aucList)) aucList = [];
        let modified = false;

        masterList.forEach((p: any) => {
          if (!p) return;
          if (p.tournamentId && p.tournamentId !== 'all' && p.tournamentId !== tid) return;
          const expectedId = getTournamentPlayerId(p.id, tid, p.name);
          if (!expectedId) return;
          const existingIdx = aucList.findIndex((a: any) => a.id === expectedId || (a.name && p.name && a.name.toLowerCase() === p.name.toLowerCase()));
          const candidateRecord = {
            ...p,
            id: expectedId,
            tournamentId: tid,
            auctionStatus: p.auctionStatus || 'pending',
            basePrice: Number(p.basePrice || 100),
          };
          if (existingIdx >= 0) {
            aucList[existingIdx] = { ...candidateRecord, ...aucList[existingIdx], id: expectedId, tournamentId: tid };
            modified = true;
          } else {
            aucList.push(candidateRecord);
            modified = true;
          }
        });

        if (modified) {
          localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify(aucList));
        }

        const activeId = localStorage.getItem(`kapl_auction_active_player_${tid}`);
        if (!activeId && aucList.length > 0) {
          localStorage.setItem(`kapl_auction_active_player_${tid}`, aucList[0].id);
        }
      }
    }
  } catch (e) {
    console.warn('repairAndSyncLocalPlayerState notice:', e);
  }
}

/**
 * Gather all registered players across all sources:
 * 1. Persistent Player Vault (`kapl_player_vault`)
 * 2. Master registered list (`kapl_registered_players`)
 * 3. Registered accounts registry (`kapl_registered_accounts`)
 * 4. Live Supabase database players
 */
export async function getAllStoredRegistrations(): Promise<RegistrationExportRow[]> {
  const map = new Map<string, RegistrationExportRow>();

  const roleNameMap: Record<string, string> = {
    all_rounder: 'All-Rounder',
    batter: 'Batter',
    bowler: 'Bowler',
    wicket_keeper: 'Wicket-Keeper',
  };

  const getTournamentLabel = (tId?: string) => {
    if (!tId || tId === 'all') return "Both (Men's & Women's)";
    if (tId === 'kapl-3-womens') return "KAPL Women's Tournament";
    return "KAPL Men's Tournament";
  };

  const addOrUpdate = (record: any, source: string) => {
    if (!record || (!record.name && !record.id)) return;
    const name = (record.name || 'Unknown Player').trim();
    if (!name || /^[ab][1-4]-/.test(record.id || '')) return; // ignore legacy template dummy

    const email = (record.email || record.userEmail || '').trim();
    const phone = (record.mobileNumber || record.mobile_number || record.phone || '').trim();
    const key = email ? email.toLowerCase() : name.toLowerCase();

    const existing = map.get(key);

    const row: RegistrationExportRow = {
      'Player Name': name,
      'Email': email || existing?.['Email'] || 'N/A',
      'Phone Number': phone || existing?.['Phone Number'] || 'N/A',
      'Playing Role': roleNameMap[record.role] || record.role || existing?.['Playing Role'] || 'All-Rounder',
      'Batting Style': record.battingStyle || record.batting_style || existing?.['Batting Style'] || 'Right-hand bat',
      'Bowling Style': record.bowlingStyle || record.bowling_style || existing?.['Bowling Style'] || 'Right-arm medium',
      'Jersey Number': record.jerseyNumber ?? record.jersey_number ?? existing?.['Jersey Number'] ?? 'N/A',
      'Gender': (record.gender || (record.tournamentId === 'kapl-3-womens' ? 'Female' : 'Male')).toUpperCase(),
      'Tournament': getTournamentLabel(record.tournamentId || record.tournament_id),
      'Base Price (₹)': Number(record.basePrice || record.base_price || 100),
      'Auction Status': (record.auctionStatus || record.auction_status || 'pending').toUpperCase(),
      'Sold Price (₹)': record.soldPrice || record.sold_price ? Number(record.soldPrice || record.sold_price) : 'N/A',
      'Allocated Team': record.teamName || record.teamId || record.team_id || existing?.['Allocated Team'] || 'Unassigned',
      'Added Date': record.createdAt || record.created_at || record.registeredAt || existing?.['Added Date'] || new Date().toLocaleDateString('en-IN'),
      'Player ID': record.id || existing?.['Player ID'] || `p_${Date.now()}`,
    };

    map.set(key, row);
  };

  // 1. Vault
  try {
    const rawVault = localStorage.getItem('kapl_player_vault');
    if (rawVault) {
      const vaultList = JSON.parse(rawVault);
      if (Array.isArray(vaultList)) {
        vaultList.forEach((p) => addOrUpdate(p, 'vault'));
      }
    }
  } catch {}

  // 2. Master kapl_registered_players
  try {
    const rawReg = localStorage.getItem('kapl_registered_players');
    if (rawReg) {
      const regList = JSON.parse(rawReg);
      if (Array.isArray(regList)) {
        regList.forEach((p) => addOrUpdate(p, 'registered_players'));
      }
    }
  } catch {}

  // 3. Registered accounts
  try {
    const rawAcc = localStorage.getItem('kapl_registered_accounts');
    if (rawAcc) {
      const accounts = JSON.parse(rawAcc);
      Object.values(accounts).forEach((acc: any) => {
        if (acc && acc.profile) {
          addOrUpdate({ ...acc.profile, email: acc.email, registeredAt: acc.registeredAt }, 'accounts');
        } else if (acc) {
          addOrUpdate(acc, 'accounts');
        }
      });
    }
  } catch {}

  // 4. Remote Supabase DB players
  try {
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('id, name, role, batting_style, bowling_style, jersey_number, tournament_id, team_id, base_price, sold_price, auction_status, created_at');

    if (dbPlayers && Array.isArray(dbPlayers)) {
      dbPlayers.forEach((p) => addOrUpdate(p, 'database'));
    }
  } catch (err) {
    console.warn('Could not read players from database for export:', err);
  }

  return Array.from(map.values()).sort((a, b) =>
    a['Player Name'].localeCompare(b['Player Name'])
  );
}

/**
 * Generate and trigger download of Excel spreadsheet (.xlsx)
 */
export async function exportRegistrationsToExcel(providedRows?: RegistrationExportRow[]): Promise<{ count: number; filename: string }> {
  const rows = providedRows && providedRows.length > 0 ? providedRows : await getAllStoredRegistrations();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `KAPL_3.0_Auction_Players_${timestamp}.xlsx`;

  if (rows.length === 0) {
    const dummyRows = [
      {
        'Player Name': 'No Auction Players Recorded Yet',
        'Email': '-',
        'Phone Number': '-',
        'Playing Role': '-',
        'Batting Style': '-',
        'Bowling Style': '-',
        'Jersey Number': '-',
        'Gender': '-',
        'Tournament': "KAPL 3.0 Men's & Women's",
        'Base Price (₹)': 100,
        'Auction Status': 'PENDING',
        'Sold Price (₹)': '-',
        'Allocated Team': '-',
        'Added Date': new Date().toLocaleDateString('en-IN'),
        'Player ID': '-',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(dummyRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auction Players');
    XLSX.writeFile(wb, filename);
    return { count: 0, filename };
  }

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set friendly column widths
  const colWidths = [
    { wch: 22 }, // Player Name
    { wch: 28 }, // Email
    { wch: 16 }, // Phone Number
    { wch: 16 }, // Playing Role
    { wch: 18 }, // Batting Style
    { wch: 20 }, // Bowling Style
    { wch: 14 }, // Jersey Number
    { wch: 10 }, // Gender
    { wch: 24 }, // Tournament
    { wch: 14 }, // Base Price
    { wch: 15 }, // Auction Status
    { wch: 15 }, // Sold Price
    { wch: 20 }, // Allocated Team
    { wch: 18 }, // Added Date
    { wch: 18 }, // Player ID
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Auction Players');
  XLSX.writeFile(wb, filename);

  return { count: rows.length, filename };
}

/**
 * Generate formatted plain text / CSV for immediate copy-pasting to text editors
 */
export async function exportRegistrationsToText(providedRows?: RegistrationExportRow[]): Promise<string> {
  const rows = providedRows && providedRows.length > 0 ? providedRows : await getAllStoredRegistrations();

  if (rows.length === 0) {
    return `===========================================================\n       KAPL 3.0 AUCTION - PLAYER POOL ARCHIVE             \n===========================================================\nExport Date: ${new Date().toLocaleString('en-IN')}\nTotal Auction Players: 0\n\nNo auction players have been recorded yet.\n`;
  }

  let text = `===========================================================\n`;
  text += `       KAPL 3.0 AUCTION - PLAYER POOL ARCHIVE             \n`;
  text += `===========================================================\n`;
  text += `Export Timestamp : ${new Date().toLocaleString('en-IN')}\n`;
  text += `Total Auction Players: ${rows.length}\n`;
  text += `===========================================================\n\n`;

  // CSV-style header
  text += `Name | Phone | Role | Batting | Bowling | Jersey | Gender | Tournament | Base Price | Status | Team\n`;
  text += `------------------------------------------------------------------------------------------------------------------------\n`;

  rows.forEach((r, idx) => {
    text += `${idx + 1}. ${r['Player Name']}\n`;
    text += `   - Phone: ${r['Phone Number']} | Email: ${r['Email']}\n`;
    text += `   - Role: ${r['Playing Role']} | Batting: ${r['Batting Style']} | Bowling: ${r['Bowling Style']}\n`;
    text += `   - Jersey: #${r['Jersey Number']} | Gender: ${r['Gender']} | Tournament: ${r['Tournament']}\n`;
    text += `   - Status: ${r['Auction Status']} | Base: ₹${r['Base Price (₹)']} | Sold: ₹${r['Sold Price (₹)']} | Team: ${r['Allocated Team']}\n`;
    text += `   - ID: ${r['Player ID']} | Added: ${r['Added Date']}\n\n`;
  });

  text += `===========================================================\n`;
  text += `END OF AUCTION PLAYER RECORDS (${rows.length} PLAYERS)\n`;
  text += `===========================================================\n`;

  return text;
}

