-- Migration: Complete Reset for New Tournament
-- Date: 2026-11-10
-- Purpose: Clear all tournament data, registrations, and roles for fresh start

-- 1. Clear all tournament data
DELETE FROM public.auction_bids;
DELETE FROM public.auction_state;
DELETE FROM public.match_history;
DELETE FROM public.match_state;
DELETE FROM public.secondary_match_state;
DELETE FROM public.tournament_state;

-- 2. Reset all teams to clean state
UPDATE public.teams SET
  players = '[]'::jsonb,
  player_count = 0,
  remaining_purse = 10000,
  updated_at = now();

-- 3. Delete all players
DELETE FROM public.players;

-- 4. Clear all user roles (auth.user_roles table)
DELETE FROM public.user_roles;

-- 5. Reset tournament_state
INSERT INTO public.tournament_state (id, qualified_a1, qualified_a2, qualified_b1, qualified_b2, sf1_winner, sf2_winner, final_winner, updated_at)
VALUES ('current', NULL, NULL, NULL, NULL, NULL, NULL, NULL, now())
ON CONFLICT (id) DO UPDATE SET
  qualified_a1 = NULL,
  qualified_a2 = NULL,
  qualified_b1 = NULL,
  qualified_b2 = NULL,
  sf1_winner = NULL,
  sf2_winner = NULL,
  final_winner = NULL,
  updated_at = now();

-- 6. Re-initialize match_state records for scoring system
DELETE FROM public.match_state WHERE tournament_id IN ('kapl-3-mens', 'kapl-3-womens');
INSERT INTO public.match_state (id, tournament_id, current_match, last_action)
VALUES
  ('current', 'kapl-3-mens', NULL, NULL),
  ('womens', 'kapl-3-womens', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  current_match = NULL,
  last_action = NULL,
  updated_at = now();

-- 7. Re-initialize secondary_match_state for secondary scorers
DELETE FROM public.secondary_match_state WHERE tournament_id IN ('kapl-3-mens', 'kapl-3-womens');
INSERT INTO public.secondary_match_state (id, tournament_id, current_match, last_action)
VALUES
  ('current', 'kapl-3-mens', NULL, NULL),
  ('womens', 'kapl-3-womens', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  current_match = NULL,
  last_action = NULL,
  updated_at = now();

-- 8. Re-initialize auction_state for both tournaments
DELETE FROM public.auction_state;
INSERT INTO public.auction_state (id, tournament_id, status)
VALUES
  ('kapl-3-mens', 'kapl-3-mens', 'idle'),
  ('kapl-3-womens', 'kapl-3-womens', 'idle')
ON CONFLICT (id) DO UPDATE SET
  status = 'idle',
  current_player_id = NULL,
  current_bid = 0,
  highest_bidder_team_id = NULL,
  timer_ends_at = NULL,
  updated_at = now();

-- 9. Verify constraints are in place
ALTER TABLE public.auction_state ADD CONSTRAINT auction_state_status_check
  CHECK (status IN ('idle', 'bidding', 'fair_warning', 'sold', 'unsold', 'completed', 'paused'))
  ON CONFLICT DO NOTHING;

COMMIT;
