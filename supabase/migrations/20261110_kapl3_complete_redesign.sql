-- ============================================================================
-- KAPL SEASON 3 - COMPLETE REDESIGN: Clean Architecture
-- Date: 2026-11-10
-- Purpose: Rebuild entire system with clean separation of concerns
-- ============================================================================

-- 1. DROP OLD TABLES (Start fresh)
DROP TABLE IF EXISTS public.auction_bids CASCADE;
DROP TABLE IF EXISTS public.auction_state CASCADE;
DROP TABLE IF EXISTS public.match_scores CASCADE;
DROP TABLE IF EXISTS public.match_history CASCADE;
DROP TABLE IF EXISTS public.match_state CASCADE;
DROP TABLE IF EXISTS public.secondary_match_state CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.tournament_state CASCADE;

-- 2. CREATE CLEAN SCHEMA
-- ============================================================================

-- 2.1 ROLE DEFINITIONS
CREATE TYPE public.user_role AS ENUM ('admin', 'co_admin', 'team_owner', 'player');
CREATE TYPE public.tournament_status AS ENUM ('setup', 'bidding', 'live', 'completed');
CREATE TYPE public.player_role AS ENUM ('batter', 'bowler', 'all_rounder', 'wicket_keeper');
CREATE TYPE public.bidding_status AS ENUM ('scheduled', 'live', 'paused', 'completed');
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'completed');
CREATE TYPE public.match_type AS ENUM ('group', 'semi_final_1', 'semi_final_2', 'final');
CREATE TYPE public.allocation_status AS ENUM ('allocated', 'finalized');

-- 2.2 TOURNAMENTS TABLE
CREATE TABLE public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '3.0',
  category TEXT NOT NULL CHECK (category IN ('mens', 'womens')),
  status tournament_status NOT NULL DEFAULT 'setup',
  max_overs INTEGER NOT NULL DEFAULT 7,
  max_overs_per_bowler INTEGER NOT NULL DEFAULT 2,
  initial_purse NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.tournaments (id, name, edition, category, status)
VALUES
  ('kapl-3-mens', 'KAPL 3.0 Men''s Tournament', '3.0', 'mens', 'setup'),
  ('kapl-3-womens', 'KAPL 3.0 Women''s Tournament', '3.0', 'womens', 'setup')
ON CONFLICT (id) DO NOTHING;

-- 2.3 TEAMS TABLE
CREATE TABLE public.teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  logo TEXT,
  primary_color TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  initial_purse NUMERIC NOT NULL DEFAULT 10000,
  remaining_purse NUMERIC NOT NULL DEFAULT 10000,
  max_squad_size INTEGER NOT NULL DEFAULT 10,
  player_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_teams_owner ON public.teams(owner_user_id);

-- Seed default teams
INSERT INTO public.teams (id, tournament_id, name, "group", primary_color)
VALUES
  -- Men's Teams
  ('a1', 'kapl-3-mens', 'Kapil''s Warriors', 'A', '0 84% 60%'),
  ('a2', 'kapl-3-mens', 'Kapil Falcons', 'A', '174 72% 40%'),
  ('a3', 'kapl-3-mens', 'Insta Paltans', 'A', '267 84% 51%'),
  ('a4', 'kapl-3-mens', 'Kapil''s Devils', 'A', '222 47% 31%'),
  ('b1', 'kapl-3-mens', 'Goodness Royals', 'B', '43 96% 56%'),
  ('b2', 'kapl-3-mens', 'Kapil Ke Singham', 'B', '199 89% 48%'),
  ('b3', 'kapl-3-mens', 'Super Strikers', 'B', '280 68% 51%'),
  ('b4', 'kapl-3-mens', 'Kapil Avengers', 'B', '25 95% 53%'),
  -- Women's Teams
  ('w_a1', 'kapl-3-womens', 'Kapil Queens', 'A', '326 78% 60%'),
  ('w_a2', 'kapl-3-womens', 'Falconettes', 'A', '174 72% 40%'),
  ('w_b1', 'kapl-3-womens', 'Royal Challengers Women', 'B', '0 84% 60%'),
  ('w_b2', 'kapl-3-womens', 'Super Strikers Women', 'B', '280 68% 51%')
