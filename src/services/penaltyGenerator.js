'use strict';

const fs              = require('fs');
const path            = require('path');
const { GoogleGenAI } = require('@google/genai');
const { NPCS, POOLS } = require('../data/npcs.js'); // Reusing your existing dataset structure
const { loadCache, saveCache, todayStr } = require('./penaltyCache.js');

// Fallback arrays if the AI is offline
const FALLBACK_VIOLATIONS = [
  "Spilling dwarven stout onto the active initiative parchment.",
  "Accidentally casting 'Grease' inside the local tavern kitchen.",
  "Failing to tip the dungeon cleanup crew after a goblin sweep.",
  "Impersonating a member of the City Watch using a poorly painted copper coin."
];

const FALLBACK_PUNISHMENTS = [
  "Must scrub the stable floors without using prestidigitation.",
  "Forced to listen to a 3-hour lecture on local zoning ordinances by the resident wizard.",
  "A fine of 25 Gold Pieces to be deposited directly into the Guild vault.",
  "Stripped of weapon-polishing privileges for the next three calendar days."
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildFallbackPenalties() {
  // Generates 4 fallback entries
  return Array.from({ length: 4 }).map(() => {
    const npc = randomChoice(NPCS);
    return {
      offender: npc.name,
      vibe: npc.vibe,
      violation: randomChoice(FALLBACK_VIOLATIONS),
      punishment: randomChoice(FALLBACK_PUNISHMENTS)
    };
  });
}

async function buildAIPenalties() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });
  
  // Pick some random NPCs to build infractions around
  const randomNpcs = [...NPCS].sort(() => 0.5 - Math.random()).slice(0, 4);
  const contextList = randomNpcs.map(n => `- ${n.name} (Vibe: ${n.vibe})`).join('\n');

  const prompt = `
You are the stern but comical Magistrate of an RPG guild town. 
Generate 4 distinct public safety dynamic penalties/infractions committed by these town characters:
${contextList}

Format your output EXACTLY as 4 lines, with each line split by a pipe character (|) like this:
Character Name | Description of their silly fantasy crime/violation | Their creative, low-stakes punishment

Do not include any numbering, intro, markdown tables, or code block formatting. Just the 4 plain text lines.
  `.trim();

  const response = await ai.models.generateContent({
    model:    'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text ?? '';
  const lines = text.trim().split('\n');
  const penalties = [];

  for (const line of lines) {
    if (!line.includes('|') || penalties.length >= 4) continue;
    const [rawName, rawViolation, rawPunishment] = line.split('|');
    if (!rawPunishment) continue;

    penalties.push({
      offender: rawName.trim(),
      violation: rawViolation.trim(),
      punishment: rawPunishment.trim()
    });
  }

  if (penalties.length === 0) throw new Error('AI response structure was unparsable');
  return penalties;
}

async function getDailyPenalties() {
  // 1. Check Cache First
  const cachedData = loadCache();
  if (cachedData) {
    console.log('[penalties] Serving today\'s penalties straight from cache!');
    return cachedData;
  }

  // 2. If missing or expired, generate anew
  let penalties = [];
  let apiOnline = false;

  try {
    console.log('[penalties] Cache miss/expired. Fetching from Gemini AI...');
    penalties = await buildAIPenalties();
    apiOnline = true;
  } catch (err) {
    console.warn('[penalties] AI invocation failed, resorting to layout fallbacks:', err.message);
    penalties = buildFallbackPenalties();
  }

  const completePayload = {
    date: todayStr(),
    penalties,
    api_online: apiOnline
  };

  // 3. Commit to disk cache
  saveCache(completePayload);
  return completePayload;
}

module.exports = { getDailyPenalties };