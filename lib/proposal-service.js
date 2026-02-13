// lib/proposal-service.js — CommonJS version
const { createClient } = require('@supabase/supabase-js');

// CAP GATES: Check quotas BEFORE creating proposals
const STEP_KIND_GATES = {
  post_tweet: checkPostTweetGate,
  write_content: checkWriteContentGate,
  deploy: checkDeployGate,
  analyze: checkAnalyzeGate,
  crawl: checkCrawlGate,
  draft_tweet: checkDraftTweetGate,
};

async function checkPostTweetGate(supabase) {
  const quota = await getPolicy(supabase, 'x_daily_quota', { limit: 8 });
  const limit = Number(quota?.limit ?? 8);
  
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('ops_action_runs')
    .select('id', { count: 'exact', head: true })
    .eq('output->>action', 'post_tweet')
    .gte('completed_at', today);

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Quota full (${count}/${limit})` };
  }
  return { ok: true };
}

async function checkWriteContentGate(supabase) {
  const policy = await getPolicy(supabase, 'content_quota', { daily_limit: 5 });
  const limit = Number(policy?.daily_limit ?? 5);
  
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('ops_action_runs')
    .select('id', { count: 'exact', head: true })
    .eq('output->>action', 'write_content')
    .gte('completed_at', today);

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Daily content quota reached (${count}/${limit})` };
  }
  return { ok: true };
}

async function checkDeployGate(supabase) {
  const policy = await getPolicy(supabase, 'deploy_policy', { enabled: true });
  if (policy?.enabled === false) {
    return { ok: false, reason: 'Deploys disabled by policy' };
  }
  return { ok: true };
}

async function checkAnalyzeGate() {
  return { ok: true };
}

async function checkCrawlGate(supabase) {
  const policy = await getPolicy(supabase, 'crawl_quota', { hourly_limit: 20 });
  const limit = Number(policy?.hourly_limit ?? 20);
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('ops_action_runs')
    .select('id', { count: 'exact', head: true })
    .eq('output->>action', 'crawl')
    .gte('completed_at', oneHourAgo);

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Hourly crawl quota reached (${count}/${limit})` };
  }
  return { ok: true };
}

async function checkDraftTweetGate(supabase) {
  const policy = await getPolicy(supabase, 'draft_quota', { daily_limit: 20 });
  const limit = Number(policy?.daily_limit ?? 20);
  
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('ops_action_runs')
    .select('id', { count: 'exact', head: true })
    .eq('output->>action', 'draft_tweet')
    .gte('completed_at', today);

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Daily draft quota reached (${count}/${limit})` };
  }
  return { ok: true };
}

async function getPolicy(supabase, key, defaultValue) {
  const { data } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? defaultValue;
}

