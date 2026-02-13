// pages/api/ops/proposal.js
// Create a new proposal — uses proposal-service (Pitfall 2 fix)

const { createClient } = require('@supabase/supabase-js');
const { createProposalAndMaybeAutoApprove } = require('../../lib/proposal-service');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      agent, 
      action, 
      params = {}, 
      priority = 'normal', 
      source = 'api' 
    } = req.body;

    if (!agent || !action) {
      return res.status(400).json({ error: 'agent and action are required' });
    }

    // Use the unified proposal service (Pitfall 2 fix)
    const result = await createProposalAndMaybeAutoApprove(supabase, {
      source,
      agent,
      action,
      params,
      priority,
    });

    if (result.rejected) {
      return res.status(429).json({
        success: false,
        rejected: true,
        reason: result.reason,
      });
    }

    return res.status(201).json({
      success: true,
      proposal: result.proposal,
      auto_approved: result.auto_approved,
    });
  } catch (error) {
    console.error('Proposal error:', error);
    return res.status(500).json({ error: error.message });
  }
};
