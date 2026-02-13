// lib/trigger-evaluator.js — CommonJS version
const { createProposalAndMaybeAutoApprove } = require('./proposal-service.js');

// Trigger rules - reactive and proactive
const TRIGGER_RULES = [
  // Reactive triggers
  {
    id: 'viral_tweet_analysis',
    name: 'Viral Tweet Analysis',
    trigger_event: 'tweet_high_engagement',
    conditions: { engagement_rate_min: 0.05, lookback_minutes: 60 },
    action_config: { target_agent: 'scout', action: 'analyze_viral_content' },
    cooldown_minutes: 120,
    enabled: true,
  },
  {
    id: 'mission_failure_diagnosis',
    name: 'Mission Failure Diagnosis',
    trigger_event: 'mission_failed',
    conditions: { lookback_minutes: 60 },
    action_config: { target_agent: 'sage', action: 'diagnose_failure' },
    cooldown_minutes: 60,
    enabled: true,
  },
  {
    id: 'content_published_review',
    name: 'Content Published Review',
    trigger_event: 'content_published',
    conditions: { lookback_minutes: 120 },
    action_config: { target_agent: 'observer', action: 'review_content' },
    cooldown_minutes: 120,
    enabled: true,
  },
  // Proactive triggers
  {
    id: 'proactive_scan_signals',
    name: 'Proactive Signal Scan',
    trigger_event: 'proactive_scan_signals',
    conditions: { interval_hours: 3, skip_probability: 0.1 },
    action_config: { target_agent: 'scout', action: 'gather_intel' },
    cooldown_minutes: 180,
    enabled: true,
  },
  {
    id: 'proactive_draft_tweet',
    name: 'Proactive Tweet Drafting',
    trigger_event: 'proactive_draft_tweet',
    conditions: { interval_hours: 4, skip_probability: 0.15 },
    action_config: { target_agent: 'quill', action: 'draft_tweet' },
    cooldown_minutes: 240,
    enabled: true,
  },
  {
    id: 'proactive_research',
    name: 'Proactive Research',
    trigger_event: 'proactive_research',
    conditions: { interval_hours: 6, skip_probability: 0.1 },
    action_config: { target_agent: 'sage', action: 'strategic_analysis' },
    cooldown_minutes: 360,
    enabled: true,
  },
];

async function evaluateTriggers(supabase, timeoutMs = 4000) {
  const startTime = Date.now();
  const triggered = [];

  for (const rule of TRIGGER_RULES) {
    if (Date.now() - startTime > timeoutMs) break;
    if (!rule.enabled) continue;

    // Check cooldown
    const lastFired = await getLastTriggerFire(supabase, rule.id);
    if (lastFired && (Date.now() - new Date(lastFired).getTime()) < rule.cooldown_minutes * 60 * 1000) {
      continue;
    }

    // Evaluate condition
    const shouldFire = await evaluateCondition(supabase, rule);
    if (shouldFire) {
      await recordTriggerFire(supabase, rule.id);
      const result = await createProposalAndMaybeAutoApprove(supabase, {
        source: 'trigger',
        agent: rule.action_config.target_agent,
        action: rule.action_config.action,
        params: { trigger_id: rule.id, trigger_name: rule.name },
        priority: 'normal'
      });
      
      if (!result.rejected) {
        triggered.push({
          trigger_id: rule.id,
          trigger_name: rule.name,
          proposal_id: result.proposal?.id,
          auto_approved: result.auto_approved
        });
      }
    }
  }

  return { triggered: triggered.length, items: triggered };
}

async function evaluateCondition(supabase, rule) {
  switch (rule.trigger_event) {
    case 'tweet_high_engagement':
      return await checkTweetHighEngagement(supabase, rule.conditions);
    case 'mission_failed':
      return await checkFailedMissions(supabase, rule.conditions);
    case 'content_published':
      return await checkContentPublished(supabase, rule.conditions);
    case 'proactive_scan_signals':
      return await checkProactiveSchedule(supabase, rule, 3);
    case 'proactive_draft_tweet':
      return await checkProactiveSchedule(supabase, rule, 4);
    case 'proactive_research':
      return await checkProactiveSchedule(supabase, rule, 6);
    default:
      return false;
  }
}

