// lib/self-healing.js
// Self-healing: Systems will get stuck. VPS restarts, network blips, API timeouts.
// Steps get stuck in "running" status with nobody actually processing them.

const { maybeFinalizeMission } = require('./proposal-service');

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

async function recoverStaleSteps(supabase) {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  // Find steps that have been "running" too long
  const { data: staleSteps, error } = await supabase
    .from('ops_mission_steps')
    .select('id, mission_id, kind, worker, reserved_at, params')
    .eq('status', 'running')
    .lt('reserved_at', staleTime);

  if (error) {
    console.error('Error finding stale steps:', error);
    return { recovered: 0, error: error.message };
  }

  const recovered = [];

  for (const step of staleSteps || []) {
    // Mark as failed
    const { error: updateError } = await supabase
      .from('ops_mission_steps')
      .update({
        status: 'failed',
        last_error: `Stale: no progress for 30 minutes. Worker: ${step.worker || 'unknown'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id);

    if (updateError) {
      console.error(`Failed to mark step ${step.id} as failed:`, updateError);
      continue;
    }

    // Record the failure
    await supabase.from('ops_action_runs').insert({
      step_id: step.id,
      error: `Stale recovery: Step was running for >30 minutes without progress`,
      started_at: step.reserved_at,
      completed_at: new Date().toISOString(),
    });

    // Emit event for trigger processing
    await supabase.from('ops_agent_events').insert({
      source: 'system',
      type: 'step_stale_recovered',
      data: {
        step_id: step.id,
        mission_id: step.mission_id,
        kind: step.kind,
        worker: step.worker,
      },
    });

    // Finalize mission if all steps done
    await maybeFinalizeMission(supabase, step.mission_id);

    recovered.push({
      step_id: step.id,
      mission_id: step.mission_id,
      kind: step.kind,
      worker: step.worker,
    });
  }

  return { recovered: recovered.length, items: recovered };
}

// Also check for orphaned missions (missions with no steps or all stuck)
async function recoverOrphanedMissions(supabase) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Find missions with no steps
  const { data: emptyMissions } = await supabase
    .from('ops_missions')
    .select('id')
    .eq('status', 'running')
    .lt('created_at', oneHourAgo)
    .not('ops_mission_steps', 'cs', '{*}'); // No steps

  // Find missions where all steps are stuck
  const { data: stuckMissions } = await supabase
    .from('ops_missions')
    .select('id, steps:ops_mission_steps(id, status)')
    .eq('status', 'running')
    .lt('updated_at', oneHourAgo);

  const recovered = [];

  // Handle empty missions
  for (const mission of emptyMissions || []) {
    await supabase
      .from('ops_missions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', mission.id);

    recovered.push({ mission_id: mission.id, reason: 'no_steps' });
  }

  // Handle stuck missions (all steps queued/running but stale)
  for (const mission of stuckMissions || []) {
    const steps = mission.steps || [];
    const hasProgress = steps.some(s => s.status === 'succeeded' || s.status === 'failed');
    const allStuck = steps.every(s => 
      s.status === 'queued' || s.status === 'running'
    );

    if (steps.length > 0 && !hasProgress && allStuck) {
      // Mark all queued steps as failed
      await supabase
        .from('ops_mission_steps')
        .update({ status: 'failed', last_error: 'Mission orphaned: no worker claimed steps' })
        .eq('mission_id', mission.id)
        .in('status', ['queued', 'running']);

      // Mark mission as failed
      await supabase
        .from('ops_missions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', mission.id);

      recovered.push({ mission_id: mission.id, reason: 'all_steps_stuck' });
    }
  }

  return { recovered: recovered.length, items: recovered };
}

// System health check
async function getSystemHealth(supabase) {
  const [
    { count: pendingProposals },
    { count: runningMissions },
    { count: queuedSteps },
    { count: runningSteps },
    { count: failedSteps },
    { count: staleSteps },
  ] = await Promise.all([
    supabase.from('ops_mission_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'running').lt('reserved_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
  ]);

  const health = {
    timestamp: new Date().toISOString(),
    queue_depth: (queuedSteps || 0) + (pendingProposals || 0),
    active_work: {
      running_missions: runningMissions || 0,
      running_steps: runningSteps || 0,
    },
    issues: {
      failed_steps: failedSteps || 0,
      stale_steps: staleSteps || 0,
    },
    status: 'healthy',
  };

  // Determine overall status
  if ((failedSteps || 0) > 10 || (staleSteps || 0) > 5) {
    health.status = 'degraded';
  }
  if ((staleSteps || 0) > 10) {
    health.status = 'critical';
  }

  return health;
}

module.exports = {
  recoverStaleSteps,
  recoverOrphanedMissions,
  getSystemHealth,
  STALE_THRESHOLD_MS,
};
