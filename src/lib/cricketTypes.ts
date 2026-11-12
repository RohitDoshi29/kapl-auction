export interface PlayerStats {
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: string;
  dismissalDescription?: string;
  dismissalFielderId?: string;
  dismissalBowlerId?: string;
}

export interface BowlerStats {
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  maidens?: number;
}

export type TournamentCategory = 'mens' | 'womens';
export type TournamentStatus = 'upcoming' | 'auction' | 'live' | 'completed';

export interface TournamentRules {
  max_overs: number;
  max_overs_per_bowler: number;
  max_wickets: number;
  negative_runs_enabled: boolean;
  fixtures?: MatchFixture[];
}

export interface Tournament {
  id: string;
  name: string;
  edition: string;
  category: TournamentCategory;
  status: TournamentStatus;
  rules: TournamentRules;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_TOURNAMENTS: Tournament[] = [
  {
    id: 'kapl-3-mens',
    name: "KAPL 3.0 Men's Tournament",
    edition: '3.0',
    category: 'mens',
    status: 'upcoming',
    rules: {
      max_overs: 7,
      max_overs_per_bowler: 2,
      max_wickets: 10,
      negative_runs_enabled: true,
    },
  },
  {
    id: 'kapl-3-womens',
    name: "KAPL 3.0 Women's Tournament",
    edition: '3.0',
    category: 'womens',
    status: 'upcoming',
    rules: {
      max_overs: 7,
      max_overs_per_bowler: 2,
      max_wickets: 10,
      negative_runs_enabled: true,
    },
  },
];

export type PlayerRole = 'batter' | 'bowler' | 'all_rounder' | 'wicket_keeper';
export type AuctionStatus = 'pending' | 'bidding' | 'sold' | 'unsold';

export interface PlayerRecord {
  id: string;
  tournamentId: string;
  teamId?: string | null;
  userId?: string | null;
  name: string;
  role: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  photoUrl?: string | null;
  basePrice: number;
  soldPrice?: number | null;
  auctionStatus: AuctionStatus;
  jerseyNumber?: number | null;
  mobileNumber?: string | null;
  gender?: 'male' | 'female' | string;
  experience?: 'new' | 'season_2' | 'season_1' | 'veteran';
  previousTeam?: string;
  pastAchievements?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BidHistoryEntry {
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: string;
}

export interface AuctionState {
  id: string;
  tournamentId: string;
  currentPlayerId?: string | null;
  currentBid: number;
  highestBidderTeamId?: string | null;
  bidHistory: BidHistoryEntry[];
  status: 'idle' | 'bidding' | 'fair_warning' | 'sold' | 'unsold' | 'completed' | 'paused';
  timerEndsAt?: string | null;
  updatedAt?: string;
}

export interface Player {
  id: string;
  name: string;
  photo: string | null; // base64 string
  role?: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice?: number;
  soldPrice?: number | null;
  auctionStatus?: AuctionStatus;
}

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  group: 'A' | 'B';
  logo: string | null; // base64 string
  primaryColor: string; // HSL color
  players: Player[];
  playerCount: number; // 7-11 players
  tournamentId?: string;
  initialPurse?: number;
  remainingPurse?: number;
  maxSquadSize?: number;
  captainUserId?: string | null;
  // Distinct Owner & Captain designations
  ownerName?: string;
  ownerEmail?: string | null;
  ownerUserId?: string | null;
  captainName?: string;
  captainPlayerId?: string | null;
}

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'stumped'
  | 'run_out'
  | 'hit_wicket'
  | 'retired';

export interface WicketDetails {
  type: DismissalType;
  dismissedPlayerId: string;
  fielderId?: string;
  fielderName?: string;
  runsCompleted?: number;
  description?: string;
}

export interface Ball {
  id: string;
  runs: number;
  isWicket: boolean;
  isWide: boolean;
  isNoBall: boolean;
  isExtra: boolean;
  extraType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye' | null;
  runsOffBat?: number;
  extraRuns?: number;
  isFreeHit?: boolean;
  wicketDetails?: WicketDetails;
  batsmanId?: string;
  bowlerId?: string;
}

export interface Over {
  number: number;
  balls: Ball[];
  bowlerId?: string;
}

export interface Innings {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: Over[];
  currentOver: number;
  currentBall: number;
  currentBatsmanId?: string;
  currentBowlerId?: string;
  nonStrikerBatsmanId?: string;
  batterStats: Record<string, PlayerStats>;
  bowlerStats: Record<string, BowlerStats>;
  battingOrder: string[]; // Player IDs in batting order
  isFreeHit?: boolean;
}

export type MatchType = 'group' | 'semi_final_1' | 'semi_final_2' | 'final';

export interface MatchFixture {
  id: string;
  tournamentId?: string;
  matchNumber?: number;
  team1Id: string;
  team2Id: string;
  group?: 'A' | 'B';
  matchType: MatchType;
  scheduledTime?: string; // e.g. "09:30 AM"
  scheduledDate?: string; // e.g. "Day 1 - Morning" or "Today"
  venue?: string; // e.g. "Ground 1 (Pavilion End)"
  status: 'scheduled' | 'live' | 'completed';
  winnerTeamId?: string | null;
  winner?: string | null;
  team1Score?: string;
  team2Score?: string;
  knockoutType?: 'semi_final_1' | 'semi_final_2' | 'final';
  matchId?: string;
  summary?: string;
  notes?: string;
}

export interface SuperOver {
  innings1: Innings | null;  // Team 1 batting
  innings2: Innings | null;  // Team 2 batting
  currentInnings: 1 | 2;
  completed: boolean;
}

export interface MatchAward {
  id: string;
  title: string;
  playerId: string;
  playerName: string;
  playerTeamId?: string;
  detail?: string;
}

export interface PlayerOfTheMatchData {
  playerId: string;
  playerName: string;
  playerTeamId: string;
  reason?: string;
  awards?: MatchAward[];
}

export interface Match {
  id: string;
  tournamentId?: string;
  fixtureId?: string;
  group: 'A' | 'B';
  team1Id: string;
  team2Id: string;
  innings1: Innings | null;
  innings2: Innings | null;
  currentInnings: 1 | 2;
  status: 'setup' | 'live' | 'completed' | 'super_over';
  winner: string | null;
  matchType: MatchType;
  superOver?: SuperOver;
  isTied?: boolean;
  playerOfTheMatchId?: string;
  playerOfTheMatchName?: string;
  playerOfTheMatchTeamId?: string;
  playerOfTheMatchReason?: string;
  awards?: MatchAward[];
}

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  group: 'Group Stage',
  semi_final_1: 'Semi Final 1',
  semi_final_2: 'Semi Final 2',
  final: 'Final',
};

