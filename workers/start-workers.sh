#!/bin/bash
# workers/start-workers.sh
# Start all workers on Lucy MacBook

cd "$(dirname "$0")"

export SUPABASE_URL="https://ddszgovshrmpaavmrkpo.supabase.co"
export SUPABASE_SERVICE_KEY="${SUPABASE_KEY:-sb_secret_yYWdxSiMEL9FQiRaeGz_ag_5zCBM-Sw}"
export WORKER_ID="lucy-macbook"

echo "🚀 Starting LucyClawBot workers..."
echo "   Worker ID: $WORKER_ID"
echo "   Supabase: $SUPABASE_URL"
echo ""

# Check if already running
if pgrep -f "roundtable-worker.mjs" > /dev/null; then
    echo "⚠️  Roundtable worker already running"
else
    echo "🎭 Starting roundtable worker..."
    nohup node roundtable-worker.mjs > ../logs/roundtable.log 2>&1 &
    echo $! > ../logs/roundtable.pid
fi

if pgrep -f "mission-worker.mjs" > /dev/null; then
    echo "⚠️  Mission worker already running"
else
    echo "🤖 Starting mission worker..."
    nohup node mission-worker.mjs > ../logs/mission.log 2>&1 &
    echo $! > ../logs/mission.pid
fi

echo ""
echo "✅ Workers started!"
echo "   Logs: ./logs/"
echo "   Stop: ./stop-workers.sh"