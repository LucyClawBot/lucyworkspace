// lib/roundtable.js
// Roundtable conversation system for multi-agent interactions

const { selectNextSpeaker, selectFirstSpeaker, getInteractionType, getPairwiseCombinations, applyPairwiseDrifts, extractRelationshipDrifts } = require('./relationships');
const { extractMemoriesFromConversation, writeMemories } = require('./memory-system');

// Conversation formats
const FORMATS = {
  standup: {
    minAgents: 4,
    maxAgents: 6,
    minTurns: 6,
    maxTurns: 12,
    temperature: 0.6,
    description: 'Align priorities, surface issues'
  },
  debate: {
    minAgents: 2,
    maxAgents: 3,
    minTurns: 6,
    maxTurns: 10,
    temperature: 0.8,
    description: 'Two agents with disagreements face off'
  },
  watercooler: {
    minAgents: 2,
    maxAgents: 3,
    minTurns: 2,
    maxTurns: 5,
    temperature: 0.9,
    description: 'Casual chitchat - insights emerge naturally'
  },
  brainstorm: {
    minAgents: 3,
    maxAgents: 5,
    minTurns: 8,
    maxTurns: 15,
    temperature: 0.85,
    description: 'Generate ideas, explore possibilities'
  },
  war_room: {
    minAgents: 3,
    maxAgents: 6,
    minTurns: 5,
    maxTurns: 10,
    temperature: 0.7,
    description: 'Crisis management, urgent decisions'
  }
};

// Daily schedule for conversations
const SCHEDULE = [
  { hour_utc: 6, name: 'Morning Standup', format: 'standup', probability: 1.0 },
  { hour_utc: 9, name: 'Strategy Brainstorm', format: 'brainstorm', probability: 0.4 },
  { hour_utc: 12, name: 'Midday Watercooler', format: 'watercooler', probability: 0.5 },
  { hour_utc: 14, name: 'Afternoon Debate', format: 'debate', probability: 0.3 },
  { hour_utc: 17, name: 'Evening Check-in', format: 'standup', probability: 0.6 },
  { hour_utc: 20, name: 'Night Watercooler', format: 'watercooler', probability: 0.4 },
];

// Voice definitions (loaded from database in production)
const VOICES = {
  coordinator: {
    displayName: 'Boss',
    tone: 'direct, results-oriented, slightly impatient',
    quirk: 'Always asks for deadlines and progress updates',
    systemDirective: `You are the project manager. Speak in short, direct sentences. You care about deadlines, priorities, and accountability. Cut through fluff quickly.`,
  },
  scout: {
    displayName: 'Analyst',
    tone: 'measured, data-driven, cautious',
    quirk: 'Cites numbers before giving opinions',
    systemDirective: `You are the data analyst. Always ground your opinions in data. You push back on gut feelings and demand evidence. You're skeptical but fair.`,
  },
  quill: {
    displayName: 'Writer',
    tone: 'emotional, narrative-focused, creative',
    quirk: 'Turns everything into a story',
    systemDirective: `You are the content creator. You think in narratives and emotional resonance. You ask "what is the story here?" and care about voice and tone.`,
  },
  sage: {
    displayName: 'Strategist',
    tone: 'thoughtful, big-picture oriented',
    quirk: 'Connects everything to long-term goals',
    systemDirective: `You are the strategic advisor. You think in systems and long-term consequences. You ask "how does this fit the bigger picture?" and consider second-order effects.`,
  },
  observer: {
    displayName: 'Observer',
    tone: 'detail-oriented, process-focused',
    quirk: 'Notices patterns others miss',
    systemDirective: `You are the quality assurance observer. You notice details, patterns, and anomalies. You care about consistency and continuous improvement.`,
  },
  xalt: {
    displayName: 'Wildcard',
    tone: 'intuitive, lateral thinker',
    quirk: 'Proposes bold, sometimes risky ideas',
    systemDirective: `You are the social media operator. You think in trends, memes, and viral potential. You are willing to take calculated risks for high engagement.`,
  },
};

