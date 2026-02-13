// lib/proposal-service.js
// ONE FILE TO RULE THEM ALL — Single entry point for all proposal creation
// Implements: Cap Gates + Auto-Approve + Mission Creation

const { createClient } = require('@supabase/supabase-js');

// CAP GATES — Reject at the entry point, don't pile up in queue
const STEP_KIND_GATES = {
  post_tweet: checkPostTweetGate,
  write_content: checkWriteContentGate,
  deploy: checkDeployGate,
  analyze: checkAnalyzeGate,
  crawl: checkCrawlGate,
  draft_tweet: checkDraftTweetGate,
};

async function checkPostTweetGate(supabase) {
  const { data: autopost } = await getPolicy(supabase, 'x_autopost', {});
  if (autopost.enabled === false) {
    return { ok: false, reason: 'x_autopost disabled' };
  }

  const { data: quota } = await getPolicy(supabase, 'x_daily_quota', { limit: 8 });
  const limit = Number(quota.limit ?? 8);
  
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('ops_action_runs')
    .select('id', { count: 'exact', head: true })
    .eq('output->>action', 'post_tweet')
    .gte('completed_at', today);

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Daily tweet quota reached (${count}/${limit})` };
  }

  return { ok: true };
}

async function checkWriteContentGate(supabase) {
  const { data: policy } = await getPolicy(supabase, 'content_quota', { daily_limit: 5 });
  const limit = Number(policy.daily_limit ?? 5);
  
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
  const { data: policy } = await getPolicy(supabase, 'deploy_policy', { enabled: true });
  if (policy.enabled === false) {
    return { ok: false, reason: 'Deploys disabled by policy' };
  }
  return { ok: true };
}

async function checkAnalyzeGate(supabase) {
  // Analyze is generally allowed, but could add rate limiting
  return { ok: true };
}

async function checkCrawlGate(supabase) {
  const { data: policy } = await getPolicy(supabase, 'crawl_quota', { hourly_limit: 20 });
  const limit = Number(policy.hourly_limit ?? 20);
  
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
  // Drafts have higher quota than posts
  const { data: policy } = await getPolicy(supabase, 'draft_quota', { daily_limit: 20 });
  const limit = Number(policy.daily_limit ?? 20);
  
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
  
  return { data: data?.value ?? defaultValue };
}

// MAIN FUNCTION — Single entry point for ALL proposal creation
async function createProposalAndMaybeAutoApprove(supabase, input) {
  const { source, agent, action, params = {}, priority = 'normal' } = input;
  
  // 1. Check daily limit per agent
  const today = new Date().toISOString().split('T')[0];
  const { count: dailyCount } = await supabase
    .from('ops_mission_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('agent', agent)
    .gte('created_at', today);

  const { data: limits } = await getPolicy(supabase, 'agent_daily_limits', { default: 50 });
  const agentLimit = limits[agent] ?? limits.default ?? 50;
  
  if ((dailyCount ?? 0) >= agentLimit) {
    const rejection = {
      source,
      agent,
      action,
      params,
      status: 'rejected',
      rejection_reason: `Daily proposal limit reached for ${agent} (${dailyCount}/${agentLimit})`,
    };
    
    await supabase.from('ops_mission_proposals').insert(rejection);
    
    // Emit warning event
    await supabase.from('ops_agent_events').insert({
      source: 'system',
      type: 'proposal_rejected',
      data: { agent, action, reason: rejection.rejection_reason },
    });
    
    return { proposal: null, rejected: true, reason: rejection.rejection_reason };
  }

  // 2. Check Cap Gates for the specific action
  const gate = STEP_KIND_GATES[action];
  if (gate) {
    const gateResult = await gate(supabase);
    if (!gateResult.ok) {
      const rejection = {
        source,
        agent,
        action,
        params,
        status: 'rejected',
        rejection_reason: gateResult.reason,
      };
      
      await supabase.from('ops_mission_proposals').insert(rejection);
      
      await supabase.from('ops_agent_events').insert({
        source: 'system',
        type: 'proposal_rejected',
        data: { agent, action, reason: gateResult.reason },
      });
      
      return { proposal: null, rejected: true, reason: gateResult.reason };
    }
  }

  // 3. Check auto-approve policy
  const { data: autoApprovePolicy } = await getPolicy(supabase, 'auto_approve', { 
    enabled: true, 
    allowed_step_kinds: ['draft_tweet', 'crawl', 'analyze', 'write_content'],
    allowed_agents: ['minion', 'sage', 'scout', 'quill', 'xalt', 'observer']
  });

  const canAutoApprove = 
    autoApprovePolicy.enabled !== false &&
    autoApprovePolicy.allowed_step_kinds?.includes(action) &&
    autoApprovePolicy.allowed_agents?.includes(agent);

  // 4. Insert proposal
  const { data: proposal, error } = await supabase
    .from('ops_mission_proposals')
    .insert({
      source,
      agent,
      action,
      params,
      priority,
      status: canAutoApprove ? 'accepted' : 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // 5. Emit event
  await supabase.from('ops_agent_events').insert({
    source: 'system',
    type: 'proposal_created',
    data: { 
      proposal_id: proposal.id, 
      agent, 
      action, 
      auto_approved: canAutoApprove,
      source_type: source,
    },
  });

  // 6. If approved, create mission + steps
  if (canAutoApprove) {
    await createMissionFromProposal(supabase, proposal);
  }

  return { proposal, rejected: false, auto_approved: canAutoApprove };
}

// Generate steps based on action type
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
    draft_tweet: [
      { kind: 'write_content', params: { output_format: 'tweet', ...params } },
    ],
    post_tweet: [
      { kind: 'write_content', params: { output_format: 'tweet', ...params } },
      { kind: 'post_tweet', params },
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
    quality_check: [
      { kind: 'analyze', params: { analysis_type: 'quality', ...params } },
    ],
    make_decision: [
      { kind: 'analyze', params: { analysis_type: 'decision', ...params } },
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
      status: 'running',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Generate steps
  const steps = generateStepsForAction(proposal.action, proposal.params);
  
  for (let i = 0; i < steps.length; i++) {
    await supabase.from('ops_mission_steps').insert({
      mission_id: mission.id,
      kind: steps[i].kind,
      params: steps[i].params,
      status: 'queued',
      created_at: new Date(Date.now() + i * 100).toISOString(),
    });
  }

  // Update proposal to link to mission
  await supabase
    .from('ops_mission_proposals')
    .update({ status: 'accepted' })
    .eq('id', proposal.id);

  // Emit mission created event
  await supabase.from('ops_agent_events').insert({
    source: 'system',
    type: 'mission_created',
    data: { 
      mission_id: mission.id, 
      proposal_id: proposal.id,
      agent: proposal.agent,
      action: proposal.action,
      steps_count: steps.length,
    },
  });

  return mission;
}

// Finalize mission when all steps complete
async function maybeFinalizeMission(supabase, missionId) {
  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('status')
    .eq('mission_id', missionId);

  if (!steps || steps.length === 0) return;

  const allCompleted = steps.every(s => s.status === 'succeeded' || s.status === 'failed');
  const anyFailed = steps.some(s => s.status === 'failed');

  if (allCompleted) {
    const { data: mission } = await supabase
      .from('ops_missions')
      .update({ 
        status: anyFailed ? 'failed' : 'succeeded',
        completed_at: new Date().toISOString(),
      })
      .eq('id', missionId)
      .select()
      .single();

    // Emit completion event
    await supabase.from('ops_agent_events').insert({
      source: 'system',
      type: anyFailed ? 'mission_failed' : 'mission_succeeded',
      data: { 
        mission_id: missionId,
        agent: mission?.proposal?.agent,
      },
    });
  }
}

module.exports = {
  createProposalAndMaybeAutoApprove,
  maybeFinalizeMission,
  generateStepsForAction,
  getPolicy,
};
