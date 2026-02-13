#!/usr/bin/env node
// scripts/generate-avatars.mjs
// Generate agent profile pictures

import { generateAllAgentProfiles, generateHeroImage } from '../lib/image-gen.js';

console.log('🎨 Generating images for LucyClawBot...\n');

// Generate all agent profiles
console.log('👥 Agent Profiles:');
const results = await generateAllAgentProfiles('./public/avatars');

results.forEach(r => {
  if (r.success) {
    console.log(`  ✅ ${r.agent}: ${r.path}`);
  } else {
    console.log(`  ❌ ${r.agent}: ${r.error}`);
  }
});

// Generate hero image
console.log('\n🖼️ Hero Image:');
const hero = await generateHeroImage('./public/hero-bg.png');
if (hero.success) {
  console.log(`  ✅ Saved to ${hero.path}`);
} else {
  console.log(`  ❌ Error: ${hero.error}`);
}

console.log('\n✨ Done! Restart your dev server to see changes.');