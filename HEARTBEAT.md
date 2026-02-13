# HEARTBEAT.md

Quick system health check - runs every 30 minutes.

## Checklist

1. **Workers Running?**
   - Run: `./workers/status.sh`
   - Expected: 2/2 running
   - If not: restart with `./workers/start-workers.sh`

2. **Website Responsive?**
   - Check: https://lucyworkspace.vercel.app
   - Expected: 200 OK
   - If not: check Vercel dashboard

3. **Supabase Connected?**
   - Check: `/api/ops/status` returns data
   - Expected: JSON with agents array
   - If not: verify env vars

4. **Pending Tasks?**
   - Read: `memory/active-tasks.md`
   - Alert if any tasks blocked > 1 hour

5. **Token Usage?**
   - Review: OpenClaw session costs
   - Alert if > $5/day unexpectedly

## Actions

If all checks pass: HEARTBEAT_OK

If issues found:
1. Log to `memory/heartbeat-issues.md`
2. Attempt auto-fix
3. Alert user if unresolvable