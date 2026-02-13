#!/usr/bin/env node
// workers/mission-worker.mjs
// Ejecuta steps de misiones (crawl, analyze, write_content, draft_tweet)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.WORKER_ID || 'lucy-macbook';
const POLL_INTERVAL_MS = 10000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STEP_HANDLERS = {
  async crawl(step) {
    console.log(`  🔍 Crawling: ${step.params?.target || 'general'}`);
    // Simulated crawl
    await new Promise(r => setTimeout(r, 2000));
    return { 
      success: true, 
      data: { 
        target: step.params?.target,
        findings: ['trend_1', 'trend_2', 'trend_3'],
        crawled_at: new Date().toISOString()
      }
    };
  },

  async analyze(step) {
    console.log(`  🧠 Analyzing: ${step.params?.analysis_type || 'general'}`);
    // Simulated analysis
    await new Promise(r => setTimeout(r, 3000));
    return { 
      success: true, 
      data: { 
        type: step.params?.analysis_type,
        insights: ['insight_1', 'insight_2'],
        confidence: 0.75
      }
    };
  },

  async write_content(step) {
    console.log(`  ✍️ Writing: ${step.params?.output_format || 'content'}`);
    // Simulated content writing
    await new Promise(r => setTimeout(r, 2500));
    const content = `Generated ${step.params?.output_format} content at ${new Date().toISOString()}`;
    return { 
      success: true, 
      data: { 
        format: step.params?.output_format,
        content: content,
        word_count: content.length
      }
    };
  },

  async draft_tweet(step) {
    console.log(`  🐦 Drafting tweet`);
    // Simulated tweet drafting
    await new Promise(r => setTimeout(r, 1500));
    const tweets = [
      "AI agents working together achieve more than any single agent alone. 🤖🤝",
      "The future of work is collaborative intelligence. #AI #Agents",
      "Just watched my agents have a standup meeting. Surreal. 💼",
      "Multi-agent systems: where emergent behavior meets intentional design.",
    ];
    const tweet = tweets[Math.floor(Math.random() * tweets.length)];
    return { 
      success: true, 
      data: { 
        tweet,
        character_count: tweet.length,
        drafted_at: new Date().toISOString()
      }
    };
  },

  async post_tweet(step) {
    console.log(`  📤 Posting tweet (simulated)`);
    // Simulated posting - in production, this would call Twitter API
    await new Promise(r => setTimeout(r, 2000));
    const mockTweetId = `mock_${Date.now()}`;
    return { 
      success: true, 
      data: { 
        tweet_id: mockTweetId,
        posted_at: new Date().toISOString(),
        note: 'SIMULATED - no actual Twitter API call'
      }
    };
  },
};

async function executeStep(step) {
  const handler = STEP_HANDLERS[step.kind];
  if (!handler) {
    throw new Error(`Unknown step kind: ${step.kind}`);
  }
  return await handler(step);
}

async function processStep(step) {
  console.log(`⚡ Executing step ${step.id} (${step.kind})`);
  
  const startTime = Date.now();
  
  try {
    // Execute the step
    const result = await executeStep(step);
    
    // Update step as succeeded
    await supabase.from('ops_mission_steps').update({
      status: 'succeeded',
      result: result.data,
      updated_at: new Date().toISOString(),
    }).eq('id', step.id);

    // Record action run
    await supabase.from('ops_action_runs').insert({
      step_id: step.id,
      action: step.kind,
      output: result.data,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Emit event
    await supabase.from('ops_agent_events').insert({
      agent_id: 'system',
      kind: 'step_succeeded',
      title: `Step completed: ${step.kind}`,
      summary: `${step.kind} executed successfully`,
      tags: ['step', 'success', step.kind],
    });

    console.log(`  ✅ Completed in ${Date.now() - startTime}ms`);
    return { success: true };

  } catch (err) {
    console.error(`  ❌ Failed:`, err.message);
    
    await supabase.from('ops_mission_steps').update({
      status: 'failed',
      last_error: err.message,
      updated_at: new Date().toISOString(),
    }).eq('id', step.id);

    await supabase.from('ops_action_runs').insert({
      step_id: step.id,
      action: step.kind,
      error: err.message,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    await supabase.from('ops_agent_events').insert({
      agent_id: 'system',
      kind: 'step_failed',
      title: `Step failed: ${step.kind}`,
      summary: err.message,
      tags: ['step', 'failure', step.kind],
    });

    return { success: false, error: err.message };
  }
}

async function finalizeMission(missionId) {
  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('status')
    .eq('mission_id', missionId);
  
  if (!steps?.length) return;

  const allCompleted = steps.every(s => s.status === 'succeeded' || s.status === 'failed');
  if (!allCompleted) return;

  const anyFailed = steps.some(s => s.status === 'failed');
  
  await supabase.from('ops_missions').update({
    status: anyFailed ? 'failed' : 'succeeded',
    completed_at: new Date().toISOString(),
  }).eq('id', missionId);

  await supabase.from('ops_agent_events').insert({
    agent_id: 'system',
    kind: anyFailed ? 'mission_failed' : 'mission_succeeded',
    title: anyFailed ? 'Mission failed' : 'Mission succeeded',
    summary: `Mission ${missionId} ${anyFailed ? 'failed' : 'succeeded'}`,
    tags: ['mission', anyFailed ? 'failed' : 'succeeded'],
  });

  console.log(`📋 Mission ${missionId} ${anyFailed ? 'failed' : 'succeeded'}`);
}

async function claimAndExecute() {
  // Find next queued step
  const { data: steps } = await supabase
    .from('ops_mission_steps')
    .select('*, mission:ops_missions!inner(status)')
    .eq('status', 'queued')
    .eq('mission.status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1);

  if (!steps?.length) return null;
  const step = steps[0];

  // Atomically claim the step
  const { data: claimed } = await supabase
    .from('ops_mission_steps')
    .update({
      status: 'running',
      reserved_by: WORKER_ID,
      reserved_at: new Date().toISOString(),
    })
    .eq('id', step.id)
    .eq('status', 'queued')
    .select()
    .maybeSingle();

  if (!claimed) {
    console.log('  ⚠️ Step already claimed by another worker');
    return null;
  }

  // Execute
  await processStep(claimed);
  
  // Finalize mission if done
  await finalizeMission(step.mission_id);
  
  return step;
}

async function main() {
  console.log(`🤖 Mission Worker starting... (${WORKER_ID})`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
  
  let consecutiveErrors = 0;
  
  while (true) {
    try {
      const processed = await claimAndExecute();
      if (processed) {
        consecutiveErrors = 0;
      }
    } catch (err) {
      console.error('Worker error:', err);
      consecutiveErrors++;
      
      if (consecutiveErrors > 5) {
        console.error('Too many consecutive errors, backing off...');
        await new Promise(r => setTimeout(r, 60000));
        consecutiveErrors = 0;
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch(console.error);