export interface MatchState {
  currentMatch: Match | null;
  lastAction: {
    type: string;
    previousState: Match | null;
  } | null;
}

export interface TeamStats {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  totalRuns: number;
  totalFours: number;
  totalSixes: number;
  totalWickets: number;
  // NRR calculation fields
  runsScored: number;
  oversPlayed: number; // in decimal format (e.g., 10.3 overs)
  runsConceded: number;
  oversBowled: number; // in decimal format
  nrr: number; // Net Run Rate
}

const createDefaultPlayers = (teamId: string, count: number = 10): Player[] => 
  Array.from({ length: count }, (_, i) => ({
    id: `${teamId}-p${i + 1}`,
    name: `Player ${i + 1}`,
    photo: null,
  }));

export const DEFAULT_TEAMS: Team[] = [
  { id: 'a1', tournamentId: 'kapl-3-mens', name: 'Kapil\'s Warriors', group: 'A', logo: null, primaryColor: '0 84% 60%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'a2', tournamentId: 'kapl-3-mens', name: 'Kapil Falcons', group: 'A', logo: null, primaryColor: '174 72% 40%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'a3', tournamentId: 'kapl-3-mens', name: 'Insta Paltans', group: 'A', logo: null, primaryColor: '267 84% 51%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'a4', tournamentId: 'kapl-3-mens', name: 'Kapil\'s Devils', group: 'A', logo: null, primaryColor: '222 47% 31%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  // Group B
  { id: 'b1', tournamentId: 'kapl-3-mens', name: 'Goodness Royals', group: 'B', logo: null, primaryColor: '43 96% 56%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'b2', tournamentId: 'kapl-3-mens', name: 'Kapil Ke Singham', group: 'B', logo: null, primaryColor: '199 89% 48%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'b3', tournamentId: 'kapl-3-mens', name: 'Super Strikers', group: 'B', logo: null, primaryColor: '280 68% 51%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'b4', tournamentId: 'kapl-3-mens', name: 'Kapil Avengers', group: 'B', logo: null, primaryColor: '25 95% 53%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
];

export const DEFAULT_WOMENS_TEAMS: Team[] = [
  // Group A
  { id: 'w_a1', tournamentId: 'kapl-3-womens', name: 'Kapil Queens', group: 'A', logo: null, primaryColor: '326 78% 60%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'w_a2', tournamentId: 'kapl-3-womens', name: 'Falconettes', group: 'A', logo: null, primaryColor: '174 72% 40%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  // Group B
  { id: 'w_b1', tournamentId: 'kapl-3-womens', name: 'Royal Challengers Women', group: 'B', logo: null, primaryColor: '0 84% 60%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
  { id: 'w_b2', tournamentId: 'kapl-3-womens', name: 'Super Strikers Women', group: 'B', logo: null, primaryColor: '280 68% 51%', players: [], playerCount: 0, remainingPurse: 10000, initialPurse: 10000, maxSquadSize: 10 },
];

export const PRESET_COLORS = [
  { name: 'Royal Blue', value: '267 84% 51%' },
  { name: 'Golden Yellow', value: '43 96% 56%' },
  { name: 'Cricket Green', value: '142 71% 45%' },
  { name: 'Fire Red', value: '0 84% 60%' },
  { name: 'Purple Pride', value: '280 68% 51%' },
  { name: 'Sky Blue', value: '199 89% 48%' },
  { name: 'Orange Blast', value: '25 95% 53%' },
  { name: 'Pink Power', value: '326 78% 60%' },
  { name: 'Teal Thunder', value: '174 72% 40%' },
  { name: 'Midnight Navy', value: '222 47% 31%' },
];

export const PLAYER_COUNT_OPTIONS = [7, 8, 9, 10, 11];
