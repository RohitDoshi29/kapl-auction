-- ==============================================================================
-- KAPL 3.0 Auction — Complete Database Initialization Script (Fresh Project)
-- Run this entire script in your new Supabase Project -> SQL Editor -> Click 'Run'.
-- Safe to re-run: idempotent, auction-only, 12 empty teams (Men's & Women's).
-- ==============================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'co_admin',
      'owner',
      'user',
      'player',
      'primary_scorer',
      'secondary_scorer',
      'captain'
    );
  ELSE
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'co_admin';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'player';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'primary_scorer';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secondary_scorer';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'captain';
  END IF;
END $$;

-- 2. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. USER ROLES & ACCESS CONTROL
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (lower(COALESCE(auth.jwt()->>'email', '')) = 'rohit.doshi2007@gmail.com')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'co_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (lower(COALESCE(auth.jwt()->>'email', '')) = 'rohit.doshi2007@gmail.com')
    OR public.has_role(auth.uid(), 'admin');
$$;

-- 4. TOURNAMENTS TABLE
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '3.0',
  category TEXT NOT NULL CHECK (category IN ('mens', 'womens')),
  status TEXT NOT NULL DEFAULT 'auction' CHECK (status IN ('upcoming', 'auction', 'live', 'completed')),
  rules JSONB NOT NULL DEFAULT '{"max_overs": 7, "max_overs_per_bowler": 2, "max_wickets": 10, "negative_runs_enabled": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.tournaments (id, name, edition, category, status)
VALUES
  ('kapl-3-mens', 'KAPL 3.0 Men''s Tournament', '3.0', 'mens', 'auction'),
  ('kapl-3-womens', 'KAPL 3.0 Women''s Tournament', '3.0', 'womens', 'auction')
ON CONFLICT (id) DO NOTHING;

