// lib/trigger-evaluator.js
// Evaluates triggers with cooldown management
// Pitfall avoided: Triggers must use proposal-service, not insert directly

const { createProposalAndMaybeAutoApprove } = require('./proposal-service');

// TRIGGER DEFINITIONS
const TRIGGERS = [
  {
    id: 'viral_tweet_analysis',
    name: 'Viral Tweet Analysis',
    condition: 'Tweet engagement > 5%',
    agent: 'scout',
    action: 'analyze_viral_content',
    cooldown: 2 * 60 * 60 * 1000, // 2 hours
    priority: 'high',
  },
  {
    id: 'mission_failure_diagnosis',
    name: 'Mission Failure Diagnosis',
    condition: 'Mission failed',
    agent: 'sage',
    action: 'diagnose_failure',
    cooldown: 60 * 60 * 1000, // 1 hour
    priority: 'high',
  },
  {
    id: 'content_quality_review',
    name: 'Content Quality Review',
    condition: 'Content published',
    agent: 'observer',
    action: 'review_content',
    cooldown: 2 * 60 * 60 * 1000, // 2 hours
    priority: 'normal',
  },
  {
    id: 'insight_promotion',
    name: 'Insight Promotion',
    condition: 'Insight upvoted multiple times',
    agent: 'sage',
    action: 'promote_insight',
    cooldown: 4 * 60 * 60 * 1000, // 4 hours
    priority: 'low',
  },
  {
    id: 'daily_intel_scan',
    name: 'Daily Intel Scan',
    condition: 'Scheduled daily',
    agent: 'scout',
    action: 'gather_intel',
    cooldown: 20 * 60 * 60 * 1000, // 20 hours (daily with buffer)
    priority: 'normal',
  },
  {
    id: 'weekly_strategy_review',
    name: 'Weekly Strategy Review',
    condition: 'Scheduled weekly',
    agent: 'sage',
    action: 'strategic_analysis',
    cooldown: 6 * 24 * 60 * 60 * 1000, // 6 days
    priority: 'normal',
  },
];

async function evaluateTriggers(supabase, timeoutMs = 4000) {
  const startTime = Date.now();
  const triggered = [];
  const cooldowns = new Map();

  for (const trigger of TRIGGERS) {
    if (Date.now() - startTime > timeoutMs) {
      console.log('Trigger evaluation timeout, stopping');
      break;
    }

    // Check cooldown
    const lastFired = await getLastTriggerFire(supabase, trigger.id);
    if (lastFired && (Date.now() - new Date(lastFired).getTime()) < trigger.cooldown) {
      continue; // Still in cooldown
    }

    // Evaluate condition
    const shouldFire = await evaluateCondition(supabase, trigger);
    
    if (shouldFire) {
      // Record trigger fire time
      await recordTriggerFire(supabase, trigger.id);
      
      // Create proposal using the service (not direct insert!)
      const result = await createProposalAndMaybeAutoApprove(supabase, {
        source: 'trigger',
        agent: trigger.agent,
        action: trigger.action,
        params: { trigger_id: trigger.id, trigger_name: trigger.name },
        priority: trigger.priority,
      });

      if (!result.rejected) {
        triggered.push({
          trigger_id: trigger.id,
          trigger_name: trigger.name,
          proposal_id: result.proposal?.id,
          auto_approved: result.auto_approved,
        });
      }
    }
  }

  return { triggered: triggered.length, items: triggered };
}

async function evaluateCondition(supabase, trigger) {
  switch (trigger.id) {
    case 'viral_tweet_analysis':
      return await checkViralTweet(supabase);
    
    case 'mission_failure_diagnosis':
      return await checkFailedMissions(supabase);
    
    case 'content_quality_review':
      return await checkNewContent(supabase);
    
    case 'insight_promotion':
      return await checkPromotableInsights(supabase);
    
    case 'daily_intel_scan':
      return await checkDailySchedule(supabase, '04:00'); // 4 AM
    
    case 'weekly_strategy_review':
      return await checkWeeklySchedule(supabase, 1, '09:00'); // Monday 9 AM
    
    default:
      return false;
  }
}

