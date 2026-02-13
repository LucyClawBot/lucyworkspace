// pages/api/ops/heartbeat.js
// The system's pulse - fires every 5 minutes

const { createClient } = require('@supabase/supabase-js');
const { evaluateTriggers } = require('../../../lib/trigger-evaluator.js');
const { processReactionQueue } = require('../../../lib/reaction-matrix.js');
const { recoverStaleSteps, recoverOrphanedMissions, getSystemHealth } = require('../../../lib/self-healing.js');
const { processScheduledConversations, processConversationQueue } = require('../../../lib/roundtable.js');
const { learnFromOutcomes } = require('../../../lib/memory-system.js');
const { runAutoLearning } = require('../../../lib/auto-learn.js');

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
    // 1. Evaluate triggers (conditions met?)
    try {
      results.triggers = await evaluateTriggers(supabase, 4000);
    } catch (err) {
      console.error('Trigger evaluation error:', err);
      results.triggers = { error: err.message };
    }

    // 2. Process reaction queue (agent interactions)
    try {
      results.reactions = await processReactionQueue(supabase, 3000);
    } catch (err) {
      console.error('Reaction queue error:', err);
      results.reactions = { error: err.message };
    }

    // 3. Process scheduled conversations
    try {
      results.conversations_scheduled = await processScheduledConversations(supabase);
    } catch (err) {
      console.error('Conversation scheduling error:', err);
      results.conversations_scheduled = { error: err.message };
    }

    // 4. Process conversation queue
    try {
      results.conversations_run = await processConversationQueue(supabase, 1);
    } catch (err) {
      console.error('Conversation run error:', err);
      results.conversations_run = { error: err.message };
    }

    // 5. Learn from outcomes (tweet performance, etc.)
    try {
      results.learning = await learnFromOutcomes(supabase);
    } catch (err) {
      console.error('Learning error:', err);
      results.learning = { error: err.message };
    }

    // 6. Self-healing: recover stale steps
    try {
      results.stale_recovery = await recoverStaleSteps(supabase);
    } catch (err) {
      console.error('Stale recovery error:', err);
      results.stale_recovery = { error: err.message };
    }

    // 7. Self-healing: recover orphaned missions
    try {
      results.orphaned_recovery = await recoverOrphanedMissions(supabase);
    } catch (err) {
      console.error('Orphaned recovery error:', err);
      results.orphaned_recovery = { error: err.message };
    }

    // 8. System health check
    try {
      results.health = await getSystemHealth(supabase);
    } catch (err) {
      console.error('Health check error:', err);
      results.health = { error: err.message };
    }

    // 9. Auto-learning (when idle)
    try {
      results.auto_learning = await runAutoLearning(supabase);
    } catch (err) {
      console.error('Auto-learning error:', err);
      results.auto_learning = { error: err.message };
    }

    // Record heartbeat run
    await supabase.from('ops_action_runs').insert({
      action: 'heartbeat',
      output: {
        duration_ms: Date.now() - startTime,
        results: {
          triggers_triggered: results.triggers?.triggered || 0,
          reactions_processed: results.reactions?.processed || 0,
          conversations_scheduled: results.conversations_scheduled?.created || 0,
          conversations_run: results.conversations_run?.processed || 0,
          memories_learned: results.learning?.learned || 0,
          stale_recovered: results.stale_recovery?.recovered || 0,
        }
      },
      completed_at: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      results,
    });
  } catch (error) {
    console.error('Heartbeat fatal error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};