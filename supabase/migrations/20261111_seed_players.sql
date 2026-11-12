-- ============================================================================
-- KAPL SEASON 3 - Seed Real Players
-- Date: 2026-11-11
-- Players: 20 registered players
-- ============================================================================

-- Determine base price by experience level
-- New Player: 100
-- Season 2 Player: 150
-- Season 1 & 2 Player: 200

INSERT INTO public.players (
  id,
  tournament_id,
  name,
  role,
  batting_style,
  bowling_style,
  mobile_number,
  photo_url,
  base_price,
  status,
  created_at
)
VALUES
  -- 1. Renuka Bhave - New Player
  ('p_renuka_bhave', 'kapl-3-mens', 'Renuka Bhave', 'all_rounder', 'Right-hand bat', 'None / Occasional', '9881044456', NULL, 100, 'available', now()),

  -- 2. Dr Madhavi Bankar - Season 1 & 2 Player (Base 200)
  ('p_madhavi_bankar', 'kapl-3-mens', 'Dr Madhavi Bankar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9822555383', NULL, 200, 'available', now()),

  -- 3. Tushar Bankar - Season 1 & 2 Player (Base 200)
  ('p_tushar_bankar', 'kapl-3-mens', 'Tushar Bankar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9881138320', NULL, 200, 'available', now()),

  -- 4. Siddhu Bharamgonde - Season 2 Player (Base 150)
  ('p_siddhu_bharamgonde', 'kapl-3-mens', 'Siddhu Bharamgonde', 'bowler', 'Right-hand bat', 'Right-arm medium', '9850382575', NULL, 150, 'available', now()),

  -- 5. Monica Limaye - Season 1 & 2 Player (Base 200)
  ('p_monica_limaye', 'kapl-3-mens', 'Monica Limaye', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '7720031570', NULL, 200, 'available', now()),

  -- 6. Sanjay Angal - New Player (Base 100)
  ('p_sanjay_angal', 'kapl-3-mens', 'Sanjay Angal', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '8983074341', NULL, 100, 'available', now()),

  -- 7. Soham Bharamgonde - Season 2 Player (Base 150)
  ('p_soham_bharamgonde', 'kapl-3-mens', 'Soham Bharamgonde', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '7066792575', NULL, 150, 'available', now()),

  -- 8. Yogesh Bhagwat - Season 1 & 2 Player (Base 200)
  ('p_yogesh_bhagwat', 'kapl-3-mens', 'Yogesh Bhagwat', 'all_rounder', 'Right-hand bat', 'Left-arm medium', '9833737568', NULL, 200, 'available', now()),

  -- 9. Shivaansh Chitnis - New Player (Base 100)
  ('p_shivaansh_chitnis', 'kapl-3-mens', 'Shivaansh Chitnis', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '88668842520', NULL, 100, 'available', now()),

  -- 10. Aayush Daflapurkar - Season 1 & 2 Player (Base 200)
  ('p_aayush_daflapurkar', 'kapl-3-mens', 'Aayush Daflapurkar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9175923432', NULL, 200, 'available', now()),

  -- 11. Rohan Chitnis - Season 1 & 2 Player (Base 200)
  ('p_rohan_chitnis', 'kapl-3-mens', 'Rohan Chitnis', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '9769586086', NULL, 200, 'available', now()),

  -- 12. Hrishikesh Ranade - Season 2 Player (Base 150)
  ('p_hrishikesh_ranade', 'kapl-3-mens', 'Hrishikesh Ranade', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9860097217', NULL, 150, 'available', now()),

  -- 13. Mithil Bagal - Season 2 Player (Base 150)
  ('p_mithil_bagal', 'kapl-3-mens', 'Mithil Bagal', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '9822278501', NULL, 150, 'available', now()),

  -- 14. Aaradhya Pande - New Player (Base 100)
  ('p_aaradhya_pande', 'kapl-3-mens', 'Aaradhya Pande', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9823310361', NULL, 100, 'available', now()),

  -- 15. Smita Daflapurkar - Season 1 & 2 Player (Base 200)
  ('p_smita_daflapurkar', 'kapl-3-mens', 'Smita Daflapurkar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', '9764935234', NULL, 200, 'available', now()),

  -- 16. Tejas Sohani - Season 1 & 2 Player (Base 200)
  ('p_tejas_sohani', 'kapl-3-mens', 'Tejas Sohani', 'all_rounder', 'Right-hand bat', 'Right-arm leg spin', '9423012075', NULL, 200, 'available', now()),

  -- 17. Sandeep Nirmal - Season 2 Player (Base 150)
  ('p_sandeep_nirmal', 'kapl-3-mens', 'Sandeep Nirmal', 'all_rounder', 'Right-hand bat', 'Left-arm orthodox', '8975753119', NULL, 150, 'available', now()),

  -- 18. Sagar Patankar - Season 1 & 2 Player (Base 200)
  ('p_sagar_patankar', 'kapl-3-mens', 'Sagar Patankar', 'bowler', 'Right-hand bat', 'Right-arm medium', '9975498219', NULL, 200, 'available', now()),

  -- 19. Amol Pande - Season 1 & 2 Player (Base 200)
  ('p_amol_pande', 'kapl-3-mens', 'Amol Pande', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', '9823310361', NULL, 200, 'available', now()),

  -- 20. Swapnil Shah - Season 1 & 2 Player (Base 200)
  ('p_swapnil_shah', 'kapl-3-mens', 'Swapnil Shah', 'batter', 'Right-hand bat', 'Right-arm medium', '09011037290', NULL, 200, 'available', now())

ON CONFLICT (id) DO NOTHING;

-- Verify inserted
SELECT 'Players Seeded' as status, COUNT(*) as total_players FROM public.players WHERE tournament_id = 'kapl-3-mens';

COMMIT;