async function checkViralTweet(supabase) {
  // Check for recent tweets with high engagement
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: events } = await supabase
    .from('ops_agent_events')
    .select('*')
    .eq('type', 'tweet_posted')
    .gt('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!events || events.length === 0) return false;

  // Check if any tweet has engagement > 5%
  for (const event of events) {
    const engagement = event.data?.engagement ?? 0;
    if (engagement > 0.05) {
      // Check if already analyzed recently
      const { data: existing } = await supabase
        .from('ops_mission_proposals')
        .select('id')
        .eq('action', 'analyze_viral_content')
        .eq('params->>event_id', event.id)
        .gt('created_at', twoHoursAgo)
        .maybeSingle();

      if (!existing) return true;
    }
  }

  return false;
}

async function checkFailedMissions(supabase) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: failedMissions } = await supabase
    .from('ops_missions')
    .select('id')
    .eq('status', 'failed')
    .gt('updated_at', oneHourAgo)
    .limit(5);

  if (!failedMissions || failedMissions.length === 0) return false;

  // Check if any failed mission hasn't been diagnosed yet
  for (const mission of failedMissions) {
    const { data: existing } = await supabase
      .from('ops_mission_proposals')
      .select('id')
      .eq('action', 'diagnose_failure')
      .eq('params->>mission_id', mission.id)
      .gt('created_at', oneHourAgo)
      .maybeSingle();

    if (!existing) return true;
  }

  return false;
}

async function checkNewContent(supabase) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: published } = await supabase
    .from('ops_agent_events')
    .select('id')
    .eq('type', 'content_published')
    .gt('created_at', twoHoursAgo)
    .limit(5);

  if (!published || published.length === 0) return false;

  for (const item of published) {
    const { data: existing } = await supabase
      .from('ops_mission_proposals')
      .select('id')
      .eq('action', 'review_content')
      .eq('params->>event_id', item.id)
      .gt('created_at', twoHoursAgo)
      .maybeSingle();

    if (!existing) return true;
  }

  return false;
}

async function checkPromotableInsights(supabase) {
  // Check for insights with multiple upvotes
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  
  // This would check an insights table with upvotes
  // For now, placeholder
  return false;
}

async function checkDailySchedule(supabase, targetTime) {
  const now = new Date();
  const [hours, minutes] = targetTime.split(':');
  
  // Check if it's the target time (within 5 minute window)
  if (now.getHours() !== parseInt(hours)) return false;
  if (Math.abs(now.getMinutes() - parseInt(minutes)) > 5) return false;

  // Check if already triggered today
  const today = now.toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('ops_trigger_fires')
    .select('id')
    .eq('trigger_id', 'daily_intel_scan')
    .gte('fired_at', today)
    .maybeSingle();

  return !existing;
}

async function checkWeeklySchedule(supabase, targetDay, targetTime) {
  const now = new Date();
  
  // Check if it's the target day (0 = Sunday, 1 = Monday)
  if (now.getDay() !== targetDay) return false;
  
  const [hours, minutes] = targetTime.split(':');
  if (now.getHours() !== parseInt(hours)) return false;
  if (Math.abs(now.getMinutes() - parseInt(minutes)) > 5) return false;

  // Check if already triggered this week
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const { data: existing } = await supabase
    .from('ops_trigger_fires')
    .select('id')
    .eq('trigger_id', 'weekly_strategy_review')
    .gte('fired_at', weekStart.toISOString())
    .maybeSingle();

  return !existing;
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
  await supabase.from('ops_trigger_fires').insert({
    trigger_id: triggerId,
    fired_at: new Date().toISOString(),
  });
}

module.exports = { evaluateTriggers };
