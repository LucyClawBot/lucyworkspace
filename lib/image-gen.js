// lib/image-gen.js
// Free image generation using Pollinations AI (no API key required)
// Alternative: Hugging Face, DeepAI, Clipdrop

const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt/';
const POLLINATIONS_OPTIONS = {
  width: 1024,
  height: 1024,
  seed: Math.floor(Math.random() * 1000000),
  nologo: true,
  enhance: true
};

// Generate image URL from prompt (returns direct image URL)
function generateImageUrl(prompt, options = {}) {
  const opts = { ...POLLINATIONS_OPTIONS, ...options };
  const encodedPrompt = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: opts.width,
    height: opts.height,
    seed: opts.seed,
    nologo: opts.nologo,
    enhance: opts.enhance
  });
  return `${POLLINATIONS_URL}${encodedPrompt}?${params.toString()}`;
}

// Generate and save image (for Node.js)
async function generateAndSaveImage(prompt, outputPath, options = {}) {
  const fetch = (await import('node-fetch')).default;
  const fs = await import('fs');
  
  const imageUrl = generateImageUrl(prompt, options);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(outputPath, Buffer.from(buffer));
    
    return {
      success: true,
      path: outputPath,
      url: imageUrl,
      prompt,
      size: buffer.byteLength
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      prompt
    };
  }
}

// Profile picture prompts for agents
const AGENT_PFP_PROMPTS = {
  lucy: {
    style: "cyberpunk female CEO, professional portrait, neon lighting, purple and pink gradient background, confident expression, futuristic business attire, high quality digital art",
    color: "purple"
  },
  assistant: {
    style: "friendly AI assistant avatar, minimalist design, soft blue glow, helpful expression, modern interface elements, clean background, digital illustration",
    color: "blue"
  },
  coordinator: {
    style: "project manager avatar, organized, sharp suit, red accent lighting, commanding presence, pixel art style, cyberpunk office background",
    color: "red"
  },
  scout: {
    style: "data analyst character, futuristic goggles, teal holographic displays, curious expression, tech wear, analytical pose, digital art",
    color: "teal"
  },
  quill: {
    style: "creative writer avatar, artistic, flowing ink effects, warm yellow lighting, inspirational pose, bohemian style, magical atmosphere",
    color: "yellow"
  },
  sage: {
    style: "wise strategist, green mystical aura, thoughtful expression, ancient-modern fusion, nature technology blend, ethereal lighting",
    color: "green"
  },
  observer: {
    style: "observant quality inspector, magnifying glass, pink detection beams, detail-oriented, precise, technical gear, vigilant expression",
    color: "pink"
  },
  xalt: {
    style: "wild social media operator, chaotic energy, multiple screens, vibrant colors, adventurous pose, street tech fashion, dynamic composition",
    color: "orange"
  }
};

// Generate profile picture for an agent
async function generateAgentProfile(agentId, outputDir = './public/avatars') {
  const fs = await import('fs');
  const path = await import('path');
  
  const agent = AGENT_PFP_PROMPTS[agentId];
  if (!agent) {
    return { success: false, error: `Unknown agent: ${agentId}` };
  }
  
  // Ensure output directory exists
  await fs.promises.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, `${agentId}-pfp.png`);
  const result = await generateAndSaveImage(agent.style, outputPath, {
    width: 512,
    height: 512,
    seed: Math.floor(Math.random() * 1000000)
  });
  
  return result;
}

// Generate all agent profiles
async function generateAllAgentProfiles(outputDir = './public/avatars') {
  const results = [];
  
  for (const agentId of Object.keys(AGENT_PFP_PROMPTS)) {
    console.log(`🎨 Generating profile for ${agentId}...`);
    const result = await generateAgentProfile(agentId, outputDir);
    results.push({ agent: agentId, ...result });
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return results;
}

// Generate website hero/background image
async function generateHeroImage(outputPath = './public/hero-bg.png') {
  const prompt = "futuristic AI multi-agent system command center, holographic displays, data streams, cyberpunk aesthetic, purple and blue neon lighting, high tech office, cinematic composition, digital art, 4k quality";
  
  return await generateAndSaveImage(prompt, outputPath, {
    width: 1920,
    height: 1080,
    seed: Math.floor(Math.random() * 1000000)
  });
}

// Generate pixel art office scene
async function generatePixelOffice(outputPath = './public/pixel-office.png') {
  const prompt = "pixel art cyberpunk office, 6 characters working at computers, neon lights, retro futuristic, 16-bit style, isometric view, purple and cyan color scheme, cozy atmosphere, detailed environment";
  
  return await generateAndSaveImage(prompt, outputPath, {
    width: 800,
    height: 600,
    seed: 12345 // Consistent seed for pixel art
  });
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'all':
      console.log('🎨 Generating all agent profiles...');
      generateAllAgentProfiles().then(results => {
        console.log('\n✅ Results:');
        results.forEach(r => {
          console.log(`  ${r.agent}: ${r.success ? '✓' : '✗'} ${r.error || ''}`);
        });
      });
      break;
      
    case 'hero':
      console.log('🖼️ Generating hero image...');
      generateHeroImage().then(r => {
        console.log(r.success ? `✅ Saved to ${r.path}` : `❌ Error: ${r.error}`);
      });
      break;
      
    case 'agent':
      const agentId = process.argv[3];
      if (!agentId) {
        console.log('Usage: node image-gen.js agent <agent-id>');
        console.log('Available:', Object.keys(AGENT_PFP_PROMPTS).join(', '));
        process.exit(1);
      }
      console.log(`🎨 Generating profile for ${agentId}...`);
      generateAgentProfile(agentId).then(r => {
        console.log(r.success ? `✅ Saved to ${r.path}` : `❌ Error: ${r.error}`);
      });
      break;
      
    default:
      console.log('🎨 LucyClawBot Image Generator');
      console.log('Usage:');
      console.log('  node image-gen.js all       - Generate all agent profiles');
      console.log('  node image-gen.js hero      - Generate hero image');
      console.log('  node image-gen.js agent <id> - Generate specific agent');
      console.log('\nAvailable agents:', Object.keys(AGENT_PFP_PROMPTS).join(', '));
  }
}

export {
  generateImageUrl,
  generateAndSaveImage,
  generateAgentProfile,
  generateAllAgentProfiles,
  generateHeroImage,
  generatePixelOffice,
  AGENT_PFP_PROMPTS
};