# 🚀 Quick SQL Reference - Both Tournaments

## Updated Command: Now Adds Players to BOTH Tournaments!

The `INSERT_ALL_PLAYERS.sql` file now contains a single SQL command that adds all 24 players to:
- ✅ **Men's Tournament** (kapl-3-mens) - 24 players
- ✅ **Women's Tournament** (kapl-3-womens) - 24 players
- **Total: 48 rows** (same players, both tournaments)

---

## How to Use

### Step 1: Copy the SQL Command
From `INSERT_ALL_PLAYERS.sql`, copy the entire command (all 48 player rows)

### Step 2: Open Supabase
1. Go to https://app.supabase.com
2. Select your KAPL project
3. Click **"SQL Editor"** → **"New Query"**

### Step 3: Paste & Execute
1. Paste the entire SQL command
2. Click **"Run"** or press `Ctrl+Enter`

### Step 4: Verify
You should see: `✓ Success. No rows returned.`

---

## What Gets Created

| Tournament | Player Count | Player IDs | Format |
|-----------|--------------|-----------|---------|
| **kapl-3-mens** | 24 | p_c_1, p_c_2, ..., p_c_24 | No suffix |
| **kapl-3-womens** | 24 | p_c_1_w, p_c_2_w, ..., p_c_24_w | _w suffix |
| **TOTAL** | **48** | - | - |

---

## Players Added

All these players will be in BOTH tournaments:

1. Rishaan Panke (Batter)
2. Rashi Bhave (All-rounder)
3. Rihan Anandsagar Shiralkar (All-rounder)
4. Anandsagar Mohan Shiralkar (All-rounder)
5. Renuka Bhave (All-rounder)
6. Dr Madhavi Bankar (All-rounder)
7. Tushar Bankar (All-rounder)
8. Siddhu Bharamgonde (Bowler)
9. Monica Limaye (All-rounder)
10. Sanjay Angal (All-rounder)
11. Soham Bharamgonde (All-rounder)
12. Yogesh Bhagwat (All-rounder)
13. Shivaansh Chitnis (All-rounder)
14. Aayush Daflapurkar (All-rounder)
15. Rohan Chitnis (All-rounder)
16. Hrishikesh Ranade (All-rounder)
17. Mithil Bagal (All-rounder)
18. Aaradhya Pande (All-rounder)
19. Smita Daflapurkar (All-rounder)
20. Tejas Sohani (All-rounder)
21. Sandeep Nirmal (All-rounder)
22. Sagar Patankar (Bowler)
23. Amol Pande (All-rounder)
24. Swapnil Shah (Batter)

---

## Verification Queries

### Count Players in Each Tournament
```sql
SELECT 
  tournament_id, 
  COUNT(*) as player_count 
FROM public.players 
WHERE tournament_id IN ('kapl-3-mens', 'kapl-3-womens')
GROUP BY tournament_id;
```

Expected result:
```
tournament_id    | player_count
kapl-3-mens      | 24
kapl-3-womens    | 24
```

### View All Inserted Players
```sql
SELECT id, name, role, tournament_id 
FROM public.players 
WHERE tournament_id IN ('kapl-3-mens', 'kapl-3-womens')
ORDER BY tournament_id, name;
```

---

## Speed Comparison

| Method | Time | Players Added |
|--------|------|---------------|
| **Web UI** | 20-30 min | Both tournaments manually |
| **SQL (Updated)** | 30 sec | Both tournaments at once ✨ |

---

## Next Steps

After running the SQL:

1. ✅ Go back to the KAPL Auction app
2. ✅ Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
3. ✅ Switch between Men's and Women's tournaments
4. ✅ You should see all 24 players in each tournament
5. ✅ Ready to start the auction!

---

**That's it! One SQL command = Both tournaments populated.** 🎉
