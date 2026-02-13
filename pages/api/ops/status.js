// pages/api/ops/status.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const [
      { count: pendingProposals },
      { count: runningMissions },
      { count: queuedSteps },
      { count: failedSteps },
      { count: recentEvents }
    ] = await Promise.all([
      supabase.from('ops_mission_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('ops_agent_events').select('*', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ]);

    const { data: recentMissions } = await supabase.from('ops_missions')
      .select('*, proposal:ops_mission_proposals(agent, action)')
      .order('created_at', { ascending: false })
      .limit(5);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      counts: {
        pending_proposals: pendingProposals || 0,
        running_missions: runningMissions || 0,
        queued_steps: queuedSteps || 0,
        failed_steps: failedSteps || 0,
        events_24h: recentEvents || 0
      },
      recent_missions: recentMissions || []
    });
  } catch (error) {
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      counts: { pending_proposals: 0, running_missions: 0, queued_steps: 0, failed_steps: 0, events_24h: 0 },
      recent_missions: [],
      note: 'Supabase not configured yet'
    });
  }
}
