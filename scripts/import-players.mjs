import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uysqotehveihvjqxobdk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pi1de3xXvoFnSB7BrffqdQ_Vnbdfa_S';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service role key if available, otherwise use anon key
const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const isServiceRole = !!SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, key, {
  auth: { persistSession: false },
});

// Player data from CSV
const playersData = [
  { name: 'Rishaan Panke', phone: '8379096455', role: 'batter', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Rashi Bhave', phone: '7558468500', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'None' },
  { name: 'Rihan Anandsagar Shiralkar', phone: '8888766006', role: 'all_rounder', batting: 'Left-hand bat', bowling: 'Left-arm medium' },
  { name: 'Anandsagar Mohan Shiralkar', phone: '8888766006', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Renuka Bhave', phone: '9881044456', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'None' },
  { name: 'Dr Madhavi Bankar', phone: '9822555383', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Tushar Bankar', phone: '9881138320', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Siddhu Bharamgonde', phone: '9850382575', role: 'bowler', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Monica Limaye', phone: '7720031570', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Sanjay Angal', phone: '8983074341', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Soham Bharamgonde', phone: '7066792575', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Yogesh Bhagwat', phone: '9833737568', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Left-arm medium' },
  { name: 'Shivaansh Chitnis', phone: '88668842520', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Aayush Daflapurkar', phone: '9175923432', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Rohan Chitnis', phone: '9769586086', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Hrishikesh Ranade', phone: '9860097217', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Mithil Bagal', phone: '9822278501', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Aaradhya Pande', phone: '9823310361', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Smita Daflapurkar', phone: '9764935234', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Tejas Sohani', phone: '9423012075', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm leg spin' },
  { name: 'Sandeep Nirmal', phone: '8975753119', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Left-arm orthodox' },
  { name: 'Sagar Patankar', phone: '9975498219', role: 'bowler', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
  { name: 'Amol Pande', phone: '9823310361', role: 'all_rounder', batting: 'Right-hand bat', bowling: 'Right-arm off spin' },
  { name: 'Swapnil Shah', phone: '09011037290', role: 'batter', batting: 'Right-hand bat', bowling: 'Right-arm medium' },
];

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, '').trim();

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    cleaned = cleaned.slice(3);
  }
  if (!/^\d{10}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function normalizeBowlingStyle(bowling) {
  if (!bowling) return 'Right-arm medium';
  const lower = bowling.toLowerCase();
  if (lower.includes('none') || lower.includes('occasional')) return 'None';
  return bowling;
}

async function importPlayers(tournamentId = 'kapl-3-womens') {
  console.log(`\n🏏 KAPL Auction - Bulk Player Import`);
  console.log(`📋 Importing ${playersData.length} players to ${tournamentId}...\n`);
  if (isServiceRole) {
    console.log(`🔑 Using SERVICE ROLE authentication\n`);
  } else {
    console.log(`⚠️  Using ANON key - some inserts may fail due to RLS. Consider using SUPABASE_SERVICE_ROLE_KEY\n`);
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < playersData.length; i++) {
    const player = playersData[i];
    const playerId = `p_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`;
    const tournamentPlayerId = tournamentId === 'kapl-3-womens' ? `${playerId}_w` : playerId;

    try {
      const mobileNumber = cleanPhoneNumber(player.phone);
      const bowlingStyle = normalizeBowlingStyle(player.bowling);

      // Try RPC first if available
      let error = null;
      if (isServiceRole) {
        // With service role, try direct insert
        const result = await supabase.from('players').insert({
          id: tournamentPlayerId,
          name: player.name,
          role: player.role,
          batting_style: player.batting,
          bowling_style: bowlingStyle,
          base_price: 100,
          auction_status: 'pending',
          tournament_id: tournamentId,
          mobile_number: mobileNumber,
          photo_url: null,
          jersey_number: null,
        });
        error = result.error;
      } else {
        // With anon key, try RPC
        const result = await supabase.rpc('register_new_player', {
          p_id: tournamentPlayerId,
          p_name: player.name,
          p_role: player.role,
          p_batting_style: player.batting,
          p_bowling_style: bowlingStyle,
          p_tournament_id: tournamentId,
          p_jersey_number: null,
          p_mobile_number: mobileNumber,
          p_photo_url: null,
          p_base_price: 100,
        });
        error = result.error;
      }

      if (error) {
        errorCount++;
        errors.push(`${player.name}: ${error.message}`);
        console.log(`❌ ${player.name} - ${error.message}`);
      } else {
        successCount++;
        console.log(`✅ ${successCount}. ${player.name} (${player.role})`);
      }
    } catch (err) {
      errorCount++;
      errors.push(`${player.name}: ${err.message}`);
      console.log(`❌ ${player.name} - ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✨ IMPORT COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successful: ${successCount}/${playersData.length}`);
  console.log(`❌ Failed: ${errorCount}/${playersData.length}`);
  console.log(`📍 Tournament: ${tournamentId}`);

  if (errors.length > 0 && errors.length <= 5) {
    console.log(`\n⚠️  First few errors:`);
    errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
  }

  console.log(`${'='.repeat(60)}\n`);
}

const tournament = process.argv[2] || 'kapl-3-womens';
importPlayers(tournament).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
