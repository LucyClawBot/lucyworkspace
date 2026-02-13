-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ddszgovshrmpaavmrkpo/sql

-- Initialize Ops Schema for Autonomous Agent System

-- Proposals waiting for approval
CREATE TABLE IF NOT EXISTS ops_mission_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('api', 'trigger', 'reaction')),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposals_status ON ops_mission_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON ops_mission_proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_missions_status ON ops_missions(status);
CREATE INDEX IF NOT EXISTS idx_steps_status ON ops_mission_steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_mission ON ops_mission_steps(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON ops_agent_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON ops_agent_events(type);

-- Default policies
INSERT INTO ops_policy (key, value) VALUES
  ('auto_approve', '{"enabled": true, "allowed_step_kinds": ["draft_tweet", "crawl", "analyze", "write_content"]}'),
  ('x_daily_quota', '{"limit": 8}'),
  ('worker_policy', '{"enabled": true, "max_concurrent": 3}'),
  ('reaction_matrix', '{"patterns": []}')
ON CONFLICT (key) DO NOTHING;
