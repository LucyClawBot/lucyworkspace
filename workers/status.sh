#!/bin/bash
# workers/status.sh
# Check worker status

echo "📊 LucyClawBot Worker Status"
echo "============================"
echo ""

# Check roundtable worker
if pgrep -f "roundtable-worker.mjs" > /dev/null; then
    PID=$(pgrep -f "roundtable-worker.mjs")
    echo "🎭 Roundtable Worker: ✅ Running (PID: $PID)"
    if [ -f ../logs/roundtable.log ]; then
        echo "   Last log: $(tail -1 ../logs/roundtable.log)"
    fi
else
    echo "🎭 Roundtable Worker: ❌ Stopped"
fi

echo ""

# Check mission worker
if pgrep -f "mission-worker.mjs" > /dev/null; then
    PID=$(pgrep -f "mission-worker.mjs")
    echo "🤖 Mission Worker: ✅ Running (PID: $PID)"
    if [ -f ../logs/mission.log ]; then
        echo "   Last log: $(tail -1 ../logs/mission.log)"
    fi
else
    echo "🤖 Mission Worker: ❌ Stopped"
fi

echo ""
echo "📈 System Resources:"
echo "   CPU: $(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')% user"
echo "   Memory: $(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//') pages free"

# Check if we can connect to Supabase
if [ -n "$SUPABASE_URL" ]; then
    echo ""
    echo "🗄️  Supabase: $SUPABASE_URL"
else
    echo ""
    echo "⚠️  SUPABASE_URL not set"
fi