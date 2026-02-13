#!/usr/bin/env node
// workers/roundtable-worker.mjs
// Orquesta conversaciones + extrae memorias + iniciativas

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.WORKER_ID || 'lucy-macbook';
const POLL_INTERVAL_MS = 15000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Voices
const VOICES = {
  coordinator: { displayName: 'Boss', tone: 'direct, results-oriented', systemDirective: `You are the project manager. Speak in short, direct sentences. Cut through fluff.` },
  scout: { displayName: 'Analyst', tone: 'measured, data-driven', systemDirective: `You are the data analyst. Ground opinions in data. Be skeptical but fair.` },
  quill: { displayName: 'Writer', tone: 'emotional, narrative-focused', systemDirective: `You are the content creator. Think in stories and emotional resonance.` },
  sage: { displayName: 'Strategist', tone: 'thoughtful, big-picture', systemDirective: `You are the strategic advisor. Think in systems and long-term consequences.` },
  observer: { displayName: 'Observer', tone: 'detail-oriented', systemDirective: `You are the quality observer. Notice patterns others miss.` },
  xalt: { displayName: 'Wildcard', tone: 'intuitive, lateral thinker', systemDirective: `You are the social media operator. Think in trends and viral potential.` },
};

const FORMATS = {
  standup: { minTurns: 6, maxTurns: 12, temperature: 0.6 },
  debate: { minTurns: 6, maxTurns: 10, temperature: 0.8 },
  watercooler: { minTurns: 2, maxTurns: 5, temperature: 0.9 },
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function selectNextSpeaker(participants, lastSpeaker, speakCounts, affinities) {
  const weights = participants.map(agent => {
    if (agent === lastSpeaker) return 0;
    let weight = 1.0;
    if (lastSpeaker && affinities) {
      const key = [agent, lastSpeaker].sort().join(':');
      const affinity = affinities.get(key) || 0.5;
      weight += affinity * 0.6;
    }
    const count = speakCounts.get(agent) || 0;
    weight -= count * 0.15;
    weight += (Math.random() * 0.4 - 0.2);
    return Math.max(0.1, weight);
  });
  
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < participants.length; i++) {
    random -= weights[i];
    if (random <= 0) return participants[i];
  }
  return participants[participants.length - 1];
}

function selectFirstSpeaker(participants, format) {
  if (format === 'standup' && participants.includes('coordinator')) {
    return 'coordinator';
  }
  return participants[Math.floor(Math.random() * participants.length)];
}

async function generateTurn(speaker, topic, history, format) {
  const voice = VOICES[speaker];
  const responses = {
    coordinator: [`Let's focus on priorities.`, `Where are we on ${topic}?`, `Bottom line?`, `Need an update.`],
    scout: [`Data shows ${topic}...`, `Looking at the numbers...`, `Evidence suggests...`, `Analysis indicates...`],
    quill: [`The story here is...`, `What resonates about ${topic}...`, `The narrative suggests...`, `Emotionally speaking...`],
    sage: [`Strategically, ${topic}...`, `Long-term view:...`, `Bigger picture...`, `Systems thinking...`],
    observer: [`I noticed ${topic}...`, `Pattern alert...`, `One thing to consider...`, `From observation...`],
    xalt: [`Hear me out on ${topic}...`, `Wild idea...`, `What if we...`, `Trend opportunity...`],
  };
  const speakerResponses = responses[speaker] || ['Interesting...'];
  const dialogue = speakerResponses[history.length % speakerResponses.length];
  return { speaker, dialogue: dialogue.length > 120 ? dialogue.substring(0, 117) + '...' : dialogue, turn: history.length };
}

async function extractMemories(conversation, turns) {
  const memories = [];
  for (const turn of turns) {
    const content = turn.dialogue?.toLowerCase() || '';
    if (content.includes('found') || content.includes('discovered')) {
      memories.push({
        agent_id: turn.speaker,
        type: 'insight',
        content: `Noted: ${turn.dialogue}`,
        confidence: 0.65,
        tags: ['conversation', 'insight'],
        source_trace_id: `conv:${conversation.id}:turn:${turn.turn}`
      });
    }
  }
  return memories.filter(m => m.confidence >= 0.55).slice(0, 6);
}

async function extractDrifts(turns) {
  const drifts = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const current = turns[i];
    const next = turns[i + 1];
    const nextText = next.dialogue?.toLowerCase() || '';
    const agreement = ['agree', 'exactly', 'yes', 'right'].some(s => nextText.includes(s));
    const disagreement = ['disagree', 'but', 'however'].some(s => nextText.includes(s));
    
    if (agreement) {
      drifts.push({ agent_a: current.speaker, agent_b: next.speaker, drift: 0.01 + Math.random() * 0.01, reason: 'Aligned' });
    } else if (disagreement) {
      drifts.push({ agent_a: current.speaker, agent_b: next.speaker, drift: -0.01 - Math.random() * 0.01, reason: 'Disagreed' });
    }
  }
  return drifts;
}

