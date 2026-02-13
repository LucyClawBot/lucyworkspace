// lib/memory-system.js
// Agent memory and learning system

// Types of memory:
// - insight: Discovery (e.g., "Users prefer tweets with data")
// - pattern: Pattern recognition (e.g., "Weekend posts get 30% less engagement")
// - strategy: Strategy summary (e.g., "Teaser before main post works better")
// - preference: Preference record (e.g., "Prefers concise titles")
// - lesson: Lesson learned (e.g., "Long tweets tank read-through rates")

const MAX_MEMORIES_PER_AGENT = 200;
const MIN_CONFIDENCE = 0.55;
const MAX_MEMORIES_PER_EXTRACTION = 6;

// Query agent memories with caching
async function queryAgentMemories(supabase, { agentId, types, limit = 10, minConfidence = 0.6 }) {
  let query = supabase
    .from('ops_agent_memory')
    .select('*')
    .eq('agent_id', agentId)
    .gte('confidence', minConfidence)
    .is('superseded_by', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (types && types.length > 0) {
    query = query.in('type', types);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Extract memories from conversation
async function extractMemoriesFromConversation(supabase, conversation) {
  // In production, this would call an LLM
  // For now, we'll do rule-based extraction
  const memories = [];
  const turns = conversation.turns || [];
  
  // Simple rule-based extraction
  for (const turn of turns) {
    const content = turn.dialogue?.toLowerCase() || '';
    
    // Look for insight patterns
    if (content.includes('found') || content.includes('discovered') || content.includes('noticed')) {
      memories.push({
        agent_id: turn.speaker,
        type: 'insight',
        content: `Noted: ${turn.dialogue.substring(0, 200)}`,
        confidence: 0.65,
        tags: ['conversation', 'insight'],
        source_trace_id: `conv:${conversation.id}:turn:${turn.turn}`
      });
    }
    
    // Look for pattern recognition
    if (content.includes('pattern') || content.includes('usually') || content.includes('always') || content.includes('tends')) {
      memories.push({
        agent_id: turn.speaker,
        type: 'pattern',
        content: `Pattern observed: ${turn.dialogue.substring(0, 200)}`,
        confidence: 0.60,
        tags: ['conversation', 'pattern'],
        source_trace_id: `conv:${conversation.id}:turn:${turn.turn}`
      });
    }
    
    // Look for strategies
    if (content.includes('should') || content.includes('strategy') || content.includes('approach') || content.includes('recommend')) {
      memories.push({
        agent_id: turn.speaker,
        type: 'strategy',
        content: `Strategy suggestion: ${turn.dialogue.substring(0, 200)}`,
        confidence: 0.70,
        tags: ['conversation', 'strategy'],
        source_trace_id: `conv:${conversation.id}:turn:${turn.turn}`
      });
    }
  }

  // Cap and filter
  const filtered = memories
    .filter(m => m.confidence >= MIN_CONFIDENCE)
    .slice(0, MAX_MEMORIES_PER_EXTRACTION);

  // Check for duplicates using source_trace_id
  const uniqueMemories = [];
  for (const memory of filtered) {
    const { data: existing } = await supabase
      .from('ops_agent_memory')
      .select('id')
      .eq('source_trace_id', memory.source_trace_id)
      .maybeSingle();
    
    if (!existing) {
      uniqueMemories.push(memory);
    }
  }

  return uniqueMemories;
}

// Write memories to database
async function writeMemories(supabase, memories) {
  if (!memories?.length) return { written: 0 };

  // Check agent memory caps
  const agentCounts = {};
  for (const memory of memories) {
    agentCounts[memory.agent_id] = (agentCounts[memory.agent_id] || 0) + 1;
  }

  // Check current counts
  for (const agentId of Object.keys(agentCounts)) {
    const { count } = await supabase
      .from('ops_agent_memory')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    const remaining = MAX_MEMORIES_PER_AGENT - (count || 0);
    if (remaining <= 0) {
      // Delete oldest memories
      const { data: oldest } = await supabase
        .from('ops_agent_memory')
        .select('id')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true })
        .limit(agentCounts[agentId]);
      
      if (oldest?.length) {
        await supabase
          .from('ops_agent_memory')
          .delete()
          .in('id', oldest.map(o => o.id));
      }
    }
  }

  const { data, error } = await supabase
    .from('ops_agent_memory')
    .insert(memories)
    .select();

  if (error) throw error;

  // Fire events
  for (const memory of memories) {
    await supabase.from('ops_agent_events').insert({
      agent_id: memory.agent_id,
      kind: 'memory_created',
      title: `New ${memory.type} learned`,
      summary: memory.content.substring(0, 100),
      tags: ['memory', memory.type]
    });
  }

  return { written: data?.length || 0 };
}

// Learn from tweet outcomes
async function learnFromOutcomes(supabase) {
  // Get recent tweet metrics from last 48 hours
  const lookback = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  const { data: metrics } = await supabase
    .from('ops_tweet_metrics')
    .select('*')
    .gt('posted_at', lookback)
    .order('engagement_rate', { ascending: false });

  if (!metrics || metrics.length < 3) {
    return { learned: 0, reason: 'insufficient_data' };
  }

  // Calculate median engagement
  const rates = metrics.map(m => m.engagement_rate || 0).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];

  const lessons = [];

  // Strong performers (> 2x median)
  const strongPerformers = metrics.filter(m => m.engagement_rate > median * 2);
  for (const tweet of strongPerformers.slice(0, 3)) {
    const traceId = `tweet-lesson:${tweet.id}`;
    
    // Check if already learned
    const { data: existing } = await supabase
      .from('ops_agent_memory')
      .select('id')
      .eq('source_trace_id', traceId)
      .maybeSingle();
    
    if (!existing) {
      lessons.push({
        agent_id: tweet.agent_id || 'quill',
        type: 'lesson',
        content: `High engagement tweet pattern: "${tweet.content?.substring(0, 100)}..." (Rate: ${(tweet.engagement_rate * 100).toFixed(2)}%)`,
        confidence: 0.70,
        tags: ['engagement', 'success', 'twitter'],
        source_trace_id: traceId
      });
    }
  }

  // Weak performers (< 0.3x median)
  const weakPerformers = metrics.filter(m => m.engagement_rate < median * 0.3);
  for (const tweet of weakPerformers.slice(0, 3)) {
    const traceId = `tweet-lesson-fail:${tweet.id}`;
    
    const { data: existing } = await supabase
      .from('ops_agent_memory')
      .select('id')
      .eq('source_trace_id', traceId)
      .maybeSingle();
    
    if (!existing) {
      lessons.push({
        agent_id: tweet.agent_id || 'quill',
        type: 'lesson',
        content: `Low engagement tweet to avoid: "${tweet.content?.substring(0, 100)}..." (Rate: ${(tweet.engagement_rate * 100).toFixed(2)}%)`,
        confidence: 0.60,
        tags: ['engagement', 'failure', 'twitter'],
        source_trace_id: traceId
      });
    }
  }

  // Write lessons (max 3 per run)
  const limited = lessons.slice(0, 3);
  if (limited.length > 0) {
    await writeMemories(supabase, limited);
  }

  return { learned: limited.length, total_analyzed: metrics.length };
}

