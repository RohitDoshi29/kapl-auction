# 🔧 Debug Guide: Tournament Switching Issue

## The Problem

When switching between Men's (kapl-3-mens) and Women's (kapl-3-womens) tournaments, the UI shows:
- ❌ Same teams regardless of tournament selected
- ❌ Same players regardless of tournament selected
- ❌ No change when switching tournament tabs

## How to Debug

### Step 1: Open Browser Console

1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Clear logs: `console.clear()`

### Step 2: Watch the Logs

When you switch tournaments, look for logs like:

```
🔄 Tournament changed from kapl-3-mens to kapl-3-womens
🎯 fetchData called for tournament: kapl-3-womens
👥 Fetching players for tournament: kapl-3-womens
✅ Fetched total players from DB: 48
📋 Fetching teams for tournament: kapl-3-womens
✅ Fetched teams: 12 teams for kapl-3-womens
✅ Setting teams from DB: 12 teams
🎯 Fetch complete for tournament: kapl-3-womens players: 24
```

### Step 3: Check for Issues

**Issue 1: Tournament doesn't change**
```
❌ NO "🔄 Tournament changed" log appears
```
- Problem: Tournament context not updating
- Check: Are you clicking the tournament buttons?
- Fix: Try hard refresh: `Ctrl+Shift+R`

**Issue 2: fetchData not called**
```
✅ "🔄 Tournament changed" appears
❌ NO "🎯 fetchData called" appears
```
- Problem: useEffect not triggering on tournament change
- Fix: The code should automatically call fetchData when tournament changes
- Check: Are you seeing any errors in console?

**Issue 3: Wrong number of teams/players**
```
✅ "🎯 fetchData called for tournament: kapl-3-womens"
❌ "✅ Fetched teams: 0 teams for kapl-3-womens"
```
- Problem: No teams in database for that tournament
- Fix: You need to add teams to Supabase first
- Check: Go to Supabase → Table Editor → teams → verify tournament_id column

**Issue 4: Teams fetched but not displayed**
```
✅ "✅ Setting teams from DB: 12 teams"
❌ UI still shows old teams
```
- Problem: React state update not triggering re-render
- Fix: Hard refresh the page
- Or: Close and reopen the dialog

### Step 4: Check Supabase Data

Go to Supabase Dashboard:

1. **SQL Editor** → Run this query:
```sql
SELECT tournament_id, COUNT(*) as count FROM public.teams GROUP BY tournament_id;
```

Expected result:
```
tournament_id    | count
kapl-3-mens      | 12
kapl-3-womens    | 12
```

2. **SQL Editor** → Run this query:
```sql
SELECT tournament_id, COUNT(*) as count FROM public.players WHERE auction_status = 'pending' GROUP BY tournament_id;
```

Expected result:
```
tournament_id    | count
kapl-3-mens      | 24
kapl-3-womens    | 24
```

## Common Root Causes

### 1. Teams Not Added for Both Tournaments
**Symptom:** Only one tournament shows teams
**Fix:** Use the SQL import to add teams for both tournaments

### 2. localStorage Cache Issue
**Symptom:** Switching back shows old data again
**In Console**, clear cache:
```javascript
// Clear all KAPL-related cache
['kapl_auction_teams_kapl-3-mens', 'kapl_auction_teams_kapl-3-womens', 
 'kapl_auction_players_kapl-3-mens', 'kapl_auction_players_kapl-3-womens']
.forEach(key => localStorage.removeItem(key));

// Hard refresh
location.reload();
```

### 3. Browser Cache Issue
**Hard refresh** to clear browser cache:
- Windows: `Ctrl+Shift+R`
- Mac: `Cmd+Shift+R`

### 4. Real-time Connection Issue
**In Console**, check:
```javascript
// Check if real-time is working
getPollingStatus?.()
// Should show: realtimeHealthy: true or false
```

If `realtimeHealthy: false`, the app is in polling mode (slower updates)

## Logs You Should See

### Successful Tournament Switch (Men's → Women's):

```
🔄 Tournament changed from kapl-3-mens to kapl-3-womens
🎯 fetchData called for tournament: kapl-3-womens
👥 Fetching players for tournament: kapl-3-womens
✅ Fetched total players from DB: 48
📋 Fetching teams for tournament: kapl-3-womens
✅ Fetched teams: 12 teams for kapl-3-womens
✅ Setting teams from DB: 12 teams
🎯 Fetch complete for tournament: kapl-3-womens players: 24
✅ Player sync complete
✅ Broadcast complete
```

### If You See Errors:

Look for red error messages and share them:
- ❌ Network errors
- ❌ "Row-level security" errors
- ❌ "undefined" errors
- ❌ Query timeouts

## Quick Fixes

| Problem | Fix |
|---------|-----|
| Teams don't switch | Hard refresh: `Ctrl+Shift+R` |
| Old data persists | Clear localStorage in console |
| No teams appear | Check Supabase has teams data |
| Real-time slow | Check internet connection |
| All else fails | Sign out and sign in again |

## What's Being Logged

| Log | Meaning |
|-----|---------|
| `🔄` | Tournament changed |
| `🎯` | Function called |
| `👥` | Fetching players |
| `📋` | Fetching teams |
| `✅` | Success |
| `⚠️` | Warning/fallback |
| `❌` | Error |

---

**Next Steps:**

1. Switch tournaments while watching console
2. Look for logs matching the patterns above
3. Take a screenshot of any red errors
4. Report the log output if it's not working correctly

The logs will help identify exactly where the tournament switch is failing!
