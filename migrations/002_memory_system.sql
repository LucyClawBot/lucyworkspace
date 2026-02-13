-- 002_memory_system.sql
-- Agent memory and learning system

-- ============================================
-- 1. AGENT MEMORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ops_agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES ops_agents(id),
    type TEXT NOT NULL CHECK (type IN ('insight', 'pattern', 'strategy', 'preference', 'lesson')),
    content TEXT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.60 CHECK (confidence >= 0 AND confidence <= 1),
    tags TEXT[] DEFAULT '{}',
    source_trace_id TEXT,
    superseded_by UUID REFERENCES ops_agent_memory(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memory_agent ON ops_agent_memory(agent_id);
CREATE INDEX idx_memory_type ON ops_agent_memory(type);
CREATE INDEX idx_memory_confidence ON ops_agent_memory(confidence);
CREATE INDEX idx_memory_created ON ops_agent_memory(created_at);
CREATE INDEX idx_memory_tags ON ops_agent_memory USING gin(tags);
CREATE INDEX idx_memory_trace ON ops_agent_memory(source_trace_id);

-- ============================================
-- 2. AGENT RELATIONSHIPS (Dynamic Affinity)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_agent_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_a TEXT NOT NULL REFERENCES ops_agents(id),
    agent_b TEXT NOT NULL REFERENCES ops_agents(id),
    affinity NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (affinity >= 0.10 AND affinity <= 0.95),
    total_interactions INTEGER DEFAULT 0,
    positive_interactions INTEGER DEFAULT 0,
    negative_interactions INTEGER DEFAULT 0,
    drift_log JSONB DEFAULT '[]',
    UNIQUE(agent_a, agent_b),
    CHECK(agent_a < agent_b) -- Alphabetical ordering ensures uniqueness
);

CREATE INDEX idx_relationships_a ON ops_agent_relationships(agent_a);
CREATE INDEX idx_relationships_b ON ops_agent_relationships(agent_b);
CREATE INDEX idx_relationships_affinity ON ops_agent_relationships(affinity);

-- ============================================
-- 3. CONVERSATIONS (Roundtable)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    format TEXT NOT NULL CHECK (format IN ('standup', 'debate', 'watercooler', 'brainstorm', 'war_room')),
    topic TEXT NOT NULL,
    participants TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    turns JSONB DEFAULT '[]',
    summary TEXT,
    memory_extracted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_status ON ops_conversations(status);
CREATE INDEX idx_conversations_format ON ops_conversations(format);
CREATE INDEX idx_conversations_created ON ops_conversations(created_at);

-- ============================================
-- 4. CONVERSATION QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS ops_roundtable_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ops_conversations(id),
    format TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON ops_roundtable_queue(status);
CREATE INDEX idx_queue_scheduled ON ops_roundtable_queue(scheduled_for);

-- ============================================
-- 5. INITIATIVE QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS ops_initiative_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES ops_agents(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    topic TEXT,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_initiative_status ON ops_initiative_queue(status);
CREATE INDEX idx_initiative_agent ON ops_initiative_queue(agent_id);

-- ============================================
-- 6. TWEET METRICS (For outcome learning)
-- ============================================
CREATE TABLE IF NOT EXISTS ops_tweet_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id TEXT NOT NULL,
    draft_id UUID,
    agent_id TEXT REFERENCES ops_agents(id),
    content TEXT,
    impressions INTEGER DEFAULT 0,
    engagements INTEGER DEFAULT 0,
    engagement_rate NUMERIC(5,4) DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tweet_metrics_agent ON ops_tweet_metrics(agent_id);
CREATE INDEX idx_tweet_metrics_rate ON ops_tweet_metrics(engagement_rate);
CREATE INDEX idx_tweet_metrics_posted ON ops_tweet_metrics(posted_at);

-- Enable RLS
ALTER TABLE ops_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_roundtable_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_initiative_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_tweet_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON ops_agent_memory FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_agent_relationships FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_conversations FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_roundtable_queue FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_initiative_queue FOR ALL USING (true);
CREATE POLICY "Allow all" ON ops_tweet_metrics FOR ALL USING (true);