#!/bin/bash
# workers/stop-workers.sh
# Stop all workers

cd "$(dirname "$0")"

echo "🛑 Stopping LucyClawBot workers..."

# Stop roundtable worker
if [ -f ../logs/roundtable.pid ]; then
    PID=$(cat ../logs/roundtable.pid)
    if kill $PID 2>/dev/null; then
        echo "   ✓ Roundtable worker stopped"
    else
        echo "   ⚠️ Roundtable worker not running"
    fi
    rm -f ../logs/roundtable.pid
fi

# Stop mission worker
if [ -f ../logs/mission.pid ]; then
    PID=$(cat ../logs/mission.pid)
    if kill $PID 2>/dev/null; then
        echo "   ✓ Mission worker stopped"
    else
        echo "   ⚠️ Mission worker not running"
    fi
    rm -f ../logs/mission.pid
fi

# Kill any remaining node processes for our workers
pkill -f "roundtable-worker.mjs" 2>/dev/null
pkill -f "mission-worker.mjs" 2>/dev/null

echo ""
echo "✅ All workers stopped"