// SINGLE ENTRY POINT for all proposals
async function createProposalAndMaybeAutoApprove(supabase, input) {
  const { source, agent, action, params = {}, priority = 'normal' } = input;
  
  // 1. Check daily limit per agent
  const today = new Date().toISOString().split('T')[0];
  const { count: dailyCount } = await supabase
    .from('ops_mission_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent)
    .gte('created_at', today);

  const limits = await getPolicy(supabase, 'agent_daily_limits', { default: 50 });
  const agentLimit = limits?.[agent] ?? limits?.default ?? 50;
  
  if ((dailyCount ?? 0) >= agentLimit) {
    const rejection = {
      source,
      agent_id: agent,
      title: `${action} proposal`,
      status: 'rejected',
      rejection_reason: `Daily proposal limit reached for ${agent}`
    };
    await supabase.from('ops_mission_proposals').insert(rejection);
    await supabase.from('ops_agent_events').insert({
      agent_id: 'system',
      kind: 'proposal_rejected',
      title: 'Proposal rejected',
      summary: `Agent ${agent} hit daily limit`,
      tags: ['limit', 'rejected']
    });
    return { proposal: null, rejected: true, reason: rejection.rejection_reason };
  }

  // 2. Check Cap Gates (block at entry point!)
  const gate = STEP_KIND_GATES[action];
  if (gate) {
    const gateResult = await gate(supabase);
    if (!gateResult.ok) {
      const rejection = {
        source,
        agent_id: agent,
        title: `${action} proposal`,
        status: 'rejected',
        rejection_reason: gateResult.reason
      };
      await supabase.from('ops_mission_proposals').insert(rejection);
      await supabase.from('ops_agent_events').insert({
        agent_id: 'system',
        kind: 'proposal_rejected',
        title: 'Proposal rejected',
        summary: gateResult.reason,
        tags: ['gate', 'rejected']
      });
      return { proposal: null, rejected: true, reason: gateResult.reason };
    }
  }

  // 3. Check auto-approve policy
  const autoApprovePolicy = await getPolicy(supabase, 'auto_approve', {
    enabled: true,
    allowed_step_kinds: ['draft_tweet', 'crawl', 'analyze', 'write_content'],
    allowed_agents: ['scout', 'sage', 'quill', 'observer', 'coordinator']
  });

  const canAutoApprove = autoApprovePolicy?.enabled !== false &&
    autoApprovePolicy?.allowed_step_kinds?.includes(action) &&
    autoApprovePolicy?.allowed_agents?.includes(agent);

  // 4. Insert proposal
  const { data: proposal, error } = await supabase
    .from('ops_mission_proposals')
    .insert({
      source,
      agent_id: agent,
      title: `${action} proposal from ${agent}`,
      proposed_steps: generateStepsForAction(action, params),
      status: canAutoApprove ? 'accepted' : 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // 5. Fire event
  await supabase.from('ops_agent_events').insert({
    agent_id: 'system',
    kind: 'proposal_created',
    title: 'New proposal',
    summary: `${agent} proposed: ${action}`,
    tags: ['proposal', canAutoApprove ? 'auto_approved' : 'pending']
  });

  // 6. If auto-approved, create mission
  if (canAutoApprove) {
    await createMissionFromProposal(supabase, proposal);
  }

  return { proposal, rejected: false, auto_approved: canAutoApprove };
}

function generateStepsForAction(action, params) {
  const stepMap = {
    analyze_viral_content: [
      { kind: 'crawl', params: { target: 'engagement_data', ...params } },
      { kind: 'analyze', params: { analysis_type: 'viral_patterns', ...params } },
      { kind: 'write_content', params: { output_format: 'report', ...params } },
    ],
    diagnose_failure: [
      { kind: 'analyze', params: { analysis_type: 'root_cause', ...params } },
      { kind: 'write_content', params: { output_format: 'diagnosis', ...params } },
    ],
    review_content: [
      { kind: 'analyze', params: { analysis_type: 'quality_review', ...params } },
      { kind: 'write_content', params: { output_format: 'review', ...params } },
    ],
    draft_tweet: [{ kind: 'draft_tweet', params: { output_format: 'tweet', ...params } }],
    post_tweet: [
      { kind: 'draft_tweet', params: { output_format: 'tweet', ...params } },
      { kind: 'post_tweet', params }
    ],
    gather_intel: [
      { kind: 'crawl', params: { target: 'news_sources', ...params } },
      { kind: 'crawl', params: { target: 'social_mentions', ...params } },
      { kind: 'analyze', params: { analysis_type: 'synthesize', ...params } },
    ],
    strategic_analysis: [
      { kind: 'analyze', params: { analysis_type: 'strategy', ...params } },
      { kind: 'write_content', params: { output_format: 'strategy_doc', ...params } },
    ],
  };
  return stepMap[action] || [{ kind: 'analyze', params }];
}

async function createMissionFromProposal(supabase, proposal) {
  // Create mission
  const { data: mission, error } = await supabase
    .from('ops_missions')
    .insert({
      proposal_id: proposal.id,
      title: proposal.title,
      status: 'approved',
      created_by: proposal.agent_id,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // Create steps
  const steps = proposal.proposed_steps || generateStepsForAction(proposal.action, proposal.params);
  for (let i = 0; i < steps.length; i++) {
    await supabase.from('ops_mission_steps').insert({
      mission_id: mission.id,
      kind: steps[i].kind,
      status: 'queued',
      params: steps[i].params,
      created_at: new Date(Date.now() + i * 100).toISOString(),
    });
  }

  // Update proposal status
  await supabase
    .from('ops_mission_proposals')
    .update({ status: 'accepted' })
    .eq('id', proposal.id);

  // Fire event
  await supabase.from('ops_agent_events').insert({
    agent_id: 'system',
    kind: 'mission_created',
    title: 'Mission created',
    summary: `Mission ${mission.id} created from proposal`,
    tags: ['mission', 'created']
  });

  return mission;
}

async function maybeFinalizeMission(supabase, missionId) {
  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('status')
    .eq('mission_id', missionId);
    
  if (!steps?.length) return;

  const allCompleted = steps.every(s => s.status === 'succeeded' || s.status === 'failed');
  if (!allCompleted) return;

  const anyFailed = steps.some(s => s.status === 'failed');
  const { data: mission } = await supabase
    .from('ops_missions')
    .update({
      status: anyFailed ? 'failed' : 'succeeded',
      completed_at: new Date().toISOString()
    })
    .eq('id', missionId)
    .select()
    .single();

  await supabase.from('ops_agent_events').insert({
    agent_id: 'system',
    kind: anyFailed ? 'mission_failed' : 'mission_succeeded',
    title: anyFailed ? 'Mission failed' : 'Mission succeeded',
    summary: `Mission ${missionId} ${anyFailed ? 'failed' : 'succeeded'}`,
    tags: ['mission', anyFailed ? 'failed' : 'succeeded']
  });
}

module.exports = {
  createProposalAndMaybeAutoApprove,
  maybeFinalizeMission,
  createMissionFromProposal,
  getPolicy,
};