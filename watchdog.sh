#!/bin/bash
# watchdog.sh - Monitor system health and auto-restart if needed

LOG_FILE="./logs/watchdog.log"
PID_FILE="./logs/watchdog.pid"

# Write PID
echo $$ > "$PID_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🔍 Watchdog starting..."

while true; do
    # Check if workers are running
    if ! pgrep -f "roundtable-worker.mjs" > /dev/null; then
        log "⚠️ Roundtable worker not running, restarting..."
        cd workers && ./start-workers.sh >> "$LOG_FILE" 2>&1
        log "✅ Workers restarted"
    fi
    
    # Check website health
    if ! curl -sf https://lucyworkspace.vercel.app > /dev/null; then
        log "⚠️ Website not responding"
        # Alert but don't auto-deploy (manual verification needed)
    fi
    
    # Check gateway health (if OpenClaw gateway running locally)
    if command -v openclaw &> /dev/null; then
        if ! openclaw status > /dev/null 2>&1; then
            log "⚠️ OpenClaw gateway not responding"
            openclaw gateway restart >> "$LOG_FILE" 2>&1
            log "✅ Gateway restarted"
        fi
    fi
    
    # Log heartbeat
    log "💓 Watchdog check complete"
    
    # Sleep 15 minutes
    sleep 900
done