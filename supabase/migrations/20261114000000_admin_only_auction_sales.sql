-- Migration: 20261114000000_admin_only_auction_sales.sql
-- Restricts live auction operations (selling players, bidding, state management) strictly to Administrators.
-- Other users (spectators, owners, players) have read-only access to view the live auction in real-time.

-- 1. Tighten sell_player_to_team RPC to require administrator privileges
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
  -- Strict verification: Only Administrator can conduct auction & finalize player sales
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can finalize player sales in the auction.';
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

-- 2. Ensure RLS policies on auction_state & auction_bids allow public read but admin-only mutation
DROP POLICY IF EXISTS "Anyone can view auction state" ON public.auction_state;
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Anyone can view auction state" ON public.auction_state FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction state" ON public.auction_state FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Admins can manage auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated users and Admins can insert bids" ON public.auction_bids;
CREATE POLICY "Anyone can view auction bids" ON public.auction_bids FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction bids" ON public.auction_bids FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.auction_state TO anon, authenticated;
GRANT SELECT ON public.auction_bids TO anon, authenticated;
