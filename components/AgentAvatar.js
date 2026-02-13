// components/AgentAvatar.js
// SVG Avatars for each agent - no external API needed

const AVATAR_SVGS = {
  lucy: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lucyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#8b5cf6"/>
        <stop offset="100%" style="stop-color:#ec4899"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#lucyGrad)"/>
    <circle cx="35" cy="40" r="8" fill="#fff"/>
    <circle cx="65" cy="40" r="8" fill="#fff"/>
    <path d="M 30 65 Q 50 80 70 65" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M 50 20 L 50 5" stroke="#fff" stroke-width="3" opacity="0.5"/>
    <circle cx="50" cy="12" r="4" fill="#fff" opacity="0.5"/>
  </svg>`,
  
  assistant: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="assistGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3b82f6"/>
        <stop offset="100%" style="stop-color:#06b6d4"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#assistGrad)"/>
    <rect x="30" y="35" width="40" height="30" rx="5" fill="#fff" opacity="0.9"/>
    <circle cx="40" cy="50" r="3" fill="#3b82f6"/>
    <circle cx="50" cy="50" r="3" fill="#3b82f6"/>
    <circle cx="60" cy="50" r="3" fill="#3b82f6"/>
    <path d="M 35 70 L 50 80 L 65 70" stroke="#fff" stroke-width="3" fill="none" opacity="0.6"/>
  </svg>`,
  
  coordinator: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#dc2626"/>
    <rect x="25" y="30" width="50" height="8" rx="2" fill="#fff"/>
    <rect x="25" y="46" width="50" height="8" rx="2" fill="#fff"/>
    <rect x="25" y="62" width="50" height="8" rx="2" fill="#fff"/>
    <circle cx="50" cy="50" r="52" stroke="#dc2626" stroke-width="2" fill="none" opacity="0.3"/>
  </svg>`,
  
  scout: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#0891b2"/>
    <circle cx="50" cy="45" r="20" fill="#fff" opacity="0.2"/>
    <circle cx="50" cy="45" r="15" fill="none" stroke="#fff" stroke-width="2"/>
    <line x1="50" y1="30" x2="50" y2="20" stroke="#fff" stroke-width="2"/>
    <line x1="50" y1="70" x2="50" y2="60" stroke="#fff" stroke-width="2"/>
    <line x1="35" y1="45" x2="25" y2="45" stroke="#fff" stroke-width="2"/>
    <line x1="75" y1="45" x2="65" y2="45" stroke="#fff" stroke-width="2"/>
    <circle cx="50" cy="45" r="3" fill="#fff"/>
  </svg>`,
  
  quill: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#ca8a04"/>
    <path d="M 35 65 Q 50 30 65 65" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 65 65 L 70 70" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="35" cy="35" r="5" fill="#fff" opacity="0.6"/>
    <circle cx="65" cy="30" r="4" fill="#fff" opacity="0.4"/>
  </svg>`,
  
  sage: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#059669"/>
    <path d="M 50 25 L 50 75 M 35 40 L 50 25 L 65 40" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="50" cy="60" r="10" fill="#fff" opacity="0.3"/>
    <circle cx="50" cy="60" r="5" fill="#fff"/>
  </svg>`,
  
  observer: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#db2777"/>
    <ellipse cx="50" cy="50" rx="20" ry="15" fill="#fff" opacity="0.9"/>
    <circle cx="50" cy="50" r="8" fill="#db2777"/>
    <circle cx="50" cy="50" r="3" fill="#fff"/>
    <path d="M 75 50 L 85 50" stroke="#fff" stroke-width="2"/>
    <circle cx="87" cy="50" r="3" fill="#fff" opacity="0.6"/>
  </svg>`,
  
  xalt: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#ea580c"/>
    <path d="M 35 35 L 65 65 M 65 35 L 35 65" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="30" cy="30" r="4" fill="#fff" opacity="0.5"/>
    <circle cx="70" cy="30" r="4" fill="#fff" opacity="0.5"/>
    <circle cx="30" cy="70" r="4" fill="#fff" opacity="0.5"/>
    <circle cx="70" cy="70" r="4" fill="#fff" opacity="0.5"/>
  </svg>`
};

export default function AgentAvatar({ agentId, size = 50, className = '' }) {
  const svg = AVATAR_SVGS[agentId] || AVATAR_SVGS.assistant;
  
  return (
    <div 
      className={`agent-avatar ${className}`}
      style={{ 
        width: size, 
        height: size,
        display: 'inline-block'
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}