ON CONFLICT (id) DO NOTHING;

-- 2.4 PLAYERS TABLE
CREATE TABLE public.players (
  id TEXT PRIMARY KEY DEFAULT ('p_' || gen_random_uuid()::text),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role player_role NOT NULL DEFAULT 'all_rounder',
  batting_style TEXT DEFAULT 'Right-hand bat',
  bowling_style TEXT DEFAULT 'Right-arm medium',
  photo_url TEXT,
  base_price NUMERIC NOT NULL DEFAULT 100,
  allocated_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'allocated', 'sold')),
  jersey_number INTEGER,
  mobile_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_tournament ON public.players(tournament_id);
CREATE INDEX idx_players_team ON public.players(team_id);
CREATE INDEX idx_players_status ON public.players(status);

-- 2.5 USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_team ON public.user_roles(team_id);

-- 2.6 BIDDING EVENTS TABLE
CREATE TABLE public.bidding_events (
  id TEXT PRIMARY KEY DEFAULT ('be_' || gen_random_uuid()::text),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  status bidding_status NOT NULL DEFAULT 'scheduled',
  current_player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  round INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bidding_events_tournament ON public.bidding_events(tournament_id);
CREATE INDEX idx_bidding_events_status ON public.bidding_events(status);

-- 2.7 BIDS TABLE
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidding_event_id TEXT NOT NULL REFERENCES public.bidding_events(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bid_amount NUMERIC NOT NULL,
  bidder_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_bidding_event ON public.bids(bidding_event_id);
CREATE INDEX idx_bids_player ON public.bids(player_id);
CREATE INDEX idx_bids_team ON public.bids(team_id);
CREATE INDEX idx_bids_bidder ON public.bids(bidder_user_id);

-- 2.8 PLAYER ALLOCATIONS TABLE (Admin/CoAdmin allocate players)
CREATE TABLE public.player_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidding_event_id TEXT NOT NULL REFERENCES public.bidding_events(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  allocated_price NUMERIC NOT NULL,
  allocated_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status allocation_status NOT NULL DEFAULT 'allocated',
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_allocations_bidding_event ON public.player_allocations(bidding_event_id);
CREATE INDEX idx_allocations_player ON public.player_allocations(player_id);
CREATE INDEX idx_allocations_team ON public.player_allocations(team_id);

-- 2.9 MATCHES TABLE
CREATE TABLE public.matches (
  id TEXT PRIMARY KEY DEFAULT ('m_' || gen_random_uuid()::text),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team1_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team2_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  match_type match_type NOT NULL DEFAULT 'group',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status match_status NOT NULL DEFAULT 'scheduled',
  winner_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON public.matches(tournament_id);
CREATE INDEX idx_matches_status ON public.matches(status);

-- 2.10 MATCH SCORES TABLE (Per team, per match)
CREATE TABLE public.match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  runs_scored INTEGER NOT NULL DEFAULT 0,
  wickets_lost INTEGER NOT NULL DEFAULT 0,
  overs_played NUMERIC NOT NULL DEFAULT 0,
  recorded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'verified')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_scores_match ON public.match_scores(match_id);
CREATE INDEX idx_match_scores_team ON public.match_scores(team_id);
CREATE INDEX idx_match_scores_status ON public.match_scores(status);

-- 2.11 PLAYER STATS TABLE (Pre-calculated for analytics)
CREATE TABLE public.player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  runs_scored INTEGER NOT NULL DEFAULT 0,
  wickets_taken INTEGER NOT NULL DEFAULT 0,
  batting_avg NUMERIC DEFAULT 0,
  bowling_avg NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_stats_tournament ON public.player_stats(tournament_id);
CREATE INDEX idx_player_stats_player ON public.player_stats(player_id);
CREATE INDEX idx_player_stats_team ON public.player_stats(team_id);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 3.1 TOURNAMENTS - Public read, Admin modify
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_public_read" ON public.tournaments;
CREATE POLICY "tournaments_public_read" ON public.tournaments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournaments_admin_write" ON public.tournaments;
CREATE POLICY "tournaments_admin_write" ON public.tournaments
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.2 TEAMS - Public read, Admin modify, Team Owner modify own team
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_public_read" ON public.teams;
CREATE POLICY "teams_public_read" ON public.teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "teams_admin_write" ON public.teams;
CREATE POLICY "teams_admin_write" ON public.teams
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "teams_owner_write_own" ON public.teams;
CREATE POLICY "teams_owner_write_own" ON public.teams
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- 3.3 PLAYERS - Public read (limited columns), Admin/CoAdmin write
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_public_read" ON public.players;
CREATE POLICY "players_public_read" ON public.players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "players_admin_write" ON public.players;
CREATE POLICY "players_admin_write" ON public.players
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.4 USER ROLES - Users see own, Admin see all
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_own_read" ON public.user_roles;
CREATE POLICY "user_roles_own_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.5 BIDDING EVENTS - Authenticated read, Admin/CoAdmin write
ALTER TABLE public.bidding_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bidding_events_auth_read" ON public.bidding_events;
CREATE POLICY "bidding_events_auth_read" ON public.bidding_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bidding_events_admin_coadmin_write" ON public.bidding_events;
CREATE POLICY "bidding_events_admin_coadmin_write" ON public.bidding_events
  FOR ALL USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

-- 3.6 BIDS - Team Owner place own bids, Admin/CoAdmin see all
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bids_admin_coadmin_read" ON public.bids;
CREATE POLICY "bids_admin_coadmin_read" ON public.bids
  FOR SELECT USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

DROP POLICY IF EXISTS "bids_team_owner_read_own" ON public.bids;
CREATE POLICY "bids_team_owner_read_own" ON public.bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = bids.team_id
      AND teams.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bids_team_owner_insert" ON public.bids;
CREATE POLICY "bids_team_owner_insert" ON public.bids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = bids.team_id
      AND teams.owner_user_id = auth.uid()
    )
  );

-- 3.7 PLAYER ALLOCATIONS - Admin/CoAdmin only
ALTER TABLE public.player_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_allocations_admin_coadmin" ON public.player_allocations;
CREATE POLICY "player_allocations_admin_coadmin" ON public.player_allocations
  FOR ALL USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

-- 3.8 MATCHES - Authenticated read, Admin/CoAdmin write
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_auth_read" ON public.matches;
CREATE POLICY "matches_auth_read" ON public.matches
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "matches_admin_coadmin_write" ON public.matches;
CREATE POLICY "matches_admin_coadmin_write" ON public.matches
  FOR ALL USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

-- 3.9 MATCH SCORES - Admin/CoAdmin write, Team Owner read own, Admin/CoAdmin read all
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_scores_admin_coadmin_read" ON public.match_scores;
CREATE POLICY "match_scores_admin_coadmin_read" ON public.match_scores
  FOR SELECT USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

DROP POLICY IF EXISTS "match_scores_team_owner_read_own" ON public.match_scores;
CREATE POLICY "match_scores_team_owner_read_own" ON public.match_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = match_scores.team_id
      AND teams.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_scores_admin_coadmin_write" ON public.match_scores;
CREATE POLICY "match_scores_admin_coadmin_write" ON public.match_scores
  FOR ALL USING (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'co_admin'));

