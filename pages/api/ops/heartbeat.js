// pages/api/ops/heartbeat.js
// Heartbeat does ONLY these 4 things (Pitfall 1 fix: VPS is sole executor)

const { createClient } = require('@supabase/supabase-js');
const { evaluateTriggers } = require('../../lib/trigger-evaluator');
const { processReactionQueue } = require('../../lib/reaction-matrix');
const { recoverStaleSteps, recoverOrphanedMissions, getSystemHealth } = require('../../lib/self-healing');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET;

module.exports = async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${HEARTBEAT_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();
  const results = {};

  try {
    // Heartbeat does ONLY 4 things (NO mission-worker here!)
    // 1. Evaluate triggers
    results.triggers = await evaluateTriggers(supabase, 4000);

    // 2. Process reaction queue
    results.reactions = await processReactionQueue(supabase, 3000);

    // 3. Self-healing: recover stale steps
    results.recovery = await recoverStaleSteps(supabase);
    results.orphaned = await recoverOrphanedMissions(supabase);

    // 4. System health check
    results.health = await getSystemHealth(supabase);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      results,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
