// pages/api/ops/status.js
// Get comprehensive system status

const { createClient } = require('@supabase/supabase-js');
const { getSystemHealth } = require('../../../lib/self-healing.js');
const { getReactionMatrix } = require('../../../lib/reaction-matrix.js');

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
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'succeeded'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('ops_agent_events').select('*', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Get recent missions with proposals
    const { data: recentMissions } = await supabase
      .from('ops_missions')
      .select(`
        *,
        proposal:ops_mission_proposals(agent_id, title, status)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent events
    const { data: recentEventsList } = await supabase
      .from('ops_agent_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get policies
    const { data: policies } = await supabase
      .from('ops_policy')
      .select('key, value');

    // Get agent stats
    const { data: agents } = await supabase
      .from('ops_agents')
      .select('id, display_name, role, is_active');

    // Get memory stats
    const { data: memoryStats } = await supabase
      .from('ops_agent_memory')
      .select('agent_id, type, confidence');

    // Get relationship stats
    const { data: relationships } = await supabase
      .from('ops_agent_relationships')
      .select('*');

    // Get conversation stats
    const { count: totalConversations } = await supabase
      .from('ops_conversations')
      .select('*', { count: 'exact', head: true });

    const { count: completedConversations } = await supabase
      .from('ops_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

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
        conversations: {
          total: totalConversations || 0,
          completed: completedConversations || 0,
        },
      },
      agents: agents || [],
      memory_summary: memoryStats ? {
        total: memoryStats.length,
        by_type: memoryStats.reduce((acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1;
          return acc;
        }, {}),
        avg_confidence: memoryStats.length > 0 
          ? memoryStats.reduce((sum, m) => sum + (m.confidence || 0), 0) / memoryStats.length 
          : 0,
      } : { total: 0, by_type: {}, avg_confidence: 0 },
      relationships: relationships || [],
      recent_missions: recentMissions || [],
      recent_events: recentEventsList || [],
      policies: policies || [],
      health,
      reaction_matrix: matrix,
    });
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};