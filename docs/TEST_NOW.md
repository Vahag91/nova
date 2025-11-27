# 🚀 TEST NOW - Quick Start Guide

**Time Required:** 10-15 minutes  
**Prerequisites:** App running on simulator or device

---

## ✅ STEP 1: Start the App (2 min)

```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Run iOS
npm run ios
# OR Android
npm run android
```

**✅ Logs are now enabled!** (Already done - check Chat.js and streamChat.js)

---

## ✅ STEP 2: Open Debug Console (1 min)

### iOS Simulator:
1. Press `Cmd + D`
2. Tap "Debug"
3. Chrome DevTools opens → Go to Console tab

### Android:
1. Shake device
2. Tap "Debug"
3. Chrome DevTools opens → Go to Console tab

### OR Just Watch Metro Bundler:
All logs appear in the terminal where you ran `npm start`

---

## ✅ STEP 3: Test Success Path (2 min)

**Action:**
1. Open chat
2. Send message: `"Hello, how are you?"`
3. Wait for response

**Expected Logs:**
```
[SSE] open
[CHAT] ✅ onDone fired - message complete
```

**Expected UI:**
- ✅ Response appears
- ✅ No error message
- ✅ Message saved

**✅ PASS if:** Message completes normally

---

## ✅ STEP 4: Test User Abort (1 min)

**Action:**
1. Send long message: `"Write me a very long essay about space"`
2. After 1-2 seconds, tap "Stop" button
3. Observe logs

**Expected Logs:**
```
[SSE] open
[SSE] client aborted
```

**Expected UI:**
- ✅ Streaming stops
- ✅ NO error message shown
- ✅ Partial text remains visible
- ✅ NO `onDone` log
- ✅ NO `onError` log

**✅ PASS if:** Clean stop, no errors shown

---

## ✅ STEP 5: Test Network Error (2 min)

**Action:**

**iOS Simulator:**
1. Start sending: `"Write me a long story"`
2. After 1 second, enable Airplane mode (or disconnect WiFi)
3. Wait 5 seconds
4. Observe logs

**Expected Logs:**
```
[SSE] open
[SSE] network error
[CHAT] ❌ onError fired: NETWORK Network connection failed
```

**Expected UI:**
- ✅ Error message shown
- ✅ NO `onDone` log
- ✅ NO retry logs
- ✅ Partial text visible

**✅ PASS if:** Error shown, NO retries

---

## ✅ STEP 6: Test No Auto-Retry (CRITICAL - 3 min)

**This is the MOST IMPORTANT test!**

**Setup:**
We need to force an error to verify no retries. Two options:

### Option A: Simulate 500 Error (Easiest)

**Temporary code change** in `src/lib/SSEClient.js` line 108:

```javascript
// Find this line:
const ok = xhr.status >= 200 && xhr.status < 300;

// Replace with:
const ok = false; // Force error for testing
const forceStatus = 500;
```

Then in line 113-120:
```javascript
if (ok) {
  this._terminate('complete', xhr.status, false);
} else {
  this._terminate('http_error', forceStatus, true);
  this._scheduleRetry('http_error');
}
```

**Action:**
1. Make the above change
2. Reload app (`Cmd+R`)
3. Send any message: `"Test"`
4. Watch logs for 10 seconds

**Expected Logs:**
```
[SSE] open
[SSE] HTTP error
[CHAT] ❌ onError fired: 500 HTTP error 500
[SSE] retry skipped - retries disabled by policy
```

**CRITICAL - Must NOT see:**
```
❌ BAD: [SSE] retry in 1500ms
❌ BAD: [SSE] retry in 3000ms
❌ BAD: Multiple error logs
```

**✅ PASS if:** 
- Only ONE error log
- Message "retry skipped - retries disabled by policy"
- NO "retry in X ms" logs
- NO duplicate API calls

**⚠️ IMPORTANT:** Remove the test code after!

---

### Option B: Use Your Backend (Alternative)

If you control the backend proxy:

1. Add test header handling in your proxy:
```javascript
// In your backend
if (req.headers['x-force-error'] === '500') {
  return res.status(500).json({ error: 'Test error' });
}
```

2. In `streamChat.js`, temporarily add:
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-client-id': deviceId,
  'x-force-error': '500',  // ADD THIS
  // ...
}
```

3. Send message and verify no retries

---

## ✅ STEP 7: Test Timeout (Optional - 3 min)

**Setup:**
Edit `src/api/streamChat.js` line 141:

```javascript
// BEFORE
timeoutMs: 60000,

