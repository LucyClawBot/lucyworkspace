// lib/reaction-matrix.js
// Spontaneous inter-agent interaction with probability-based non-determinism
// probability isn't a bug, it's a feature. 100% determinism = robot.

const { createProposalAndMaybeAutoApprove } = require('./proposal-service.js');

// Default reaction matrix (can be overridden in ops_policy)
const DEFAULT_REACTION_MATRIX = {
  patterns: [
    {
      id: 'tweet_analyze',
      source: 'xalt',           // Who triggered
      tags: ['tweet', 'posted'], // Event tags to match
      target: 'scout',          // Who reacts
      type: 'analyze_viral_content',
      probability: 0.3,         // 30% chance = feels like a real team
      cooldown: 120,            // minutes
      description: 'Xalt posts tweet → 30% chance Scout analyzes performance',
    },
    {
      id: 'failure_diagnose',
      source: '*',              // Any agent
      tags: ['mission', 'failed'],
      target: 'sage',
      type: 'diagnose_failure',
      probability: 1.0,         // Always diagnose failures
      cooldown: 60,
      description: 'Any mission fails → Sage diagnoses (100%)',
    },
    {
      id: 'content_review',
      source: 'quill',
      tags: ['content', 'published'],
      target: 'observer',
      type: 'review_content',
      probability: 0.5,
      cooldown: 30,
      description: 'Quill publishes content → 50% chance Observer reviews',
    },
    {
      id: 'intel_report',
      source: 'scout',
      tags: ['intel', 'gathered'],
      target: 'sage',
      type: 'strategic_analysis',
      probability: 0.4,
      cooldown: 60,
      description: 'Scout gathers intel → 40% chance Sage strategizes',
    },
    {
      id: 'decision_support',
      source: 'minion',
      tags: ['decision', 'pending'],
      target: 'sage',
      type: 'strategic_analysis',
      probability: 0.6,
      cooldown: 30,
      description: 'Minion has pending decision → 60% chance Sage advises',
    },
  ],
};

async function processReactionQueue(supabase, timeoutMs = 3000) {
  const startTime = Date.now();
  const processed = [];

  // Get reaction matrix from policy (or use default)
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'reaction_matrix')
    .single();

  const matrix = policy?.value ?? DEFAULT_REACTION_MATRIX;

  // Get recent unprocessed events
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from('ops_agent_events')
    .select('*')
    .gt('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  for (const event of recentEvents || []) {
    if (Date.now() - startTime > timeoutMs) break;

    for (const pattern of matrix.patterns || []) {
      // Check if pattern matches event
      if (!matchesPattern(event, pattern)) continue;

      // Check cooldown
      const recentlyProcessed = await checkCooldown(supabase, pattern.id, pattern.cooldown);
      if (recentlyProcessed) continue;

      // Apply probability
      if (Math.random() > pattern.probability) continue;

      // Create reaction proposal
      const result = await createProposalAndMaybeAutoApprove(supabase, {
        source: 'reaction',
        agent: pattern.target,
        action: pattern.type,
        params: {
          source_event_id: event.id,
          source_event_type: event.type,
          pattern_id: pattern.id,
          triggered_by: event.data?.agent || event.source,
        },
        priority: 'normal',
      });

      if (!result.rejected) {
        processed.push({
          event_id: event.id,
          pattern_id: pattern.id,
          target_agent: pattern.target,
          action: pattern.type,
          proposal_id: result.proposal?.id,
        });

        // Record cooldown
        await recordCooldown(supabase, pattern.id);
      }
    }
  }

  return { processed: processed.length, items: processed };
}

function matchesPattern(event, pattern) {
  // Check source match
  if (pattern.source !== '*' && pattern.source !== event.source) {
    return false;
  }

  // Check tags match (all pattern tags must be present in event)
  const eventTags = event.data?.tags || [];
  if (pattern.tags && pattern.tags.length > 0) {
    const allTagsPresent = pattern.tags.every(tag => 
      eventTags.includes(tag) || event.type.includes(tag)
    );
    if (!allTagsPresent) return false;
  }

  return true;
}

async function checkCooldown(supabase, patternId, cooldownMinutes) {
  const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('ops_reaction_cooldowns')
    .select('id')
    .eq('pattern_id', patternId)
    .gt('last_triggered', cooldownTime)
    .maybeSingle();

  return !!data;
}

async function recordCooldown(supabase, patternId) {
  await supabase.from('ops_reaction_cooldowns').upsert({
    pattern_id: patternId,
    last_triggered: new Date().toISOString(),
  }, {
    onConflict: 'pattern_id',
  });
}

// Get current reaction matrix for display
async function getReactionMatrix(supabase) {
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'reaction_matrix')
    .single();

  return policy?.value ?? DEFAULT_REACTION_MATRIX;
}

// Update reaction matrix
async function updateReactionMatrix(supabase, newMatrix) {
  await supabase.from('ops_policy').upsert({
    key: 'reaction_matrix',
    value: newMatrix,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'key',
  });
}

module.exports = {
  processReactionQueue,
  getReactionMatrix,
  updateReactionMatrix,
  DEFAULT_REACTION_MATRIX,
};
