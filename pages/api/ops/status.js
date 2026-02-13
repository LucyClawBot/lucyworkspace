// pages/api/ops/status.js
// Get system status with health metrics

const { createClient } = require('@supabase/supabase-js');
const { getSystemHealth } = require('../../lib/self-healing');
const { getReactionMatrix } = require('../../lib/reaction-matrix');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get counts
    const [
      { count: pendingProposals },
      { count: acceptedProposals },
      { count: runningMissions },
      { count: succeededMissions },
      { count: failedMissions },
      { count: queuedSteps },
      { count: runningSteps },
      { count: failedSteps },
      { count: recentEvents },
    ] = await Promise.all([
      supabase.from('ops_mission_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('ops_mission_proposals').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'succeeded'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('ops_agent_events').select('*', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Get recent missions
    const { data: recentMissions } = await supabase
      .from('ops_missions')
      .select('*, proposal:ops_mission_proposals(agent, action, priority)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get policies
    const { data: policies } = await supabase
      .from('ops_policy')
      .select('key, value');

    // Get health
    const health = await getSystemHealth(supabase);

    // Get reaction matrix
    const matrix = await getReactionMatrix(supabase);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      counts: {
        proposals: {
          pending: pendingProposals || 0,
          accepted: acceptedProposals || 0,
        },
        missions: {
          running: runningMissions || 0,
          succeeded: succeededMissions || 0,
          failed: failedMissions || 0,
        },
        steps: {
          queued: queuedSteps || 0,
          running: runningSteps || 0,
          failed: failedSteps || 0,
        },
        events_24h: recentEvents || 0,
      },
      recent_missions: recentMissions || [],
      policies: policies || [],
      health,
      reaction_matrix: matrix,
    });
  } catch (error) {
    console.error('Status error:', error);
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      counts: {
        proposals: { pending: 0, accepted: 0 },
        missions: { running: 0, succeeded: 0, failed: 0 },
        steps: { queued: 0, running: 0, failed: 0 },
        events_24h: 0,
      },
      recent_missions: [],
      policies: [],
      health: { status: 'unknown' },
      reaction_matrix: { patterns: [] },
      error: error.message,
    });
  }
};