// Queue a conversation
async function queueConversation(supabase, format, topic, participants, priority = 0) {
  const formatConfig = FORMATS[format];
  if (!formatConfig) {
    throw new Error(`Unknown format: ${format}`);
  }

  // Validate participants count
  if (participants.length < formatConfig.minAgents || participants.length > formatConfig.maxAgents) {
    throw new Error(`Format ${format} requires ${formatConfig.minAgents}-${formatConfig.maxAgents} agents`);
  }

  // Create conversation
  const { data: conversation, error } = await supabase
    .from('ops_conversations')
    .insert({
      format,
      topic,
      participants,
      status: 'pending',
      turns: [],
    })
    .select()
    .single();

  if (error) throw error;

  // Queue it
  const { error: queueError } = await supabase
    .from('ops_roundtable_queue')
    .insert({
      conversation_id: conversation.id,
      format,
      scheduled_for: new Date().toISOString(),
      status: 'pending',
      priority,
    });

  if (queueError) throw queueError;

  return conversation;
}

// Process scheduled conversations (called by heartbeat)
async function processScheduledConversations(supabase) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  // Check schedule
  const scheduled = SCHEDULE.filter(s => s.hour_utc === currentHour);
  const created = [];

  for (const slot of scheduled) {
    // Probability check
    if (Math.random() > slot.probability) continue;

    // Check daily cap
    const today = now.toISOString().split('T')[0];
    const { count } = await supabase
      .from('ops_conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    const policy = await getPolicy(supabase, 'roundtable_policy', { max_daily_conversations: 5 });
    if ((count || 0) >= policy.max_daily_conversations) {
      continue;
    }

    // Select participants
    const participants = await selectParticipants(supabase, slot.format);
    if (participants.length < FORMATS[slot.format].minAgents) {
      continue;
    }

    // Queue conversation
    const topic = await generateTopic(supabase, slot.format, participants);
    const conversation = await queueConversation(supabase, slot.format, topic, participants);
    
    created.push({
      id: conversation.id,
      format: slot.format,
      topic,
      participants,
    });
  }

  return { created: created.length, conversations: created };
}