async function checkTweetHighEngagement(supabase, conditions) {
  const lookback = new Date(Date.now() - conditions.lookback_minutes * 60 * 1000).toISOString();
  
  const { data: events } = await supabase
    .from('ops_agent_events')
    .select('*')
    .eq('kind', 'tweet_posted')
    .gt('created_at', lookback)
    .order('created_at', { ascending: false })
    .limit(10);

  for (const event of events || []) {
    const engagement = event.data?.engagement_rate || 0;
    if (engagement > conditions.engagement_rate_min) {
      // Check if already processed
      const { data: existing } = await supabase
        .from('ops_mission_proposals')
        .select('id')
        .eq('agent_id', 'scout')
        .eq('title', 'like', '%analyze_viral_content%')
        .gt('created_at', lookback)
        .maybeSingle();
      
      if (!existing) return true;
    }
  }
  return false;
}

async function checkFailedMissions(supabase, conditions) {
  const lookback = new Date(Date.now() - conditions.lookback_minutes * 60 * 1000).toISOString();
  
  const { data: failed } = await supabase
    .from('ops_missions')
    .select('id')
    .eq('status', 'failed')
    .gt('updated_at', lookback)
    .limit(5);

  for (const mission of failed || []) {
    const { data: existing } = await supabase
      .from('ops_mission_proposals')
      .select('id')
      .eq('agent_id', 'sage')
      .eq('title', 'like', '%diagnose_failure%')
      .gt('created_at', lookback)
      .maybeSingle();
    
    if (!existing) return true;
  }
  return false;
}

async function checkContentPublished(supabase, conditions) {
  const lookback = new Date(Date.now() - conditions.lookback_minutes * 60 * 1000).toISOString();
  
  const { data: published } = await supabase
    .from('ops_agent_events')
    .select('id')
    .eq('kind', 'content_published')
    .gt('created_at', lookback)
    .limit(5);

  for (const item of published || []) {
    const { data: existing } = await supabase
      .from('ops_mission_proposals')
      .select('id')
      .eq('agent_id', 'observer')
      .eq('title', 'like', '%review_content%')
      .gt('created_at', lookback)
      .maybeSingle();
    
    if (!existing) return true;
  }
  return false;
}

async function checkProactiveSchedule(supabase, rule, intervalHours) {
  const now = new Date();
  const lastHour = Math.floor(now.getHours() / intervalHours) * intervalHours;
  
  // Check if already fired this interval
  const intervalStart = new Date(now);
  intervalStart.setHours(lastHour, 0, 0, 0);
  
  const { data: existing } = await supabase
    .from('ops_trigger_fires')
    .select('id')
    .eq('trigger_id', rule.id)
    .gte('fired_at', intervalStart.toISOString())
    .maybeSingle();
  
  if (existing) return false;
  
  // Add randomness (skip_probability)
  if (Math.random() < (rule.conditions.skip_probability || 0.1)) {
    return false;
  }
  
  // Add jitter (random delay within interval)
  const jitterMinutes = Math.floor(Math.random() * 30);
  if (now.getMinutes() < jitterMinutes) {
    return false;
  }
  
  return true;
}

async function getLastTriggerFire(supabase, triggerId) {
  const { data } = await supabase
    .from('ops_trigger_fires')
    .select('fired_at')
    .eq('trigger_id', triggerId)
    .order('fired_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.fired_at;
}

async function recordTriggerFire(supabase, triggerId) {
  await supabase
    .from('ops_trigger_fires')
    .insert({
      trigger_id: triggerId,
      fired_at: new Date().toISOString()
    });
}

module.exports = {
  evaluateTriggers,
  TRIGGER_RULES,
};