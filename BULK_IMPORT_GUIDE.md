# Bulk Player Import Guide

Due to Supabase Row Level Security (RLS) policies, players can only be added by authenticated administrators through the web application. Here's how to add these 24 players:

## Players to Add (24 Total)

### Women's Tournament (kapl-3-womens)

| # | Name | Phone | Role | Batting | Bowling |
|---|------|-------|------|---------|---------|
| 1 | Rishaan Panke | 8379096455 | batter | Right-hand bat | Right-arm medium |
| 2 | Rashi Bhave | 7558468500 | all_rounder | Right-hand bat | None |
| 3 | Rihan Anandsagar Shiralkar | 8888766006 | all_rounder | Left-hand bat | Left-arm medium |
| 4 | Anandsagar Mohan Shiralkar | 8888766006 | all_rounder | Right-hand bat | Right-arm medium |
| 5 | Renuka Bhave | 9881044456 | all_rounder | Right-hand bat | None |
| 6 | Dr Madhavi Bankar | 9822555383 | all_rounder | Right-hand bat | Right-arm medium |
| 7 | Tushar Bankar | 9881138320 | all_rounder | Right-hand bat | Right-arm medium |
| 8 | Siddhu Bharamgonde | 9850382575 | bowler | Right-hand bat | Right-arm medium |
| 9 | Monica Limaye | 7720031570 | all_rounder | Right-hand bat | Right-arm medium |
| 10 | Sanjay Angal | 8983074341 | all_rounder | Right-hand bat | Right-arm off spin |
| 11 | Soham Bharamgonde | 7066792575 | all_rounder | Right-hand bat | Right-arm off spin |
| 12 | Yogesh Bhagwat | 9833737568 | all_rounder | Right-hand bat | Left-arm medium |
| 13 | Shivaansh Chitnis | 88668842520 | all_rounder | Right-hand bat | Right-arm off spin |
| 14 | Aayush Daflapurkar | 9175923432 | all_rounder | Right-hand bat | Right-arm medium |
| 15 | Rohan Chitnis | 9769586086 | all_rounder | Right-hand bat | Right-arm off spin |
| 16 | Hrishikesh Ranade | 9860097217 | all_rounder | Right-hand bat | Right-arm medium |
| 17 | Mithil Bagal | 9822278501 | all_rounder | Right-hand bat | Right-arm off spin |
| 18 | Aaradhya Pande | 9823310361 | all_rounder | Right-hand bat | Right-arm medium |
| 19 | Smita Daflapurkar | 9764935234 | all_rounder | Right-hand bat | Right-arm medium |
| 20 | Tejas Sohani | 9423012075 | all_rounder | Right-hand bat | Right-arm leg spin |
| 21 | Sandeep Nirmal | 8975753119 | all_rounder | Right-hand bat | Left-arm orthodox |
| 22 | Sagar Patankar | 9975498219 | bowler | Right-hand bat | Right-arm medium |
| 23 | Amol Pande | 9823310361 | all_rounder | Right-hand bat | Right-arm off spin |
| 24 | Swapnil Shah | 09011037290 | batter | Right-hand bat | Right-arm medium |

## Method 1: Add via Web UI (Recommended)

1. Open the KAPL Auction application in your browser
2. Navigate to **Auction** section
3. Switch to **Women's (kapl-3-womens)** tournament
4. Click **"+ Add Player to Auction"** button
5. Fill in the player details:
   - **Player Name**: [from table above]
   - **Playing Role**: [from table above]
   - **Gender**: Female
   - **Batting Style**: [from table above]
   - **Bowling Style**: [from table above]
   - **Base Value**: ₹100
   - **Mobile Number**: [from table above]
   - **Tournament League**: KAPL 3.0 Women's Tournament
6. Click **"Add Player to Live Auction"**
7. Repeat for all 24 players

## Method 2: Create Admin User (For Script Access)

If you want to use automated import in the future:

1. Go to Supabase Project Settings
2. Create a service role key with admin permissions
3. Set as environment variable:
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY="your_service_key"
   ```
4. Run import script:
   ```bash
   node scripts/import-players.mjs kapl-3-womens
   ```

## Method 3: Direct Supabase SQL (Advanced)

If you have direct database access:

```sql
-- Insert all players at once
INSERT INTO public.players (
  id, name, role, batting_style, bowling_style, 
  base_price, auction_status, tournament_id, mobile_number
) VALUES 
('p_c_1_w', 'Rishaan Panke', 'batter', 'Right-hand bat', 'Right-arm medium', 100, 'pending', 'kapl-3-womens', '8379096455'),
('p_c_2_w', 'Rashi Bhave', 'all_rounder', 'Right-hand bat', 'None', 100, 'pending', 'kapl-3-womens', '7558468500'),
-- ... (repeat for all 24 players)
ON CONFLICT DO NOTHING;
```

## Tips

- ✅ All players default to **Base Price ₹100**
- ✅ All players start with **Auction Status: Pending**
- ✅ Mobile numbers are optional but recommended
- ✅ Players can be edited after creation
- ✅ Use the **Export** button to verify imports
- ✅ Changes sync to Supabase in real-time

## Verification

After adding all players:

1. Go to **Categories** tab and verify all 24 players appear
2. Go to **Admin** tab and check player list
3. Click **Export to Excel/Text** to download and verify data
4. Start the auction process

---

**Notes:**
- If you need to add these in bulk from the backend, please provide the Supabase Service Role Key
- The RLS policies prevent unauthenticated bulk inserts for security reasons
- Use the web UI method for immediate results