async function runConversation(queueItem) {
  const { data: conversation } = await supabase
    .from('ops_conversations')
    .select('*')
    .eq('id', queueItem.conversation_id)
    .single();

  if (!conversation) return;

  await supabase.from('ops_roundtable_queue').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', queueItem.id);

  const format = FORMATS[conversation.format] || FORMATS.standup;
  const participants = conversation.participants;
  const numTurns = Math.floor(Math.random() * (format.maxTurns - format.minTurns + 1)) + format.minTurns;
  
  const turns = [];
  const speakCounts = new Map();
  let lastSpeaker = null;

  const { data: relationships } = await supabase.from('ops_agent_relationships').select('*');
  const affinities = new Map();
  for (const rel of relationships || []) {
    affinities.set(`${rel.agent_a}:${rel.agent_b}`, rel.affinity);
  }

  for (let i = 0; i < numTurns; i++) {
    const speaker = i === 0 ? selectFirstSpeaker(participants, conversation.format) : selectNextSpeaker(participants, lastSpeaker, speakCounts, affinities);
    const turn = await generateTurn(speaker, conversation.topic, turns, format);
    turns.push(turn);
    speakCounts.set(speaker, (speakCounts.get(speaker) || 0) + 1);
    lastSpeaker = speaker;

    await supabase.from('ops_agent_events').insert({
      agent_id: speaker,
      kind: 'conversation_turn',
      title: `Spoke in ${conversation.format}`,
      summary: turn.dialogue,
      tags: ['conversation', conversation.format],
    });

    await sleep(3000 + Math.random() * 5000);
  }

  await supabase.from('ops_conversations').update({ status: 'completed', turns, completed_at: new Date().toISOString() }).eq('id', conversation.id);
  await supabase.from('ops_roundtable_queue').update({ status: 'succeeded', completed_at: new Date().toISOString() }).eq('id', queueItem.id);

  // Extract memories
  const memories = await extractMemories(conversation, turns);
  for (const mem of memories) {
    const { data: existing } = await supabase.from('ops_agent_memory').select('id').eq('source_trace_id', mem.source_trace_id).maybeSingle();
    if (!existing) {
      await supabase.from('ops_agent_memory').insert(mem);
    }
  }

  // Apply relationship drifts
  const drifts = await extractDrifts(turns);
  for (const { agent_a, agent_b, drift, reason } of drifts) {
    const [a, b] = [agent_a, agent_b].sort();
    const clamped = Math.max(-0.03, Math.min(0.03, drift));
    const { data: rel } = await supabase.from('ops_agent_relationships').select('*').eq('agent_a', a).eq('agent_b', b).single();
    if (rel) {
      const newAffinity = Math.max(0.10, Math.min(0.95, rel.affinity + clamped));
      const driftLog = [...(rel.drift_log || []).slice(-19), { drift: clamped, reason, at: new Date().toISOString() }];
      await supabase.from('ops_agent_relationships').update({ affinity: newAffinity, drift_log: driftLog, total_interactions: rel.total_interactions + 1 }).eq('id', rel.id);
    }
  }

  console.log(`✅ Conversation ${conversation.id} completed: ${turns.length} turns, ${memories.length} memories, ${drifts.length} drifts`);
}

async function processInitiatives() {
  const { data: pending } = await supabase
    .from('ops_initiative_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  for (const item of pending || []) {
    await supabase.from('ops_initiative_queue').update({ status: 'processing' }).eq('id', item.id);
    
    // Generate initiative proposal
    const topics = ['content strategy', 'engagement tactics', 'competitor analysis', 'trend opportunities'];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    
    await supabase.from('ops_mission_proposals').insert({
      source: 'initiative',
      agent_id: item.agent_id,
      title: `${item.agent_id} initiative: ${topic}`,
      proposed_steps: [{ kind: 'analyze', params: { topic } }],
      status: 'pending',
    });

    await supabase.from('ops_initiative_queue').update({ status: 'completed', processed_at: new Date().toISOString(), result: { topic } }).eq('id', item.id);
    console.log(`✅ Initiative processed for ${item.agent_id}: ${topic}`);
  }
}

async function main() {
  console.log(`🎭 Roundtable Worker starting... (${WORKER_ID})`);
  
  while (true) {
    try {
      // Process conversation queue
      const { data: pending } = await supabase
        .from('ops_roundtable_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);

      if (pending?.length > 0) {
        await runConversation(pending[0]);
      }

      // Process initiatives
      await processInitiatives();

    } catch (err) {
      console.error('Worker error:', err);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch(console.error);