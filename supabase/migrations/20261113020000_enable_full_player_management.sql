-- Migration: 20261113020000_enable_full_player_management.sql
-- Enables full player management (insert, update, delete) for Administrators and Live Auction

-- 1. Update is_admin() to recognize both administrator emails and roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (lower(COALESCE(auth.jwt()->>'email', '')) IN ('rohit.doshi2007@gmail.com', 'rohitdoshicolg@gmail.com'))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'co_admin');
$$;

-- 2. Ensure user_roles has admin privileges
INSERT INTO public.user_roles (email, role)
SELECT v.email, v.role
FROM (VALUES 
  ('rohit.doshi2007@gmail.com', 'admin'),
  ('rohitdoshicolg@gmail.com', 'admin')
) AS v(email, role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles u 
  WHERE lower(u.email) = lower(v.email) AND u.role = v.role
);

-- 3. RLS Policies on public.players for INSERT, UPDATE, and DELETE
DROP POLICY IF EXISTS "Admins can manage all players" ON public.players;
DROP POLICY IF EXISTS "Anyone can insert players" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;
DROP POLICY IF EXISTS "Anyone can delete players" ON public.players;
DROP POLICY IF EXISTS "Allow player insert for auction" ON public.players;
DROP POLICY IF EXISTS "Allow player update for auction" ON public.players;
DROP POLICY IF EXISTS "Allow player delete for auction" ON public.players;

CREATE POLICY "Allow player insert for auction"
  ON public.players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow player update for auction"
  ON public.players FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow player delete for auction"
  ON public.players FOR DELETE
  USING (true);

-- 4. Grant table privileges on public.players to anon and authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players TO anon, authenticated, service_role;

-- 5. Update register_new_player RPC to handle conflict gracefully
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
  INSERT INTO public.players (
    id, user_id, name, role, batting_style, bowling_style,
    tournament_id, jersey_number, photo_url,
    base_price, auction_status
  ) VALUES (
    p_id, p_user_id, p_name, p_role, p_batting_style, p_bowling_style,
    p_tournament_id, p_jersey_number, p_photo_url,
    p_base_price, 'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    batting_style = EXCLUDED.batting_style,
    bowling_style = EXCLUDED.bowling_style,
    jersey_number = COALESCE(EXCLUDED.jersey_number, public.players.jersey_number),
    photo_url = COALESCE(EXCLUDED.photo_url, public.players.photo_url),
    base_price = EXCLUDED.base_price,
    updated_at = now();

  SELECT jsonb_build_object(
    'success', true,
    'id', p_id,
    'name', p_name,
    'role', p_role,
    'tournament_id', p_tournament_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_new_player TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_player_by_id TO anon, authenticated, service_role;
