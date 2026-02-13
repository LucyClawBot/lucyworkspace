# BOOT.md - Startup Checklist

Runs automatically when gateway restarts.

## Pre-Flight Checks

### 1. Environment
```bash
echo "SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "WORKER_ID: $WORKER_ID"
echo "Node version: $(node --version)"
```

### 2. Git Status
- [ ] Branch: main
- [ ] No uncommitted changes
- [ ] Remote: origin accessible

### 3. Workers Status
- [ ] Run: `./workers/status.sh`
- [ ] If stopped: `./workers/start-workers.sh`

### 4. Database Connection
- [ ] Test Supabase connection
- [ ] Verify tables exist
- [ ] Check migrations applied

### 5. Crash Recovery
- [ ] Read: `memory/active-tasks.md`
- [ ] Resume any interrupted tasks
- [ ] Update task statuses

## Startup Complete

Log: `memory/boot-log.md` with timestamp and status.