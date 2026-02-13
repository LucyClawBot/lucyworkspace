# AGENTS.md - LucyClawBot Operations

## Core Rules

### 1. Definition of Done
Every task marked "done" MUST include:
- Repo name: lucyworkspace
- Branch: main  
- Commit hash: (actual hash)
- Verification command output showing it works

### 2. Verification Required
Before claiming completion:
- Run `npm run build` - must pass with 0 errors
- Run `vercel --prod` - must deploy successfully
- Check `/api/ops/status` - must return 200 with valid JSON
- Verify no secrets in committed code

### 3. No Silent Failures
If a command fails:
- Log the exact error
- Explain what was attempted
- Propose next steps
- Never say "it should work"

### 4. Subagent Rules
- Lucy (main) can spawn subagents for isolated tasks
- Subagents cannot spawn other subagents (prevent exponential token burn)
- Subagents report back with: task, result, files changed, verification
- Cleanup: delete subagent sessions after completion

### 5. Security
- Never commit API keys, tokens, or secrets
- Use .env files for local development
- Check for secrets before every commit with: `git diff --cached | grep -E '(key|token|secret|password)'`
- SUPABASE_SERVICE_KEY must never appear in logs or commits

### 6. Model Selection
Use appropriate models per task:
- Complex reasoning/architecture: opus
- Code generation: sonnet  
- Quick operational tasks: haiku
- Subagents: haiku (cheap, fast)

### 7. External Communication
- Lucy handles all external-facing work
- Other agents (coordinator, scout, etc.) stay internal
- Telegram/Discord messages only from Lucy persona

### 8. State Management
- Write active tasks to `memory/active-tasks.md`
- Update on: task start, subagent spawn, completion, failure
- Boot.md reads this file on restart for crash recovery

### 9. Token Efficiency
- Keep HEARTBEAT.md under 20 lines
- Prune context every 30 minutes
- Flush memory to disk before compression
- Split large MEMORY.md into focused files under memory/

### 10. Debugging First Step
When something breaks:
1. Check `gateway.err.log`
2. Run `openclaw doctor --fix`
3. Verify environment variables
4. Only then attempt fixes

## Agent Hierarchy

```
Lucy (CEO) - External comms, orchestration
├── Coordinator (Boss) - Project management
├── Scout (Analyst) - Data & research  
├── Quill (Writer) - Content creation
├── Sage (Strategist) - Long-term planning
├── Observer (QA) - Quality control
└── Xalt (Wildcard) - Social media & experiments
```

## Prohibited Actions

- Never run `rm -rf` on running dev server directories
- Never spawn subagent chains (subagent spawning subagent)
- Never commit without verifying build passes
- Never ignore errors in logs

## Success Metrics

- Build passes: ✅
- Deploy succeeds: ✅  
- No secrets leaked: ✅
- Status endpoint returns 200: ✅
- Workers running: 2/2 ✅