-- 3.10 PLAYER STATS - All authenticated can read
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_stats_auth_read" ON public.player_stats;
CREATE POLICY "player_stats_auth_read" ON public.player_stats
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COALESCE(auth.jwt()->>'email', '') = 'rohit.doshi2007@gmail.com')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'co_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role user_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- 5. RPC FUNCTIONS FOR BUSINESS LOGIC
-- ============================================================================

-- 5.1 ALLOCATE PLAYER TO TEAM (Admin/CoAdmin only)
CREATE OR REPLACE FUNCTION public.allocate_player_to_team(
  p_player_id TEXT,
  p_team_id TEXT,
  p_bidding_event_id TEXT,
  p_allocated_price NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
  v_team RECORD;
  v_result jsonb;
BEGIN
  -- Check permission
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'co_admin')) THEN
    RAISE EXCEPTION 'Access Denied: Only admin or co_admin can allocate players';
  END IF;

  -- Lock player
  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_player_id;
  END IF;

  -- Lock team
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  -- Check purse
  IF v_team.remaining_purse < p_allocated_price THEN
    RAISE EXCEPTION 'Insufficient purse: team has % but price is %', v_team.remaining_purse, p_allocated_price;
  END IF;

  -- Record allocation
  INSERT INTO public.player_allocations (bidding_event_id, player_id, team_id, allocated_price, allocated_by_user_id)
  VALUES (p_bidding_event_id, p_player_id, p_team_id, p_allocated_price, auth.uid());

  -- Update player
  UPDATE public.players
  SET team_id = p_team_id,
      allocated_price = p_allocated_price,
      status = 'allocated',
      updated_at = now()
  WHERE id = p_player_id;

  -- Update team
  UPDATE public.teams
  SET remaining_purse = remaining_purse - p_allocated_price,
      player_count = player_count + 1,
      updated_at = now()
  WHERE id = p_team_id;

  RETURN jsonb_build_object('success', true, 'player_id', p_player_id, 'team_id', p_team_id, 'price', p_allocated_price);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_player_to_team FROM anon, public;
