import { z } from 'zod';
import { PlayerRole } from '@/lib/cricketTypes';

export const PlayerInputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  role: z.enum(['all_rounder', 'batter', 'bowler', 'wicket_keeper'] as const),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  basePrice: z.number().int().min(100, 'Base price minimum ₹100').max(10000, 'Base price maximum ₹10,000'),
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
  mobileNumber: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return null;
      const cleaned = String(val).replace(/[\s\-()]/g, '');
      if (!cleaned) return '';
      if (cleaned.startsWith('+91') && cleaned.length === 13) return cleaned.slice(3);
      if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.slice(1);
      return cleaned;
    },
    z.string().regex(/^\d{10}$/, 'Invalid mobile number (enter 10 digits)').nullable().optional().or(z.literal(''))
  ),
  photoUrl: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().url('Invalid photo URL').nullable().optional().or(z.literal(''))
  ),
  gender: z.enum(['male', 'female']),
  tournamentId: z.string().min(1, 'Tournament is required'),
});

export const TeamInputSchema = z.object({
  name: z.string().trim().min(2).max(50),
  acronym: z.string().trim().min(2).max(5).toUpperCase(),
  teamPurse: z.number().positive('Purse must be positive'),
  soldAmount: z.number().nonnegative().optional(),
  playersCount: z.number().int().nonnegative().optional(),
});

export const BidInputSchema = z.object({
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  bidAmount: z.number().int().positive('Bid must be positive'),
  tournamentId: z.string().min(1),
});

export const AuctionSettingsSchema = z.object({
  incrementAmount: z.number().int().positive().optional(),
  baseIncrement: z.number().int().positive().optional(),
  timerSeconds: z.number().int().positive().optional(),
  maxPlayers: z.number().int().positive().optional(),
});

export type PlayerInput = z.infer<typeof PlayerInputSchema>;
export type TeamInput = z.infer<typeof TeamInputSchema>;
export type BidInput = z.infer<typeof BidInputSchema>;
export type AuctionSettings = z.infer<typeof AuctionSettingsSchema>;

export const validatePlayerInput = (data: unknown) => {
  try {
    return { success: true, data: PlayerInputSchema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid player data' };
    }
    return { success: false, error: 'Validation failed' };
  }
};

export const validateTeamInput = (data: unknown) => {
  try {
    return { success: true, data: TeamInputSchema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid team data' };
    }
    return { success: false, error: 'Validation failed' };
  }
};

export const validateBidInput = (data: unknown) => {
  try {
    return { success: true, data: BidInputSchema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid bid data' };
    }
    return { success: false, error: 'Validation failed' };
  }
};
