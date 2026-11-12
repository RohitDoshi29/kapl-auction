-- Direct Supabase SQL to insert all 24 players for Women's Tournament (kapl-3-womens)
-- Copy and paste this entire command into Supabase SQL Editor

INSERT INTO public.players (
  id, name, role, batting_style, bowling_style,
  base_price, auction_status, tournament_id, mobile_number
) VALUES
('p_c_1_w', 'Rishaan Panke', 'batter', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '8379096455'),
('p_c_2_w', 'Rashi Bhave', 'all_rounder', 'Right-hand bat', 'None', 100, 'pending', 'kapl-3-womens', '7558468500'),
('p_c_3_w', 'Rihan Anandsagar Shiralkar', 'all_rounder', 'Left-hand bat', 'Left-arm medium', 100, 'pending', 'kapl-3-womens', '8888766006'),
('p_c_4_w', 'Anandsagar Mohan Shiralkar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '8888766006'),
('p_c_5_w', 'Renuka Bhave', 'all_rounder', 'Right-hand bat', 'None', 100, 'pending', 'kapl-3-womens', '9881044456'),
('p_c_6_w', 'Dr Madhavi Bankar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9822555383'),
('p_c_7_w', 'Tushar Bankar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9881138320'),
('p_c_8_w', 'Siddhu Bharamgonde', 'bowler', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9850382575'),
('p_c_9_w', 'Monica Limaye', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '7720031570'),
('p_c_10_w', 'Sanjay Angal', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '8983074341'),
('p_c_11_w', 'Soham Bharamgonde', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '7066792575'),
('p_c_12_w', 'Yogesh Bhagwat', 'all_rounder', 'Right-hand bat', 'Left-arm medium', 100, 'pending', 'kapl-3-womens', '9833737568'),
('p_c_13_w', 'Shivaansh Chitnis', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '8866884252'),
('p_c_14_w', 'Aayush Daflapurkar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9175923432'),
('p_c_15_w', 'Rohan Chitnis', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '9769586086'),
('p_c_16_w', 'Hrishikesh Ranade', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9860097217'),
('p_c_17_w', 'Mithil Bagal', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '9822278501'),
('p_c_18_w', 'Aaradhya Pande', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9823310361'),
('p_c_19_w', 'Smita Daflapurkar', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9764935234'),
('p_c_20_w', 'Tejas Sohani', 'all_rounder', 'Right-hand bat', 'Right-arm leg spin', 100, 'pending', 'kapl-3-womens', '9423012075'),
('p_c_21_w', 'Sandeep Nirmal', 'all_rounder', 'Right-hand bat', 'Left-arm orthodox', 100, 'pending', 'kapl-3-womens', '8975753119'),
('p_c_22_w', 'Sagar Patankar', 'bowler', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9975498219'),
('p_c_23_w', 'Amol Pande', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 100, 'pending', 'kapl-3-womens', '9823310361'),
('p_c_24_w', 'Swapnil Shah', 'batter', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '9011037290')
ON CONFLICT (id) DO NOTHING;
