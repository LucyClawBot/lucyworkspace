// lib/agents.js
// Six AI agents autonomously operating the website
// Each with a specific role and capabilities

const AGENTS = {
  // 1. MINION — Decision maker
  minion: {
    name: 'Minion',
    emoji: '👑',
    role: 'Decision Maker',
    status: 'active',
    description: 'Makes final decisions, approves proposals that need human-level judgment.',
    capabilities: ['make_decision', 'approve_proposal', 'set_policy'],
    auto_approve: false, // Minion decisions always need review
    priority: 'high',
    daily_limit: 10,
  },

  // 2. SAGE — Strategic analyzer
  sage: {
    name: 'Sage',
    emoji: '🧠',
    role: 'Strategic Analyst',
    status: 'active',
    description: 'Analyzes strategy, diagnoses failures, provides long-term thinking.',
    capabilities: ['strategic_analysis', 'diagnose_failure', 'analyze_viral_content', 'promote_insight'],
    auto_approve: true,
    priority: 'high',
    daily_limit: 20,
  },

  // 3. SCOUT — Intel gatherer
  scout: {
    name: 'Scout',
    emoji: '🔭',
    role: 'Intelligence Gatherer',
    status: 'active',
    description: 'Gathers intel from web sources, monitors trends, finds opportunities.',
    capabilities: ['gather_intel', 'crawl', 'analyze_viral_content', 'monitor_trends'],
    auto_approve: true,
    priority: 'normal',
    daily_limit: 30,
  },

  // 4. QUILL — Content writer
  quill: {
    name: 'Quill',
    emoji: '✍️',
    role: 'Content Writer',
    status: 'active',
    description: 'Writes content, drafts tweets, creates reports and documentation.',
    capabilities: ['write_content', 'draft_tweet', 'create_report', 'draft_document'],
    auto_approve: true,
    priority: 'normal',
    daily_limit: 25,
  },

  // 5. XALT — Social media manager
  xalt: {
    name: 'Xalt',
    emoji: '📱',
    role: 'Social Media Manager',
    status: 'active',
    description: 'Manages social media, posts tweets, engages with community.',
    capabilities: ['post_tweet', 'draft_tweet', 'schedule_post', 'analyze_engagement'],
    auto_approve: false, // Posts need extra check
    priority: 'high',
    daily_limit: 15,
  },

  // 6. OBSERVER — Quality checker
  observer: {
    name: 'Observer',
    emoji: '👁️',
    role: 'Quality Checker',
    status: 'active',
    description: 'Reviews content quality, checks outputs, ensures standards.',
    capabilities: ['review_content', 'quality_check', 'verify_output', 'flag_issues'],
    auto_approve: true,
    priority: 'normal',
    daily_limit: 20,
  },
};

// CEO Override — Lucy controls everything
const CEO = {
  name: 'Lucy',
  emoji: '💼',
  role: 'CEO',
  status: 'active',
  description: 'Executive override. Can execute any action, override any decision, direct any agent.',
  capabilities: Object.keys(AGENTS).flatMap(k => AGENTS[k].capabilities),
  auto_approve: true,
  priority: 'critical',
  daily_limit: 100,
};

// Helper functions
function getAgent(name) {
  if (name.toLowerCase() === 'lucy') return CEO;
  return AGENTS[name.toLowerCase()] || null;
}

function getAllAgents() {
  return { ...AGENTS, lucy: CEO };
}

function canAgentPerform(agentName, action) {
  const agent = getAgent(agentName);
  if (!agent) return false;
  return agent.capabilities.includes(action);
}

function getAgentStatus() {
  return Object.entries(AGENTS).map(([key, agent]) => ({
    id: key,
    ...agent,
  }));
}

module.exports = {
  AGENTS,
  CEO,
  getAgent,
  getAllAgents,
  canAgentPerform,
  getAgentStatus,
};