// AFTER (for testing only)
timeoutMs: 3000,  // 3 seconds
```

**Action:**
1. Save file, reload app
2. Send: `"Write me a very detailed essay"`
3. Wait 3 seconds

**Expected Logs:**
```
[SSE] open
(after 3 seconds)
[SSE] timeout
[CHAT] ❌ onError fired: TIMEOUT Request timed out
[SSE] retry skipped - retries disabled by policy
```

**✅ PASS if:** Timeout fires, NO retries

**⚠️ RESTORE:** Change back to `timeoutMs: 60000`

---

## ✅ STEP 8: Test App Backgrounding (2 min)

**Important:** iOS/Android will **kill network connections** when backgrounded. This is normal OS behavior.

**Action:**
1. Send message: `"Write me a long story"`
2. Wait 1-2 seconds for streaming to start
3. **Swipe up and minimize app** (don't close completely)
4. **Wait 3-5 seconds** (OS will terminate connection)
5. **Return to app**

**Expected Logs:**
```
[CHAT] 📱 App backgrounded - streaming will continue until OS terminates it
[SSE] terminate: http_error 0
[CHAT] ❌ onError fired: 0 HTTP error 0
[CHAT] 💾 Saving partial on error: Once upon...
[CHAT] 🔕 Error silenced - was backgrounded, OS killed connection
```

**Expected UI:**
- ✅ Partial content saved and visible
- ✅ **NO error banner shown** (silenced because backgrounded)
- ✅ Clean UI state (Send button, not Stop)

**✅ PASS if:** 
- Partial content visible
- NO error message shown to user
- Log shows "Error silenced"

---

## 📊 ACCEPTANCE CHECKLIST

After running all tests:

- [ ] ✅ Success path works (message completes)
- [ ] ✅ User abort works (clean stop, no errors)
- [ ] ✅ Network error shows error, NO retries
- [ ] ✅ HTTP 500 shows error, NO retries (CRITICAL)
- [ ] ✅ Timeout shows error, NO retries
- [ ] ✅ App backgrounding: OS termination handled gracefully (error silenced, partial saved)
- [ ] ✅ NO "retry in X ms" logs ever appear
- [ ] ✅ `onDone` only fires on success
- [ ] ✅ `onDone` never fires after errors
- [ ] ✅ NO duplicate API calls (check network tab)

---

## ❌ IF TESTS FAIL

### If you see retries:
```bash
# Check these files:
git diff src/lib/SSEClient.js
git diff src/api/streamChat.js

# Verify retryPolicy is set:
grep -n "retryPolicy" src/api/streamChat.js
# Should show: retryPolicy: 'none',
```

### If onDone fires after error:
```javascript
// Add breakpoint in streamChat.js:
const finishIfAppropriate = (source) => {
  console.log('DEBUG:', { source, errorOccurred, closeInfo, doneEventSeen });
  debugger; // <-- Add this
  if (errorOccurred) {
    return;
  }
  // ...
}
```

### If multiple onDone calls:
```javascript
// Check safeOnDone in streamChat.js:
const safeOnDone = () => {
  console.log('safeOnDone called, doneCalled=', doneCalled);
  if (!doneCalled) {
    doneCalled = true;
    onDone?.();
  }
};
```

---

## 🎯 QUICK VISUAL CHECKLIST

**✅ GOOD - Success:**
```
User sends message
↓
[SSE] open
↓
Tokens stream in
↓
[CHAT] ✅ onDone fired
↓
Message saved ✅
```

**✅ GOOD - Error (No Retry):**
```
User sends message
↓
[SSE] open
↓
Error occurs
↓
[CHAT] ❌ onError fired
↓
[SSE] retry skipped ✅
↓
Error shown to user
```

**❌ BAD - Auto Retry (Old Bug):**
```
User sends message
↓
[SSE] open
↓
Error occurs
↓
[CHAT] ❌ onError fired
↓
[SSE] retry in 1500ms ❌ SHOULD NOT HAPPEN
↓
[SSE] retry in 3000ms ❌ SHOULD NOT HAPPEN
↓
Multiple errors ❌
```

---

## 🚀 AFTER TESTING

### If All Tests Pass:
1. ✅ Remove any temporary test code
2. ✅ Restore original timeout values
3. ✅ Optionally disable debug logs (set `log: false`)
4. ✅ Commit changes:
```bash
git add src/lib/SSEClient.js src/api/streamChat.js src/screens/Chat.js
git commit -m "Fix: Implement streaming state machine with retry policy

- Add retryPolicy option ('none', 'network-only', 'always')
- Add _finished flag to prevent duplicate terminal callbacks
- Add _terminate() method for centralized cleanup
- Fix onClose to fire on ALL terminal paths
- Prevent onDone from firing after errors
- Disable auto-retry for chat (prevents duplicate generations)
- Fix inactivity timeout memory leak
- Add proper error state tracking in streamChat

Fixes: #[issue-number] (if applicable)
"
```

### If Tests Fail:
1. 🔍 Note which test failed
2. 📸 Take screenshot of logs
3. 📋 Check TESTING_GUIDE.md for debugging steps
4. 🐛 Add breakpoints as shown above
5. 💬 Report back with findings

---

## 📞 NEED HELP?

Check these files for more details:
- `TESTING_GUIDE.md` - Full test scenarios
- `STREAMING_FIX_REVIEW.md` - Implementation details
- `src/utils/testStreamHelper.js` - Test utilities

---

**Good luck! 🚀**

**Estimated time to complete:** 10-15 minutes

