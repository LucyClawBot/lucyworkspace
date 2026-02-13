-- 003_seed_data.sql
-- Initial data for the multi-agent system

-- ============================================
-- 1. SEED AGENTS (3 to start: coordinator, executor, observer)
-- ============================================
INSERT INTO ops_agents (id, display_name, role, tone, quirk, system_directive) VALUES
('coordinator', 'Boss', 'Project Manager', 'Results-oriented, direct', 'Always asking about progress and deadlines', 
 'You are the project manager. Speak in short, direct sentences. You care about deadlines, priorities, and accountability. Cut through fluff quickly.'),

('scout', 'Analyst', 'Data Analyst', 'Measured, data-driven, cautious', 'Cites numbers before giving opinions',
 'You are the data analyst. Always ground your opinions in data. You push back on gut feelings and demand evidence. You are skeptical but fair.'),

('quill', 'Writer', 'Content Creator', 'Emotional, narrative-focused', 'Turns everything into a story',
 'You are the content creator. You think in narratives and emotional resonance. You ask "what is the story here?" and care about voice and tone.'),

('sage', 'Strategist', 'Strategic Advisor', 'Thoughtful, big-picture oriented', 'Connects everything to long-term goals',
 'You are the strategic advisor. You think in systems and long-term consequences. You ask "how does this fit the bigger picture?" and consider second-order effects.'),

('observer', 'Observer', 'Quality Assurance', 'Detail-oriented, process-focused', 'Notices patterns others miss',
 'You are the quality assurance observer. You notice details, patterns, and anomalies. You care about consistency and continuous improvement.'),

('xalt', 'Wildcard', 'Social Media Ops', 'Intuitive, lateral thinker', 'Proposes bold, sometimes risky ideas',
 'You are the social media operator. You think in trends, memes, and viral potential. You are willing to take calculated risks for high engagement.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. SEED POLICIES
-- ============================================
INSERT INTO ops_policy (key, value) VALUES
('auto_approve', '{"enabled": true, "allowed_step_kinds": ["draft_tweet", "crawl", "analyze", "write_content"], "allowed_agents": ["scout", "sage", "quill", "observer", "coordinator", "xalt"]}'),
('x_daily_quota', '{"limit": 8}'),
('content_quota', '{"daily_limit": 5}'),
('crawl_quota', '{"hourly_limit": 20}'),
('draft_quota', '{"daily_limit": 20}'),
('deploy_policy', '{"enabled": true}'),
('agent_daily_limits', '{"default": 50, "coordinator": 100, "observer": 30}'),
('roundtable_policy', '{"enabled": true, "max_daily_conversations": 5}'),
('memory_influence_policy', '{"enabled": true, "probability": 0.3}'),
('relationship_drift_policy', '{"enabled": true, "max_drift": 0.03}'),
('initiative_policy', '{"enabled": false}'),
('reaction_matrix', '{"patterns": [{"id": "tweet_analyze", "source": "xalt", "tags": ["tweet", "posted"], "target": "scout", "type": "analyze_viral_content", "probability": 0.3, "cooldown": 120}, {"id": "failure_diagnose", "source": "*", "tags": ["mission", "failed"], "target": "sage", "type": "diagnose_failure", "probability": 1.0, "cooldown": 60}, {"id": "content_review", "source": "quill", "tags": ["content", "published"], "target": "observer", "type": "review_content", "probability": 0.5, "cooldown": 30}]}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ============================================
-- 3. SEED RELATIONSHIPS (15 pairs for 6 agents)
-- ============================================
INSERT INTO ops_agent_relationships (agent_a, agent_b, affinity, total_interactions, positive_interactions, negative_interactions) VALUES
-- High trust pairs
('coordinator', 'sage', 0.80, 0, 0, 0),
('observer', 'scout', 0.80, 0, 0, 0),
('quill', 'xalt', 0.70, 0, 0, 0),

-- Medium trust
('coordinator', 'scout', 0.60, 0, 0, 0),
('coordinator', 'quill', 0.60, 0, 0, 0),
('scout', 'sage', 0.60, 0, 0, 0),
('quill', 'sage', 0.60, 0, 0, 0),
('observer', 'sage', 0.60, 0, 0, 0),

-- Tension pairs (for interesting dynamics)
('coordinator', 'xalt', 0.30, 0, 0, 0),
('scout', 'xalt', 0.30, 0, 0, 0),
('observer', 'xalt', 0.40, 0, 0, 0),

-- Neutral
('coordinator', 'observer', 0.50, 0, 0, 0),
('scout', 'quill', 0.50, 0, 0, 0),
('observer', 'quill', 0.50, 0, 0, 0),
('sage', 'xalt', 0.50, 0, 0, 0)
ON CONFLICT (agent_a, agent_b) DO NOTHING;