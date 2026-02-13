-- 001_core_tables.sql
-- Core tables for the multi-agent system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. POLICY TABLE (Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_policy (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ops_agents (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    tone TEXT,
    quirk TEXT,
    system_directive TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. MISSION PROPOSALS
-- ============================================
CREATE TABLE IF NOT EXISTS ops_mission_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    agent_id TEXT NOT NULL REFERENCES ops_agents(id),
    title TEXT NOT NULL,
    proposed_steps JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proposals_status ON ops_mission_proposals(status);
CREATE INDEX idx_proposals_agent ON ops_mission_proposals(agent_id);
CREATE INDEX idx_proposals_created ON ops_mission_proposals(created_at);

-- ============================================
-- 4. MISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS ops_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES ops_mission_proposals(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'running', 'succeeded', 'failed')),
    created_by TEXT NOT NULL REFERENCES ops_agents(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_missions_status ON ops_missions(status);
CREATE INDEX idx_missions_created ON ops_missions(created_at);

-- ============================================
-- 5. MISSION STEPS
-- ============================================
CREATE TABLE IF NOT EXISTS ops_mission_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES ops_missions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('draft_tweet', 'post_tweet', 'crawl', 'analyze', 'write_content', 'deploy')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    params JSONB DEFAULT '{}',
    result JSONB,
    last_error TEXT,
    worker TEXT,
    reserved_at TIMESTAMPTZ,
    reserved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_steps_mission ON ops_mission_steps(mission_id);
CREATE INDEX idx_steps_status ON ops_mission_steps(status);
CREATE INDEX idx_steps_kind ON ops_mission_steps(kind);
CREATE INDEX idx_steps_reserved ON ops_mission_steps(reserved_at);

-- ============================================
-- 6. AGENT EVENTS (Event Stream)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_agent_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES ops_agents(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_agent ON ops_agent_events(agent_id);
CREATE INDEX idx_events_kind ON ops_agent_events(kind);
CREATE INDEX idx_events_created ON ops_agent_events(created_at DESC);
CREATE INDEX idx_events_tags ON ops_agent_events USING gin(tags);

-- ============================================
-- 7. ACTION RUNS (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_action_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_id UUID REFERENCES ops_mission_steps(id),
    action TEXT NOT NULL,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_runs_action ON ops_action_runs(action);
CREATE INDEX idx_runs_completed ON ops_action_runs(completed_at);

-- ============================================
-- 8. TRIGGER FIRES
-- ============================================
CREATE TABLE IF NOT EXISTS ops_trigger_fires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_id TEXT NOT NULL,
    fired_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fires_trigger ON ops_trigger_fires(trigger_id);
CREATE INDEX idx_fires_time ON ops_trigger_fires(fired_at);

-- ============================================
-- 9. REACTION COOLDOWNS
-- ============================================
CREATE TABLE IF NOT EXISTS ops_reaction_cooldowns (
    pattern_id TEXT PRIMARY KEY,
    last_triggered TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (optional, but good practice)
ALTER TABLE ops_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_mission_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_mission_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_agent_events ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (replace with proper policies in production)
CREATE POLICY "Allow all" ON ops_policy FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_agents FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_mission_proposals FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_missions FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_mission_steps FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_agent_events FOR ALL USING (true);