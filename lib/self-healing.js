// lib/self-healing.js
// Self-healing: Systems will get stuck. VPS restarts, network blips, API timeouts.
// Steps get stuck in "running" status with nobody actually processing them.

const { maybeFinalizeMission } = require('./proposal-service.js');

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
      agent_id: 'system',
      kind: 'step_stale_recovered',
      title: 'Stale step recovered',
      summary: `Step ${step.id} marked as failed after 30 min timeout`,
      tags: ['recovery', 'stale', step.kind],
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
  const recovered = [];

  // Find missions with no steps
  const { data: emptyMissions, error: emptyError } = await supabase
    .from('ops_missions')
    .select('id')
    .eq('status', 'approved')
    .lt('created_at', oneHourAgo);

  if (emptyError) {
    console.error('Error finding empty missions:', emptyError);
  }

  // Handle empty missions
  for (const mission of emptyMissions || []) {
    // Check if actually has no steps
    const { count } = await supabase
      .from('ops_mission_steps')
      .select('*', { count: 'exact', head: true })
      .eq('mission_id', mission.id);

    if (count === 0) {
      await supabase
        .from('ops_missions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', mission.id);

      recovered.push({ mission_id: mission.id, reason: 'no_steps' });

      await supabase.from('ops_agent_events').insert({
        agent_id: 'system',
        kind: 'mission_orphaned',
        title: 'Orphaned mission recovered',
        summary: `Mission ${mission.id} had no steps after 1 hour`,
        tags: ['recovery', 'orphaned'],
      });
    }
  }

  // Find missions where all steps are queued (never claimed)
  const { data: unclaimedMissions, error: unclaimedError } = await supabase
    .from('ops_missions')
    .select('id')
    .eq('status', 'approved')
    .lt('created_at', oneHourAgo);

  if (unclaimedError) {
    console.error('Error finding unclaimed missions:', unclaimedError);
  }

  for (const mission of unclaimedMissions || []) {
    const { data: steps } = await supabase
      .from('ops_mission_steps')
      .select('id, status')
      .eq('mission_id', mission.id);

    if (steps && steps.length > 0) {
      const allQueued = steps.every(s => s.status === 'queued');
      
      if (allQueued) {
        // Mark all steps as failed
        await supabase
          .from('ops_mission_steps')
          .update({ 
            status: 'failed', 
            last_error: 'Mission orphaned: no worker claimed steps after 1 hour' 
          })
          .eq('mission_id', mission.id);

        // Mark mission as failed
        await supabase
          .from('ops_missions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', mission.id);

        recovered.push({ mission_id: mission.id, reason: 'unclaimed_steps' });

        await supabase.from('ops_agent_events').insert({
          agent_id: 'system',
          kind: 'mission_orphaned',
          title: 'Unclaimed mission recovered',
          summary: `Mission ${mission.id} had unclaimed steps after 1 hour`,
          tags: ['recovery', 'unclaimed'],
        });
      }
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
  ] = await Promise.all([
    supabase.from('ops_mission_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('ops_missions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  // Count stale steps
  const staleTime = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const { count: staleSteps } = await supabase
    .from('ops_mission_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running')
    .lt('reserved_at', staleTime);

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