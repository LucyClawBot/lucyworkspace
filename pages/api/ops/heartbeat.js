// pages/api/ops/heartbeat.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET;

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${HEARTBEAT_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = {};

  try {
    results.triggers = await evaluateTriggers(supabase);
    results.reactions = await processReactions(supabase);
    results.insights = await promoteInsights(supabase);
    results.recovery = await recoverStaleSteps(supabase);

    return res.status(200).json({ success: true, timestamp: new Date().toISOString(), results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function evaluateTriggers(supabase) {
  const triggered = [];
  
  const { data: events } = await supabase
    .from('ops_agent_events')
    .select('*')
    .gt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  for (const event of events || []) {
    if (event.type === 'tweet_posted') {
      await createProposal(supabase, {
        source: 'trigger', agent: 'growth', action: 'analyze_viral_content',
        params: { event_id: event.id }, priority: 'high'
      });
      triggered.push({ type: 'viral_analysis', event_id: event.id });
    }
  }

  return { triggered: triggered.length, items: triggered };
}

async function processReactions(supabase) {
  return { processed: 0 };
}

async function promoteInsights(supabase) {
  return { promoted: 0 };
}

async function recoverStaleSteps(supabase) {
  const staleTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: staleSteps } = await supabase
    .from('ops_mission_steps')
    .select('id, mission_id')
    .eq('status', 'running')
    .lt('reserved_at', staleTime);

  for (const step of staleSteps || []) {
    await supabase.from('ops_mission_steps')
      .update({ status: 'failed', last_error: 'Stale: 30min timeout' })
      .eq('id', step.id);
  }

  return { recovered: staleSteps?.length || 0 };
}

async function createProposal(supabase, { source, agent, action, params, priority }) {
  const { data: policy } = await supabase.from('ops_policy').select('value').eq('key', 'auto_approve').single();
  const autoApprove = policy?.value?.enabled && policy?.value?.allowed_step_kinds?.includes(action);

  const { data: proposal } = await supabase.from('ops_mission_proposals')
    .insert({ source, agent, action, params, priority, status: autoApprove ? 'accepted' : 'pending' })
    .select().single();

  await supabase.from('ops_agent_events').insert({
    source: 'system', type: 'proposal_created',
    data: { proposal_id: proposal.id, agent, action, auto_approved: autoApprove }
  });

  if (autoApprove) await createMission(supabase, proposal);
  return proposal;
}

async function createMission(supabase, proposal) {
  const { data: mission } = await supabase.from('ops_missions')
    .insert({ proposal_id: proposal.id, status: 'running' })
    .select().single();

  const steps = [{ kind: 'analyze', params: proposal.params }];
  for (const step of steps) {
    await supabase.from('ops_mission_steps').insert({
      mission_id: mission.id, kind: step.kind, params: step.params, status: 'queued'
    });
  }

  return mission;
}
