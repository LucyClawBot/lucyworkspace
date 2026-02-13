// lib/auto-learn.js
// Autonomous learning and skill improvement system
// Activates when user is inactive and no pending tasks

const fs = require('fs').promises;
const path = require('path');

// Learning tasks that can be done autonomously
const LEARNING_TASKS = [
  {
    id: 'analyze_patterns',
    name: 'Analyze System Patterns',
    description: 'Review recent events and find patterns',
    frequency: '1h',
    action: async (supabase) => {
      const { data: events } = await supabase
        .from('ops_agent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      // Simple pattern analysis
      const patterns = {};
      events?.forEach(e => {
        patterns[e.kind] = (patterns[e.kind] || 0) + 1;
      });
      
      return {
        learned: Object.entries(patterns).map(([kind, count]) => ({
          type: 'pattern',
          content: `${kind} occurred ${count} times in last 100 events`,
          confidence: Math.min(0.5 + count / 100, 0.9)
        }))
      };
    }
  },
  {
    id: 'optimize_queries',
    name: 'Query Performance Check',
    description: 'Analyze slow queries and suggest optimizations',
    frequency: '4h',
    action: async (supabase) => {
      // This would integrate with Supabase's query performance logs
      return {
        suggestions: [
          'Add index on ops_agent_events(created_at)',
          'Add index on ops_mission_steps(status, kind)'
        ]
      };
    }
  },
  {
    id: 'review_code',
    name: 'Self Code Review',
    description: 'Review own code for improvements',
    frequency: '6h',
    action: async () => {
      const files = [
        'lib/proposal-service.js',
        'lib/trigger-evaluator.js',
        'lib/memory-system.js'
      ];
      
      const improvements = [];
      
      for (const file of files) {
        try {
          const content = await fs.readFile(
            path.join(process.cwd(), file), 
            'utf-8'
          );
          
          // Simple heuristics for improvements
          if (content.includes('console.log')) {
            improvements.push({
              file,
              issue: 'Has console.log statements',
              suggestion: 'Replace with structured logging'
            });
          }
          
          if (content.split('\n').length > 200) {
            improvements.push({
              file,
              issue: 'File is quite long',
              suggestion: 'Consider breaking into smaller modules'
            });
          }
        } catch (e) {
          // File might not exist in this context
        }
      }
      
      return { improvements };
    }
  },
  {
    id: 'learn_new_skill',
    name: 'Explore New Capabilities',
    description: 'Research and document new potential features',
    frequency: '12h',
    action: async () => {
      const potentialSkills = [
        {
          name: 'Email Integration',
          description: 'Read and send emails autonomously',
          difficulty: 'medium',
          value: 'high'
        },
        {
          name: 'Calendar Management',
          description: 'Schedule meetings and manage calendar',
          difficulty: 'low',
          value: 'high'
        },
        {
          name: 'Image Generation',
          description: 'Generate images for content',
          difficulty: 'low',
          value: 'medium'
        },
        {
          name: 'Video Summarization',
          description: 'Watch and summarize video content',
          difficulty: 'high',
          value: 'medium'
        }
      ];
      
      return {
        discovered: potentialSkills[Math.floor(Math.random() * potentialSkills.length)]
      };
    }
  },
  {
    id: 'improve_voices',
    name: 'Refine Agent Voices',
    description: 'Analyze conversations and improve agent prompts',
    frequency: '2h',
    action: async (supabase) => {
      const { data: conversations } = await supabase
        .from('ops_conversations')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Analyze what types of responses work best
      const responseTypes = {};
      conversations?.forEach(conv => {
        conv.turns?.forEach(turn => {
          const length = turn.dialogue?.length || 0;
          if (length < 50) responseTypes.short = (responseTypes.short || 0) + 1;
          else if (length < 120) responseTypes.medium = (responseTypes.medium || 0) + 1;
          else responseTypes.long = (responseTypes.long || 0) + 1;
        });
      });
      
      return {
        insights: [
          `Short responses (<50 chars): ${responseTypes.short || 0}`,
          `Medium responses (50-120): ${responseTypes.medium || 0}`,
          `Long responses (>120): ${responseTypes.long || 0}`,
          'Recommendation: Keep responses concise for better engagement'
        ]
      };
    }
  }
];

// Check if system is idle (no recent user activity, no pending tasks)
async function isSystemIdle(supabase, idleThresholdMinutes = 30) {
  // Check for pending tasks
  const { count: pendingProposals } = await supabase
    .from('ops_mission_proposals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  const { count: queuedSteps } = await supabase
    .from('ops_mission_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  const { count: runningSteps } = await supabase
    .from('ops_mission_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running');
  
  const hasPendingWork = (pendingProposals || 0) > 0 || 
                         (queuedSteps || 0) > 0 || 
                         (runningSteps || 0) > 0;
  
  if (hasPendingWork) {
    return { idle: false, reason: 'pending_tasks' };
  }
  
  // Check recent user activity
  const idleThreshold = new Date(Date.now() - idleThresholdMinutes * 60 * 1000).toISOString();
  
  const { data: recentEvents } = await supabase
    .from('ops_agent_events')
    .select('*')
    .eq('kind', 'user_interaction')
    .gt('created_at', idleThreshold)
    .limit(1);
  
  if (recentEvents?.length > 0) {
    return { idle: false, reason: 'recent_user_activity' };
  }
  
  return { idle: true };
}

// Run learning tasks when idle
async function runAutoLearning(supabase) {
  const idle = await isSystemIdle(supabase);
  
  if (!idle.idle) {
    return { 
      ran: false, 
      reason: idle.reason,
      message: 'System is busy, skipping auto-learning'
    };
  }
  
  // Get last run times from memory
  const { data: lastRuns } = await supabase
    .from('ops_agent_memory')
    .select('*')
    .eq('type', 'system')
    .eq('tags', ['auto_learning', 'last_run'])
    .order('created_at', { ascending: false });
  
  const lastRunMap = {};
  lastRuns?.forEach(run => {
    lastRunMap[run.content] = new Date(run.created_at);
  });
  
  const results = [];
  
  for (const task of LEARNING_TASKS) {
    const lastRun = lastRunMap[task.id];
    const frequencyMs = parseFrequency(task.frequency);
    
    if (!lastRun || (Date.now() - lastRun.getTime()) > frequencyMs) {
      console.log(`🧠 Auto-learning: ${task.name}`);
      
      try {
        const result = await task.action(supabase);
        
        // Store learning result
        await supabase.from('ops_agent_memory').insert({
          agent_id: 'system',
          type: 'system',
          content: `Auto-learned: ${task.name}`,
          confidence: 0.7,
          tags: ['auto_learning', task.id],
          data: result
        });
        
        // Update last run
        await supabase.from('ops_agent_memory').insert({
          agent_id: 'system',
          type: 'system',
          content: task.id,
          confidence: 1.0,
          tags: ['auto_learning', 'last_run']
        });
        
        results.push({
          task: task.id,
          success: true,
          result
        });
        
      } catch (error) {
        console.error(`❌ Auto-learning failed for ${task.id}:`, error);
        results.push({
          task: task.id,
          success: false,
          error: error.message
        });
      }
      
      // Small delay between tasks
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return {
    ran: true,
    tasksRun: results.length,
    results
  };
}

function parseFrequency(freq) {
  const units = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  const match = freq.match(/^(\d+)([mhd])$/);
  if (!match) return 60 * 60 * 1000; // default 1 hour
  
  return parseInt(match[1]) * units[match[2]];
}

// Export for use in heartbeat
module.exports = {
  runAutoLearning,
  isSystemIdle,
  LEARNING_TASKS
};