// pages/api/ops/proposal.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { agent, action, params = {}, priority = 'normal', source = 'api' } = req.body;

    if (!agent || !action) {
      return res.status(400).json({ error: 'agent and action required' });
    }

    const { data: policy } = await supabase.from('ops_policy').select('value').eq('key', 'auto_approve').single();
    const autoApprove = policy?.value?.enabled && policy?.value?.allowed_step_kinds?.includes(action);

    const { data: proposal } = await supabase.from('ops_mission_proposals')
      .insert({ source, agent, action, params, priority, status: autoApprove ? 'accepted' : 'pending' })
      .select().single();

    await supabase.from('ops_agent_events').insert({
      source, type: 'proposal_created',
      data: { proposal_id: proposal.id, agent, action, auto_approved: autoApprove }
    });

    if (autoApprove) {
      const { data: mission } = await supabase.from('ops_missions')
        .insert({ proposal_id: proposal.id, status: 'running' })
        .select().single();

      await supabase.from('ops_mission_steps').insert({
        mission_id: mission.id, kind: 'analyze', params, status: 'queued'
      });
    }

    return res.status(201).json({ success: true, proposal, auto_approved: autoApprove });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