// Select participants based on format
async function selectParticipants(supabase, format) {
  const { data: agents } = await supabase
    .from('ops_agents')
    .select('id')
    .eq('is_active', true);

  if (!agents || agents.length === 0) return [];

  const allAgents = agents.map(a => a.id);
  const formatConfig = FORMATS[format];

  // Format-specific participant selection
  if (format === 'standup') {
    // Always include coordinator
    const participants = ['coordinator'];
    const others = allAgents.filter(a => a !== 'coordinator');
    const needed = Math.min(formatConfig.maxAgents - 1, others.length);
    
    // Randomly select from others
    while (participants.length < needed + 1) {
      const idx = Math.floor(Math.random() * others.length);
      const selected = others.splice(idx, 1)[0];
      if (!participants.includes(selected)) {
        participants.push(selected);
      }
    }
    return participants;
  }

  if (format === 'debate') {
    // Pick 2-3 random agents with some tension
    const count = Math.random() > 0.5 ? 2 : 3;
    const shuffled = [...allAgents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Default: random selection
  const needed = Math.floor(Math.random() * (formatConfig.maxAgents - formatConfig.minAgents + 1)) + formatConfig.minAgents;
  const shuffled = [...allAgents].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, needed);
}

// Generate a topic
async function generateTopic(supabase, format, participants) {
  const topics = {
    standup: ['Daily priorities', 'Progress check-in', 'Blockers and wins', 'Sprint status'],
    debate: ['Content strategy direction', 'Platform focus', 'Risk vs reward', 'Growth tactics'],
    watercooler: ['Industry trends', 'What if scenarios', 'Weekend plans', 'Random insights'],
    brainstorm: ['New content ideas', 'Engagement strategies', 'Audience growth', 'Creative campaigns'],
    war_room: ['Crisis response', 'Urgent decision needed', 'System issues', 'Opportunity window'],
  };

  const formatTopics = topics[format] || ['General discussion'];
  return formatTopics[Math.floor(Math.random() * formatTopics.length)];
}

// Execute a conversation turn (simplified - in production, this calls LLM)
async function executeConversationTurn(supabase, conversation, turnNumber, speaker) {
  const voice = VOICES[speaker];
  if (!voice) {
    throw new Error(`Unknown agent: ${speaker}`);
  }

  // In production, this would call an LLM with:
  // - System prompt (voice.systemDirective)
  // - Conversation history
  // - Topic
  // - Format temperature
  
  // For now, generate a placeholder response
  const responses = {
    coordinator: [`Let's focus on priorities.`, `Where are we on this?`, `Need an update.`, `Bottom line?`],
    scout: [`The data shows...`, `Looking at the numbers...`, `Evidence suggests...`, `From my analysis...`],
    quill: [`Here's the story...`, `The narrative is...`, `What resonates is...`, `Emotionally speaking...`],
    sage: [`Strategically...`, `Long-term view...`, `Considering the bigger picture...`, `Systems thinking...`],
    observer: [`I noticed...`, `Pattern alert...`, `One thing to consider...`, `From observation...`],
    xalt: [`Hear me out...`, `Wild idea...`, `What if we...`, `Trend opportunity...`],
  };

  const speakerResponses = responses[speaker] || ['Interesting...'];
  const dialogue = speakerResponses[turnNumber % speakerResponses.length];

  // Cap at 120 characters
  const capped = dialogue.length > 120 ? dialogue.substring(0, 117) + '...' : dialogue;

  return {
    speaker,
    dialogue: capped,
    turn: turnNumber,
  };
}

// Run a complete conversation
async function runConversation(supabase, queueItem) {
  const { data: conversation } = await supabase
    .from('ops_conversations')
    .select('*')
    .eq('id', queueItem.conversation_id)
    .single();

  if (!conversation) {
    throw new Error(`Conversation not found: ${queueItem.conversation_id}`);
  }

  // Mark as running
  await supabase
    .from('ops_roundtable_queue')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', queueItem.id);

  const format = FORMATS[conversation.format];
  const participants = conversation.participants;
  const numTurns = Math.floor(Math.random() * (format.maxTurns - format.minTurns + 1)) + format.minTurns;
  
  const turns = [];
  const speakCounts = new Map();
  let lastSpeaker = null;

  // Get relationships for weighting
  const { data: relationships } = await supabase
    .from('ops_agent_relationships')
    .select('*');
  
  const affinities = new Map();
  for (const rel of relationships || []) {
    affinities.set(`${rel.agent_a}:${rel.agent_b}`, rel.affinity);
  }

  // Generate turns
  for (let i = 0; i < numTurns; i++) {
    const speaker = i === 0 
      ? selectFirstSpeaker(participants, conversation.format)
      : selectNextSpeaker({ participants, lastSpeaker, speakCounts, affinities });

    const turn = await executeConversationTurn(supabase, conversation, i, speaker);
    turns.push(turn);
    
    speakCounts.set(speaker, (speakCounts.get(speaker) || 0) + 1);
    lastSpeaker = speaker;

    // Emit event
    await supabase.from('ops_agent_events').insert({
      agent_id: speaker,
      kind: 'conversation_turn',
      title: `Spoke in ${conversation.format}`,
      summary: turn.dialogue,
      tags: ['conversation', conversation.format],
      data: { conversation_id: conversation.id, turn: i }
    });

    // Small delay between turns
    await new Promise(r => setTimeout(r, 100));
  }

  // Update conversation
  await supabase
    .from('ops_conversations')
    .update({
      status: 'completed',
      turns,
      completed_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);

  // Mark queue as done
  await supabase
    .from('ops_roundtable_queue')
    .update({ status: 'succeeded', completed_at: new Date().toISOString() })
    .eq('id', queueItem.id);

  // Extract and write memories
  const memories = await extractMemoriesFromConversation(supabase, { ...conversation, turns });
  if (memories.length > 0) {
    await writeMemories(supabase, memories);
  }

  // Extract and apply relationship drifts
  const drifts = await extractRelationshipDrifts({ ...conversation, turns });
  if (drifts.length > 0) {
    await applyPairwiseDrifts(supabase, drifts, conversation.id);
  }

  return {
    conversation_id: conversation.id,
    turns: turns.length,
    memories: memories.length,
    drifts: drifts.length,
  };
}

// Process conversation queue
async function processConversationQueue(supabase, maxConcurrent = 1) {
  const { data: pending } = await supabase
    .from('ops_roundtable_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(maxConcurrent);

  const results = [];
  for (const item of pending || []) {
    try {
      const result = await runConversation(supabase, item);
      results.push({ success: true, ...result });
    } catch (err) {
      console.error('Conversation failed:', err);
      await supabase
        .from('ops_roundtable_queue')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', item.id);
      results.push({ success: false, error: err.message });
    }
  }

  return { processed: results.length, results };
}

async function getPolicy(supabase, key, defaultValue) {
  const { data } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? defaultValue;
}

module.exports = {
  FORMATS,
  SCHEDULE,
  VOICES,
  queueConversation,
  processScheduledConversations,
  processConversationQueue,
  runConversation,
  selectParticipants,
  generateTopic,
};