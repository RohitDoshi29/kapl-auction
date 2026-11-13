import { PlayerRecord, PlayerRole } from './cricketTypes';

export const REGISTERED_TOURNAMENT_PLAYERS: Array<{
  name: string;
  role: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number;
  mobile?: string;
}> = [
  { name: 'Rishaan Panke', role: 'batter', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '8379096455' },
  { name: 'Rashi Bhave', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'None', basePrice: 100, mobile: '7558468500' },
  { name: 'Rihan Anandsagar Shiralkar', role: 'all_rounder', battingStyle: 'Left-hand bat', bowlingStyle: 'Left-arm medium', basePrice: 100, mobile: '8888766006' },
  { name: 'Anandsagar Mohan Shiralkar', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '8888766006' },
  { name: 'Renuka Bhave', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'None', basePrice: 100, mobile: '9881044456' },
  { name: 'Dr Madhavi Bankar', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9822555383' },
  { name: 'Tushar Bankar', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9881138320' },
  { name: 'Siddhu Bharamgonde', role: 'bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9850382575' },
  { name: 'Monica Limaye', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '7720031570' },
  { name: 'Sanjay Angal', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '8983074341' },
  { name: 'Soham Bharamgonde', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '7066792575' },
  { name: 'Yogesh Bhagwat', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Left-arm medium', basePrice: 100, mobile: '9833737568' },
  { name: 'Shivaansh Chitnis', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '8866884252' },
  { name: 'Aayush Daflapurkar', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9175923432' },
  { name: 'Rohan Chitnis', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '9769586086' },
  { name: 'Hrishikesh Ranade', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9860097217' },
  { name: 'Mithil Bagal', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '9822278501' },
  { name: 'Aaradhya Pande', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9823310361' },
  { name: 'Smita Daflapurkar', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9764935234' },
  { name: 'Tejas Sohani', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm leg spin', basePrice: 100, mobile: '9423012075' },
  { name: 'Sandeep Nirmal', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Left-arm orthodox', basePrice: 100, mobile: '8975753119' },
  { name: 'Sagar Patankar', role: 'bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9975498219' },
  { name: 'Amol Pande', role: 'all_rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm off spin', basePrice: 100, mobile: '9823310361' },
  { name: 'Swapnil Shah', role: 'batter', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 100, mobile: '9011037290' },
];

/**
 * Returns baseline tournament players for a given tournament ID,
 * ensuring unique stable IDs so they match INSERT_ALL_PLAYERS.sql.
 */
export function getBaselineTournamentPlayers(tournamentId: string): PlayerRecord[] {
  const isWomens = tournamentId === 'kapl-3-womens';
  const prefix = isWomens ? 'p_c_w_' : 'p_c_';

  return REGISTERED_TOURNAMENT_PLAYERS.map((p, idx) => {
    const id = isWomens ? `p_c_${idx + 1}_w` : `p_c_${idx + 1}`;
    return {
      id,
      tournamentId,
      name: p.name,
      role: p.role,
      battingStyle: p.battingStyle,
      bowlingStyle: p.bowlingStyle,
      basePrice: p.basePrice,
      auctionStatus: 'pending',
      teamId: null,
      soldPrice: null,
      mobileNumber: p.mobile,
    };
  });
}