// Learn from mission outcomes
async function learnFromMissionOutcome(supabase, mission) {
  const traceId = `mission:${mission.id}`;
  
  // Check if already learned
  const { data: existing } = await supabase
    .from('ops_agent_memory')
    .select('id')
    .eq('source_trace_id', traceId)
    .maybeSingle();
  
  if (existing) return { learned: false };

  const { data: proposal } = await supabase
    .from('ops_mission_proposals')
    .select('agent_id, title')
    .eq('id', mission.proposal_id)
    .single();

  const agentId = proposal?.agent_id || 'system';
  
  if (mission.status === 'succeeded') {
    await writeMemories(supabase, [{
      agent_id: agentId,
      type: 'strategy',
      content: `Successful approach: ${proposal?.title || 'Mission'} completed successfully`,
      confidence: 0.75,
      tags: ['mission', 'success', 'strategy'],
      source_trace_id: traceId
    }]);
  } else if (mission.status === 'failed') {
    await writeMemories(supabase, [{
      agent_id: agentId,
      type: 'lesson',
      content: `Failed approach: ${proposal?.title || 'Mission'} failed - analyze and adapt`,
      confidence: 0.65,
      tags: ['mission', 'failure', 'lesson'],
      source_trace_id: traceId
    }]);
  }

  return { learned: true };
}

// Enrich topic with memory (30% chance)
async function enrichTopicWithMemory(supabase, agentId, baseTopic, allTopics, cache = new Map()) {
  // 70% use original topic
  if (Math.random() > 0.30) {
    return { topic: baseTopic, memoryInfluenced: false };
  }

  // Check cache
  let memories = cache.get(agentId);
  if (!memories) {
    memories = await queryAgentMemories(supabase, {
      agentId,
      types: ['strategy', 'lesson'],
      limit: 10,
      minConfidence: 0.6
    });
    cache.set(agentId, memories);
  }

  // Scan memory keywords against topics
  for (const memory of memories) {
    const content = memory.content.toLowerCase();
    for (const topic of allTopics) {
      const topicWords = topic.toLowerCase().split(' ');
      const matchCount = topicWords.filter(word => content.includes(word)).length;
      if (matchCount >= 2) {
        return {
          topic: topic,
          memoryInfluenced: true,
          memoryId: memory.id,
          reason: memory.content.substring(0, 100)
        };
      }
    }
  }

  return { topic: baseTopic, memoryInfluenced: false };
}

// Get voice modifiers for agent (derived from memory)
async function deriveVoiceModifiers(supabase, agentId) {
  // Aggregate memory distribution
  const { data: stats } = await supabase
    .from('ops_agent_memory')
    .select('type, tags')
    .eq('agent_id', agentId)
    .gte('confidence', 0.6);

  if (!stats || stats.length === 0) {
    return [];
  }

  const modifiers = [];
  const typeCounts = {};
  const tagCounts = {};

  for (const row of stats) {
    typeCounts[row.type] = (typeCounts[row.type] || 0) + 1;
    for (const tag of row.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Rule-driven modifiers
  if (typeCounts.lesson > 5 && tagCounts.engagement) {
    modifiers.push('Reference what works in engagement when relevant');
  }
  if (typeCounts.pattern > 3 && tagCounts.content) {
    modifiers.push("You've developed expertise in content strategy");
  }
  if (typeCounts.strategy > 5) {
    modifiers.push('You think strategically about long-term plans');
  }
  if (typeCounts.insight > 5 && tagCounts.twitter) {
    modifiers.push('You have deep knowledge of Twitter dynamics');
  }

  return modifiers.slice(0, 3);
}

module.exports = {
  queryAgentMemories,
  extractMemoriesFromConversation,
  writeMemories,
  learnFromOutcomes,
  learnFromMissionOutcome,
  enrichTopicWithMemory,
  deriveVoiceModifiers,
  MAX_MEMORIES_PER_AGENT,
  MIN_CONFIDENCE,
};