-- 5. TEAMS TABLE (8 Men's + 4 Women's Franchises, clean for live auction)
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  logo TEXT,
  primary_color TEXT NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_count INTEGER NOT NULL DEFAULT 0,
  initial_purse NUMERIC NOT NULL DEFAULT 10000,
  remaining_purse NUMERIC NOT NULL DEFAULT 10000,
  max_squad_size INTEGER NOT NULL DEFAULT 10,
  captain_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name TEXT,
  owner_email TEXT,
  captain_name TEXT,
  captain_player_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.teams (
  id, tournament_id, name, "group", logo, primary_color,
  players, player_count, remaining_purse, initial_purse, max_squad_size,
  owner_name, owner_email, owner_user_id
)
VALUES
  ('a1', 'kapl-3-mens', 'Kapil''s Warriors', 'A', null, '0 84% 60%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('a2', 'kapl-3-mens', 'Kapil Falcons', 'A', null, '174 72% 40%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('a3', 'kapl-3-mens', 'Insta Paltans', 'A', null, '267 84% 51%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('a4', 'kapl-3-mens', 'Kapil''s Devils', 'A', null, '222 47% 31%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('b1', 'kapl-3-mens', 'Goodness Royals', 'B', null, '43 96% 56%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('b2', 'kapl-3-mens', 'Kapil Ke Singham', 'B', null, '199 89% 48%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('b3', 'kapl-3-mens', 'Super Strikers', 'B', null, '280 68% 51%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('b4', 'kapl-3-mens', 'Kapil Avengers', 'B', null, '25 95% 53%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('w_a1', 'kapl-3-womens', 'Kapil Queens', 'A', null, '326 78% 60%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('w_a2', 'kapl-3-womens', 'Falconettes', 'A', null, '174 72% 40%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('w_b1', 'kapl-3-womens', 'Royal Challengers Women', 'B', null, '0 84% 60%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null),
  ('w_b2', 'kapl-3-womens', 'Super Strikers Women', 'B', null, '280 68% 51%', '[]'::jsonb, 0, 10000, 10000, 10, null, null, null)
ON CONFLICT (id) DO NOTHING;

-- Auth trigger: assign Main Admin (rohit.doshi2007@gmail.com or first user), or link pre-assigned Team Owner
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
  has_assigned_team boolean;
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = NEW.id AND email_confirmed_at IS NULL;

  IF lower(COALESCE(NEW.email, '')) = 'rohit.doshi2007@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE lower(COALESCE(owner_email, '')) = lower(COALESCE(NEW.email, ''))
      AND COALESCE(owner_email, '') <> ''
  ) INTO has_assigned_team;

  IF has_assigned_team THEN
    UPDATE public.teams
    SET owner_user_id = NEW.id, updated_at = now()
    WHERE lower(COALESCE(owner_email, '')) = lower(COALESCE(NEW.email, ''));

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_add_role ON auth.users;
CREATE TRIGGER on_auth_user_created_add_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 6. PLAYERS TABLE (Empty pool ready for auction)
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY DEFAULT ('p_' || gen_random_uuid()),
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'all_rounder' CHECK (role IN ('batter', 'bowler', 'all_rounder', 'wicket_keeper')),
  batting_style TEXT DEFAULT 'Right-hand bat',
  bowling_style TEXT DEFAULT 'Right-arm medium',
  photo_url TEXT,
  base_price NUMERIC NOT NULL DEFAULT 100,
  sold_price NUMERIC,
  auction_status TEXT NOT NULL DEFAULT 'pending' CHECK (auction_status IN ('pending', 'bidding', 'sold', 'unsold')),
  jersey_number INTEGER,
  mobile_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_tournament ON public.players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_user ON public.players(user_id);

-- 7. AUCTION STATE & BIDS TABLES
CREATE TABLE IF NOT EXISTS public.auction_state (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  current_player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  current_bid NUMERIC NOT NULL DEFAULT 100,
  highest_bidder_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  bid_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'bidding', 'fair_warning', 'sold', 'unsold', 'completed', 'paused')),
  timer_ends_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.auction_state (id, tournament_id, status)
VALUES
  ('kapl-3-mens', 'kapl-3-mens', 'idle'),
  ('kapl-3-womens', 'kapl-3-womens', 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bid_amount NUMERIC NOT NULL,
  bidder_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_player ON public.auction_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_tournament ON public.auction_bids(tournament_id);

-- 8. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS update_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_auction_state_updated_at ON public.auction_state;
CREATE TRIGGER update_auction_state_updated_at BEFORE UPDATE ON public.auction_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Admins can manage all players" ON public.players;
DROP POLICY IF EXISTS "Users can update own player record" ON public.players;
DROP POLICY IF EXISTS "Users can insert own player record" ON public.players;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins can manage all players" ON public.players FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users can update own player record" ON public.players FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own player record" ON public.players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view auction state" ON public.auction_state;
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Anyone can view auction state" ON public.auction_state FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction state" ON public.auction_state FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated users and Admins can insert bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Admins can manage auction bids" ON public.auction_bids;
CREATE POLICY "Anyone can view auction bids" ON public.auction_bids FOR SELECT USING (true);
CREATE POLICY "Authenticated users and Admins can insert bids" ON public.auction_bids FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR auth.uid() = bidder_user_id);
CREATE POLICY "Admins can manage auction bids" ON public.auction_bids FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sensitive column protection on public.players
REVOKE SELECT ON TABLE public.players FROM anon, authenticated;
GRANT SELECT (
  id, name, photo_url, role, batting_style, bowling_style,
  tournament_id, team_id, jersey_number, base_price, sold_price,
  auction_status, created_at, updated_at
) ON public.players TO anon, authenticated;

-- 10. ENABLE REALTIME
ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.auction_bids REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournaments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'teams') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;
END $$;

-- 11. AUCTION & ADMIN RPCS
CREATE OR REPLACE FUNCTION public.reset_all_players_and_teams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can reset auction data.';
  END IF;

  DELETE FROM public.auction_bids;
  DELETE FROM public.players;

  UPDATE public.teams
  SET
    players = '[]'::jsonb,
    player_count = 0,
    remaining_purse = initial_purse,
    updated_at = now();

  UPDATE public.auction_state
  SET
    current_player_id = NULL,
    current_bid = 100,
    highest_bidder_team_id = NULL,
    bid_history = '[]'::jsonb,
    status = 'idle',
    timer_ends_at = NULL,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_all_players_and_teams() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reset_all_players_and_teams() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_new_player(
  p_id TEXT,
  p_name TEXT,
  p_role TEXT,
  p_batting_style TEXT DEFAULT 'Right-hand bat',
  p_bowling_style TEXT DEFAULT 'Right-arm medium',
  p_tournament_id TEXT DEFAULT 'kapl-3-mens',
  p_jersey_number INTEGER DEFAULT NULL,
  p_mobile_number TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_base_price NUMERIC DEFAULT 100,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.is_admin() OR (auth.uid() IS NOT NULL AND auth.uid() = p_user_id)) THEN
    RAISE EXCEPTION 'Access Denied: Only administrators or the authenticated user can register or update this player profile.';
  END IF;

  INSERT INTO public.players (
    id, user_id, name, role, batting_style, bowling_style,
    tournament_id, jersey_number, mobile_number, photo_url,
    base_price, auction_status
  ) VALUES (
    p_id, p_user_id, p_name, p_role, p_batting_style, p_bowling_style,
    p_tournament_id, p_jersey_number, p_mobile_number, p_photo_url,
    p_base_price, 'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    batting_style = EXCLUDED.batting_style,
    bowling_style = EXCLUDED.bowling_style,
    jersey_number = EXCLUDED.jersey_number,
    mobile_number = EXCLUDED.mobile_number,
    photo_url = EXCLUDED.photo_url,
    tournament_id = EXCLUDED.tournament_id,
    updated_at = now()
  RETURNING to_jsonb(public.players.*) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_new_player FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_new_player TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_player_by_id(p_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can delete players.';
  END IF;

  DELETE FROM public.auction_bids WHERE player_id = p_id;
  DELETE FROM public.players WHERE id = p_id;

  UPDATE public.teams
  SET
    players = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(players) AS elem
      WHERE elem->>'id' != p_id
    ),
    player_count = (
      SELECT count(*)
      FROM jsonb_array_elements(players) AS elem
      WHERE elem->>'id' != p_id
    ),
    updated_at = now()
  WHERE players @> jsonb_build_array(jsonb_build_object('id', p_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_player_by_id(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_player_by_id(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sell_player_to_team(
  p_tournament_id TEXT,
  p_player_id TEXT,
  p_team_id TEXT,
  p_sold_price NUMERIC,
  p_bidder_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_player RECORD;
  v_new_purse NUMERIC;
  v_updated_players JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can finalize player sales.';
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_player_id;
  END IF;

  v_new_purse := v_team.remaining_purse - p_sold_price;
  IF v_new_purse < 0 THEN
    RAISE EXCEPTION 'Insufficient purse: team has % but sale price is %', v_team.remaining_purse, p_sold_price;
  END IF;

  UPDATE public.players
  SET
    team_id = p_team_id,
    sold_price = p_sold_price,
    auction_status = 'sold',
    updated_at = now()
  WHERE id = p_player_id;

  v_updated_players := (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(v_team.players, '[]'::jsonb)) AS elem
    WHERE elem->>'id' != p_player_id
  ) || jsonb_build_array(jsonb_build_object(
    'id', v_player.id,
    'name', v_player.name,
    'photo', v_player.photo_url,
    'role', v_player.role,
    'soldPrice', p_sold_price
  ));

  UPDATE public.teams
  SET
    remaining_purse = v_new_purse,
    players = v_updated_players,
    player_count = jsonb_array_length(v_updated_players),
    updated_at = now()
  WHERE id = p_team_id;

  INSERT INTO public.auction_state (id, tournament_id, current_player_id, current_bid, highest_bidder_team_id, status, timer_ends_at, updated_at)
  VALUES (p_tournament_id, p_tournament_id, p_player_id, p_sold_price, p_team_id, 'sold', NULL, now())
  ON CONFLICT (id) DO UPDATE SET
    tournament_id = EXCLUDED.tournament_id,
    current_player_id = EXCLUDED.current_player_id,
    current_bid = EXCLUDED.current_bid,
    highest_bidder_team_id = EXCLUDED.highest_bidder_team_id,
    status = 'sold',
    timer_ends_at = NULL,
    updated_at = now();

  INSERT INTO public.auction_bids (tournament_id, player_id, team_id, bid_amount, bidder_user_id)
  VALUES (p_tournament_id, p_player_id, p_team_id, p_sold_price, p_bidder_user_id);

  RETURN jsonb_build_object('success', true, 'remainingPurse', v_new_purse);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sell_player_to_team FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sell_player_to_team TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_private_player_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_player
  FROM public.players
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_player);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_player_profile() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_private_player_profile() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_player_private_details(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
BEGIN
  IF NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.players WHERE id = p_player_id AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Access Denied: Only administrators or the player themselves can view private contact details.';
  END IF;

  SELECT * INTO v_player
  FROM public.players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_player);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_player_private_details(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_player_private_details(TEXT) TO authenticated, service_role;

-- Admin email-based role assignment & deletion in auth/public.user_roles
CREATE OR REPLACE FUNCTION public.admin_assign_role_by_email(
  p_email TEXT,
  p_role public.app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_user_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can assign roles.';
  END IF;

  IF p_role IN ('admin', 'co_admin') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Main Admin or Admin can assign Admin or Co-Admin roles.';
  END IF;

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = v_target_user_id
    AND role IN ('co_admin', 'owner', 'primary_scorer', 'secondary_scorer', 'captain');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_target_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('found', true, 'user_id', v_target_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_role_by_email(TEXT, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_assign_role_by_email(TEXT, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_role_by_email(
  p_email TEXT,
  p_role public.app_role DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_user_id UUID;
  v_clean_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can revoke roles.';
  END IF;

  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = 'rohit.doshi2007@gmail.com' AND (p_role IS NULL OR p_role = 'admin') THEN
    RAISE EXCEPTION 'Cannot revoke Main Admin role.';
  END IF;

  IF p_role IN ('admin', 'co_admin') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Main Admin or Admin can revoke Admin or Co-Admin roles.';
  END IF;

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF p_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_target_user_id
      AND role = p_role;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = v_target_user_id
      AND role IN ('co_admin', 'owner', 'primary_scorer', 'secondary_scorer', 'captain');
  END IF;

  RETURN jsonb_build_object('found', true, 'user_id', v_target_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_role_by_email(TEXT, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role_by_email(TEXT, public.app_role) TO authenticated, service_role;
