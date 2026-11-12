# Debugging: Second Player Gets Stuck in "Adding to Auction"

If you're experiencing an issue where the first player adds successfully but the second player gets stuck, follow this guide.

## Symptoms

- ✅ First player: Dialog opens → Form filled → Submit → "Adding to Auction..." → Success → Dialog closes
- ❌ Second player: Dialog opens → Form filled → Submit → "Adding to Auction..." → **STUCK** (never completes)

## How to Debug

### Step 1: Open Browser Developer Tools

1. Press `F12` or right-click → **Inspect** to open DevTools
2. Go to **Console** tab
3. Clear any existing logs: `console.clear()`

### Step 2: Try Adding Second Player

1. Reload the page (`F12` → **Console** tab)
2. Add first player successfully
3. Try adding second player
4. Watch the **Console** for logs

### Step 3: Check Console Logs

Look for logs like:
```
🟢 addPlayerToAuction called
🔍 Getting Supabase session...
✅ Session valid
🔄 Syncing player to auction and tournament...
✅ Player sync complete
📢 Broadcasting player added event...
✅ Broadcast complete
```

### Step 4: Identify Where It Gets Stuck

- **Stuck after "🟢 addPlayerToAuction called"?**
  → Issue with session validation or immediate error
  
- **Stuck after "✅ Session valid"?**
  → Issue with RPC/direct insert to Supabase
  
- **Stuck after "✅ Player sync complete"?**
  → Issue with broadcast event
  
- **No logs at all?**
  → The button click isn't even triggering

## Common Issues & Solutions

### Issue 1: "Supabase session not active"

**Error:** `Supabase session not active. Please Sign Out and Sign In again to save players to the database.`

**Solution:**
1. Click **Sign Out** button
2. Sign in again with your admin email
3. Try adding players again

### Issue 2: "Player already being added"

**Error:** `Player is already being added. Please wait...` (but second player still shows this after first completes)

**Solution:**
1. This means `isPending('add-player')` is still `true`
2. Hard refresh the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Try adding players again

### Issue 3: Network Error / Timeout

**Error:** In console logs, see network errors or no logs appear for 30+ seconds

**Solution:**
1. Check your internet connection
2. Try adding a simpler player (shorter name, no special characters)
3. If still stuck, open **Network** tab in DevTools:
   - Add player
   - Look for failed requests (red colored)
   - Note the error

### Issue 4: Supabase RLS Policy Blocked

**Error:** `new row violates row-level security policy for table "players"`

**Solution:**
1. You must be logged in as an admin (rohit.doshi2007@gmail.com)
2. Verify you're signed in with the correct email
3. If not, sign out and sign in with admin email

## Advanced Troubleshooting

### Check Request Queue Status

In the **Console**, type:
```javascript
// This will show if there are pending requests
window.__debugPendingRequests?.() 
```

### Force Reset Form

If the form is stuck, in the **Console**:
```javascript
// Reload the page
window.location.reload()
```

### Check Database Directly

If logs show success but player doesn't appear:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run:
```sql
SELECT * FROM public.players 
WHERE name ILIKE '%[partial_name]%' 
ORDER BY created_at DESC 
LIMIT 5;
```

3. If player exists but doesn't show in UI, it might be a tournament filter issue

### Monitor Network Requests

1. Open **Network** tab in DevTools
2. Add player
3. Look for requests to `supabase.co`:
   - Should see multiple POST requests
   - All should return status 200 (green) if successful
   - If any return red (error), note the status code

**Status codes:**
- `200` = Success
- `401` = Unauthorized (need to sign in)
- `403` = Forbidden (not admin)
- `400` = Bad request (invalid data)
- `500` = Server error (contact support)

## Step-by-Step Flow

Here's what SHOULD happen when you add a player:

```
1. Click "+ Add Player to Auction" button
2. Dialog opens
3. Fill form → Click "Add Player to Live Auction"
4. Console shows: 🟢 addPlayerToAuction called
5. Console shows: 🔍 Getting Supabase session...
6. Console shows: ✅ Session valid
7. Player inserted to Supabase (INSERT request in Network tab)
8. Console shows: 🔄 Syncing player to auction...
9. Console shows: ✅ Player sync complete
10. Console shows: 📢 Broadcasting player added event...
11. Console shows: ✅ Broadcast complete
12. Toast shows: "🏏 [Player Name] added to Live Auction pool!"
13. Form clears
14. Dialog closes
15. Player appears in the Auction list
```

If ANY step doesn't complete, note that step number and share it in the error report.

## Getting Help

If you still can't figure it out, provide:

1. **Console logs** (right-click → Save as → save the console output)
2. **Network tab errors** (screenshot of any red requests)
3. **Exact error message** from the toast notification
4. **Steps to reproduce** (which players triggered the issue)

Copy everything from the **Console** and paste it in the error report!

---

**Quick Reset:**
If completely stuck, just hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