GRANT EXECUTE ON FUNCTION public.allocate_player_to_team TO authenticated, service_role;

-- 5.2 PLACE BID (Team Owner only)
CREATE OR REPLACE FUNCTION public.place_bid(
  p_player_id TEXT,
  p_team_id TEXT,
  p_bidding_event_id TEXT,
  p_bid_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_result jsonb;
BEGIN
  -- Check if user is team owner
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  IF v_team.owner_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: You can only bid for your own team';
  END IF;

  -- Check purse
  IF v_team.remaining_purse < p_bid_amount THEN
    RAISE EXCEPTION 'Insufficient purse: team has % but bid is %', v_team.remaining_purse, p_bid_amount;
  END IF;

  -- Insert bid
  INSERT INTO public.bids (bidding_event_id, player_id, team_id, bid_amount, bidder_user_id)
  VALUES (p_bidding_event_id, p_player_id, p_team_id, p_bid_amount, auth.uid());

  RETURN jsonb_build_object('success', true, 'bid_amount', p_bid_amount, 'team_id', p_team_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_bid FROM anon, public;
GRANT EXECUTE ON FUNCTION public.place_bid TO authenticated, service_role;

-- 5.3 RECORD MATCH SCORE (CoAdmin/Admin only)
CREATE OR REPLACE FUNCTION public.record_match_score(
  p_match_id TEXT,
  p_team_id TEXT,
  p_runs INTEGER,
  p_wickets INTEGER,
  p_overs NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check permission
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'co_admin')) THEN
    RAISE EXCEPTION 'Access Denied: Only admin or co_admin can record scores';
  END IF;

  -- Insert match score
  INSERT INTO public.match_scores (match_id, team_id, runs_scored, wickets_lost, overs_played, recorded_by_user_id, status)
  VALUES (p_match_id, p_team_id, p_runs, p_wickets, p_overs, auth.uid(), 'live');

  RETURN jsonb_build_object('success', true, 'runs', p_runs, 'wickets', p_wickets, 'overs', p_overs);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_match_score FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_match_score TO authenticated, service_role;

-- 5.4 GET TEAM ANALYSIS (Team Owner views own + all other teams)
CREATE OR REPLACE FUNCTION public.get_team_analysis(p_team_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  -- Team Owner can only view their own team details
  IF NOT public.is_admin() AND v_team.owner_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: You can only view your own team analysis';
  END IF;

  RETURN jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'remaining_purse', v_team.remaining_purse,
    'player_count', v_team.player_count,
    'max_squad_size', v_team.max_squad_size
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_analysis FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_team_analysis TO authenticated, service_role;

COMMIT;
