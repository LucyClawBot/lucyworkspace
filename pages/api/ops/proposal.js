// pages/api/ops/proposal.js
// Create and manage proposals

const { createClient } = require('@supabase/supabase-js');
const { createProposalAndMaybeAutoApprove } = require('../../../lib/proposal-service.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - List proposals
  if (req.method === 'GET') {
    try {
      const { status, agent, limit = 50 } = req.query;
      
      let query = supabase
        .from('ops_mission_proposals')
        .select('*, agent:ops_agents(*)')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (status) {
        query = query.eq('status', status);
      }
      if (agent) {
        query = query.eq('agent_id', agent);
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({ proposals: data });
    } catch (error) {
      console.error('List proposals error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Create proposal
  if (req.method === 'POST') {
    try {
      const { source, agent, action, params, priority } = req.body;

      if (!agent || !action) {
        return res.status(400).json({ error: 'Missing required fields: agent, action' });
      }

      const result = await createProposalAndMaybeAutoApprove(supabase, {
        source: source || 'api',
        agent,
        action,
        params: params || {},
        priority: priority || 'normal',
      });

      return res.status(result.rejected ? 429 : 200).json(result);
    } catch (error) {
      console.error('Create proposal error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // PATCH - Update proposal status (approve/reject)
  if (req.method === 'PATCH') {
    try {
      const { id, status, rejection_reason } = req.body;

      if (!id || !status) {
        return res.status(400).json({ error: 'Missing required fields: id, status' });
      }

      const { data: proposal, error: fetchError } = await supabase
        .from('ops_mission_proposals')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (status === 'accepted') {
        const { createMissionFromProposal } = require('../../lib/proposal-service');
        await createMissionFromProposal(supabase, proposal);
      } else {
        await supabase
          .from('ops_mission_proposals')
          .update({ status, rejection_reason })
          .eq('id', id);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Update proposal error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};