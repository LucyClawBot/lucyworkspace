-- LucyWorkspace — Complete VoxYZ Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- CORE TABLES
-- ============================================

-- Proposals waiting for approval
CREATE TABLE IF NOT EXISTS ops_mission_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('api', 'trigger', 'reaction')),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approved missions
CREATE TABLE IF NOT EXISTS ops_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES ops_mission_proposals(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Executable steps
CREATE TABLE IF NOT EXISTS ops_mission_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES ops_missions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  params JSONB DEFAULT '{}',
  worker TEXT,
  reserved_at TIMESTAMPTZ,
  last_error TEXT,
  output TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event stream
CREATE TABLE IF NOT EXISTS ops_agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration policies
CREATE TABLE IF NOT EXISTS ops_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reaction queue
CREATE TABLE IF NOT EXISTS ops_agent_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES ops_agent_events(id),
  pattern JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Execution logs
CREATE TABLE IF NOT EXISTS ops_action_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES ops_mission_steps(id),
  output TEXT,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- TRIGGER & REACTION TABLES
-- ============================================

-- Track trigger fires for cooldowns
CREATE TABLE IF NOT EXISTS ops_trigger_fires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id TEXT NOT NULL,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Track reaction cooldowns
CREATE TABLE IF NOT EXISTS ops_reaction_cooldowns (
  pattern_id TEXT PRIMARY KEY,
  last_triggered TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_proposals_status ON ops_mission_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_agent ON ops_mission_proposals(agent);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON ops_mission_proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_missions_status ON ops_missions(status);
CREATE INDEX IF NOT EXISTS idx_steps_status ON ops_mission_steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_mission ON ops_mission_steps(mission_id);
CREATE INDEX IF NOT EXISTS idx_steps_worker ON ops_mission_steps(worker);
CREATE INDEX IF NOT EXISTS idx_events_created ON ops_agent_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON ops_agent_events(type);
CREATE INDEX IF NOT EXISTS idx_events_source ON ops_agent_events(source);
CREATE INDEX IF NOT EXISTS idx_trigger_fires_id ON ops_trigger_fires(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_fires_time ON ops_trigger_fires(fired_at);

-- ============================================
-- DEFAULT POLICIES
-- ============================================

INSERT INTO ops_policy (key, value) VALUES
  ('auto_approve', '{"enabled": true, "allowed_step_kinds": ["draft_tweet", "crawl", "analyze", "write_content", "review_content"], "allowed_agents": ["scout", "sage", "quill", "observer"]}'),
  ('x_daily_quota', '{"limit": 8}'),
  ('draft_quota', '{"daily_limit": 20}'),
  ('content_quota', '{"daily_limit": 5}'),
  ('crawl_quota', '{"hourly_limit": 20}'),
  ('agent_daily_limits', '{"scout": 30, "sage": 20, "quill": 25, "observer": 20, "xalt": 15, "minion": 10, "default": 50}'),
  ('worker_policy', '{"enabled": true, "max_concurrent": 3}'),
  ('reaction_matrix', '{"patterns": [{"id": "tweet_analyze", "source": "xalt", "tags": ["tweet", "posted"], "target": "scout", "type": "analyze_viral_content", "probability": 0.3, "cooldown": 120}, {"id": "failure_diagnose", "source": "*", "tags": ["mission", "failed"], "target": "sage", "type": "diagnose_failure", "probability": 1.0, "cooldown": 60}, {"id": "content_review", "source": "quill", "tags": ["content", "published"], "target": "observer", "type": "review_content", "probability": 0.5, "cooldown": 30}, {"id": "intel_report", "source": "scout", "tags": ["intel", "gathered"], "target": "sage", "type": "strategic_analysis", "probability": 0.4, "cooldown": 60}]}'),
  ('x_autopost', '{"enabled": false}'),
  ('deploy_policy', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ENABLE RLS (Optional - for production)
-- ============================================
-- Uncomment if you need Row Level Security
-- ALTER TABLE ops_mission_proposals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ops_missions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ops_mission_steps ENABLE ROW LEVEL SECURITY;
