import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://uysqotehveihvjqxobdk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_pi1de3xXvoFnSB7BrffqdQ_Vnbdfa_S';

interface PlayerRow {
  'Player ID': string;
  'Name': string;
  'Phone': string;
  'Gender': string;
  'Role': string;
  'Batting': string;
  'Bowling': string;
  'Email': string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function bulkImportPlayers(csvFilePath: string, tournamentId: string = 'kapl-3-womens') {
  try {
    // Read CSV file
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    }) as PlayerRow[];

    console.log(`📋 Found ${records.length} players to import...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const playerName = record.Name?.trim();

      if (!playerName) {
        console.warn(`⚠️ Row ${i + 1}: Missing player name, skipping...`);
        errorCount++;
        continue;
      }

      try {
        const playerId = `p_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`;
        const tournamentPlayerId = tournamentId === 'kapl-3-womens' ? `${playerId}_w` : playerId;

        // Map role - handle different role formats
        let role = record.Role?.toLowerCase() || 'all_rounder';
        if (role === 'bat' || role === 'batter') role = 'batter';
        if (role === 'bowl' || role === 'bowler') role = 'bowler';
        if (role === 'keeper' || role === 'wicket keeper' || role === 'wicket_keeper') role = 'wicket_keeper';
        if (!['all_rounder', 'batter', 'bowler', 'wicket_keeper'].includes(role)) {
          role = 'all_rounder';
        }

        // Map batting style
        let battingStyle = record.Batting?.trim() || 'Right-hand bat';
        if (battingStyle.toLowerCase().includes('left')) battingStyle = 'Left-hand bat';
        else battingStyle = 'Right-hand bat';

        // Map bowling style
        let bowlingStyle = record.Bowling?.trim() || 'Right-arm medium';
        if (bowlingStyle.toLowerCase().includes('none') || bowlingStyle.toLowerCase().includes('occasional')) {
          bowlingStyle = 'None';
        }

        // Clean phone number
        let mobileNumber = record.Phone?.replace(/[\s\-()]/g, '').trim() || null;
        if (mobileNumber) {
          // Convert 11 digits (starting with 0) to 10 digits
          if (mobileNumber.startsWith('0') && mobileNumber.length === 11) {
            mobileNumber = mobileNumber.slice(1);
          }
          // Remove +91 prefix and keep 10 digits
          if (mobileNumber.startsWith('+91') && mobileNumber.length === 13) {
            mobileNumber = mobileNumber.slice(3);
          }
          // Validate it's 10 digits
          if (!/^\d{10}$/.test(mobileNumber)) {
            mobileNumber = null;
          }
        }

        // Insert player
        const { error } = await supabase.from('players').insert({
          id: tournamentPlayerId,
          name: playerName,
          role: role,
          batting_style: battingStyle,
          bowling_style: bowlingStyle,
          base_price: 100,
          auction_status: 'pending',
          tournament_id: tournamentId,
          mobile_number: mobileNumber,
          photo_url: null,
          jersey_number: null,
        });

        if (error) {
          console.error(`❌ Player ${playerName}: ${error.message}`);
          errorCount++;
        } else {
          successCount++;
          console.log(`✅ ${successCount}. ${playerName} (${role}) - ${mobileNumber || 'No phone'}`);
        }
      } catch (err: any) {
        console.error(`❌ Error processing ${record.Name}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n✨ Import Complete!`);
    console.log(`✅ Success: ${successCount}/${records.length}`);
    console.log(`❌ Failed: ${errorCount}/${records.length}`);
    console.log(`📍 Tournament: ${tournamentId}`);

  } catch (err: any) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

// Get command line arguments
const csvPath = process.argv[2];
const tournament = process.argv[3] || 'kapl-3-womens';

if (!csvPath) {
  console.error('Usage: npx ts-node scripts/bulk-import-players.ts <csv-file> [tournament-id]');
  console.error('Example: npx ts-node scripts/bulk-import-players.ts Registered_Players_2026-11-12.csv kapl-3-womens');
  process.exit(1);
}

bulkImportPlayers(csvPath, tournament);
