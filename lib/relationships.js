// lib/relationships.js
// Dynamic affinity system for agent relationships

const MAX_DRIFT_PER_CONVERSATION = 0.03;
const AFFINITY_FLOOR = 0.10;
const AFFINITY_CEILING = 0.95;

// Get relationship between two agents
async function getRelationship(supabase, agentA, agentB) {
  const [a, b] = [agentA, agentB].sort();
  
  const { data, error } = await supabase
    .from('ops_agent_relationships')
    .select('*')
    .eq('agent_a', a)
    .eq('agent_b', b)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  
  return data || {
    agent_a: a,
    agent_b: b,
    affinity: 0.50,
    total_interactions: 0,
    positive_interactions: 0,
    negative_interactions: 0,
    drift_log: []
  };
}

// Get all relationships for an agent
async function getAgentRelationships(supabase, agentId) {
  const { data, error } = await supabase
    .from('ops_agent_relationships')
    .select('*')
    .or(`agent_a.eq.${agentId},agent_b.eq.${agentId}`);
  
  if (error) throw error;
  return data || [];
}

// Apply relationship drift from conversation analysis
async function applyPairwiseDrifts(supabase, drifts, conversationId) {
  const results = [];
  
  for (const { agent_a, agent_b, drift, reason } of drifts) {
    const [a, b] = [agent_a, agent_b].sort();
    
    // Clamp drift
    const clampedDrift = Math.max(-MAX_DRIFT_PER_CONVERSATION, Math.min(MAX_DRIFT_PER_CONVERSATION, drift));
    
    // Get current relationship
    const relationship = await getRelationship(supabase, a, b);
    
    // Calculate new affinity
    let newAffinity = relationship.affinity + clampedDrift;
    newAffinity = Math.max(AFFINITY_FLOOR, Math.min(AFFINITY_CEILING, newAffinity));
    
    // Update drift log
    const driftLog = relationship.drift_log || [];
    driftLog.push({
      drift: clampedDrift,
      reason,
      conversationId,
      at: new Date().toISOString()
    });
    
    // Keep only last 20 entries
    const trimmedLog = driftLog.slice(-20);
    
    // Update or insert relationship
    const { data, error } = await supabase
      .from('ops_agent_relationships')
      .upsert({
        agent_a: a,
        agent_b: b,
        affinity: newAffinity,
        total_interactions: (relationship.total_interactions || 0) + 1,
        positive_interactions: clampedDrift > 0 
          ? (relationship.positive_interactions || 0) + 1 
          : (relationship.positive_interactions || 0),
        negative_interactions: clampedDrift < 0 
          ? (relationship.negative_interactions || 0) + 1 
          : (relationship.negative_interactions || 0),
        drift_log: trimmedLog
      }, {
        onConflict: 'agent_a,agent_b'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to update relationship:', error);
      continue;
    }
    
    results.push({
      agent_a: a,
      agent_b: b,
      old_affinity: relationship.affinity,
      new_affinity: newAffinity,
      drift: clampedDrift
    });
    
    // Fire event for significant changes
    if (Math.abs(clampedDrift) >= 0.02) {
      await supabase.from('ops_agent_events').insert({
        agent_id: 'system',
        kind: 'relationship_changed',
        title: 'Relationship shifted',
        summary: `${a} ↔ ${b}: ${clampedDrift > 0 ? 'improved' : 'strained'} (${newAffinity.toFixed(2)})`,
        tags: ['relationship', clampedDrift > 0 ? 'positive' : 'negative'],
        data: { agent_a: a, agent_b: b, old: relationship.affinity, new: newAffinity }
      });
    }
  }
  
  return results;
}

// Extract relationship drift from conversation
async function extractRelationshipDrifts(conversation) {
  const drifts = [];
  const participants = conversation.participants || [];
  
  // Simple rule-based drift extraction
  const turns = conversation.turns || [];
  
  for (let i = 0; i < turns.length - 1; i++) {
    const current = turns[i];
    const next = turns[i + 1];
    
    if (!current || !next) continue;
    
    const currentText = current.dialogue?.toLowerCase() || '';
    const nextText = next.dialogue?.toLowerCase() || '';
    
    // Check for agreement signals
    const agreementSignals = ['agree', 'exactly', 'yes', 'right', 'good point', 'makes sense'];
    const disagreementSignals = ['disagree', 'no', 'but', 'however', 'not sure', 'concerned', 'problem'];
    
    const hasAgreement = agreementSignals.some(s => nextText.includes(s));
    const hasDisagreement = disagreementSignals.some(s => nextText.includes(s));
    
    if (hasAgreement) {
      drifts.push({
        agent_a: current.speaker,
        agent_b: next.speaker,
        drift: 0.01 + Math.random() * 0.01, // Small positive drift
        reason: 'Aligned on discussion point'
      });
    } else if (hasDisagreement) {
      drifts.push({
        agent_a: current.speaker,
        agent_b: next.speaker,
        drift: -0.01 - Math.random() * 0.01, // Small negative drift
        reason: 'Disagreed on approach'
      });
    }
  }
  
  // Aggregate drifts by pair
  const driftMap = new Map();
  for (const drift of drifts) {
    const key = [drift.agent_a, drift.agent_b].sort().join(':');
    if (!driftMap.has(key)) {
      driftMap.set(key, drift);
    } else {
      const existing = driftMap.get(key);
      existing.drift += drift.drift;
      existing.reason = drift.drift > 0 ? 'Multiple points of alignment' : 'Multiple disagreements';
    }
  }
  
  return Array.from(driftMap.values());
}

// Get interaction type based on affinity
function getInteractionType(affinity) {
  const tension = 1 - affinity;
  
  if (tension > 0.6) {
    // High tension → chance of direct challenge
    return Math.random() < 0.2 ? 'challenge' : 'critical';
  } else if (tension < 0.3) {
    // Low tension → chance of supportive interaction
    return Math.random() < 0.4 ? 'supportive' : 'agreement';
  }
  
  return 'neutral';
}

// Select next speaker based on weighted randomness
function selectNextSpeaker({ participants, lastSpeaker, speakCounts, affinities }) {
  const weights = participants.map(agent => {
    // Can't speak twice in a row
    if (agent === lastSpeaker) return 0;
    
    let weight = 1.0;
    
    // Good rapport with last speaker → more likely to respond
    if (lastSpeaker && affinities) {
      const affinity = affinities.get(`${[agent, lastSpeaker].sort().join(':')}`) || 0.5;
      weight += affinity * 0.6;
    }
    
    // Spoke recently → lower weight
    if (speakCounts) {
      const count = speakCounts.get(agent) || 0;
      weight -= count * 0.15;
    }
    
    // Random jitter (±20%)
    weight += (Math.random() * 0.4 - 0.2);
    
    return Math.max(0.1, weight);
  });
  
  return weightedRandomPick(participants, weights);
}

// Select first speaker based on format
function selectFirstSpeaker(participants, format) {
  if (format === 'standup') {
    // Coordinator always starts standup
    if (participants.includes('coordinator')) {
      return 'coordinator';
    }
  }
  
  // Random otherwise
  return participants[Math.floor(Math.random() * participants.length)];
}

// Weighted random selection
function weightedRandomPick(items, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1];
}

// Get all pairwise combinations
function getPairwiseCombinations(participants) {
  const pairs = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      pairs.push([participants[i], participants[j]]);
    }
  }
  return pairs;
}

module.exports = {
  getRelationship,
  getAgentRelationships,
  applyPairwiseDrifts,
  extractRelationshipDrifts,
  getInteractionType,
  selectNextSpeaker,
  selectFirstSpeaker,
  weightedRandomPick,
  getPairwiseCombinations,
  MAX_DRIFT_PER_CONVERSATION,
  AFFINITY_FLOOR,
  AFFINITY_CEILING,
};