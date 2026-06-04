'use strict';

const fs              = require('fs');
const path            = require('path');
const { GoogleGenAI } = require('@google/genai');
const { NPCS, LEVEL_DISTRIBUTION, GRIEVANCES, POOLS } = require('../data/npcs.js');
const { saveCache, todayStr } = require('./questCache.js');

const PROMPT_FILE = path.resolve(__dirname, '../../prompts/quest-generation.txt');

function loadPromptTemplate() {
  try {
    return fs.readFileSync(PROMPT_FILE, 'utf8');
  } catch (err) {
    throw new Error(`Could not load prompt template from ${PROMPT_FILE}: ${err.message}`);
  }
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleN(arr, n) { return shuffle(arr).slice(0, n); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildFallbackQuests() {
  return LEVEL_DISTRIBUTION.map((lvl) => {
    const pool     = POOLS[lvl];
    const template = randomChoice(pool);
    const npc      = randomChoice(NPCS);
    const fullText = `${npc.name} the ${npc.race} ${template}`;

    const low = template.toLowerCase();
    let q_type;
    if (/clear|cull|slay|hunt|defeat|purge/.test(low))              q_type = 'Extermination';
    else if (/find|recover|search|retrieve|locate|fetch/.test(low)) q_type = 'Locating';
    else if (/need|bring|collect|harvest|gather/.test(low))         q_type = 'Gathering';
    else if (/escort|guard|protect/.test(low))                      q_type = 'Escort';
    else                                                             q_type = 'Bounty';

    return {
      level:     '*'.repeat(lvl),
      type:      q_type,
      text:      fullText,
      signature: npc.name,
      gold:      `${randInt(lvl * 5, lvl * 80)} GP`,
    };
  });
}

async function buildAIQuests() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai         = new GoogleGenAI({ apiKey });
  const todaysNpcs = sampleN(NPCS, 8);
  const npcContext = todaysNpcs.map(n => `- ${n.name} (${n.race}, ${n.vibe})`).join('\n');
  const prompt     = loadPromptTemplate().replace('{{NPC_CONTEXT}}', npcContext);

  console.log('[generator] Prompt loaded from:', PROMPT_FILE);

  const response = await ai.models.generateContent({
    model:    'gemini-2.5-flash',
    contents: prompt,
  });

  const text       = response.text ?? '';
  const lines      = text.trim().split('\n');
  const quests     = [];
  const validTypes = new Set(['Extermination', 'Gathering', 'Locating', 'Escort', 'Sabotage', 'Bounty']);

  for (const line of lines) {
    if (!line.includes('|') || quests.length >= 8) continue;
    const [rawType, rawText] = line.split('|', 2);
    if (!rawText) continue;

    const qType = validTypes.has(rawType.trim()) ? rawType.trim() : 'Bounty';
    const lvl   = LEVEL_DISTRIBUTION[quests.length];
    const match = todaysNpcs.find(n => rawText.includes(n.name)) ?? todaysNpcs[quests.length];

    quests.push({
      level:     '*'.repeat(lvl),
      type:      qType,
      text:      rawText.trim().slice(0, 135),
      signature: match.name,
      gold:      `${randInt(lvl * 10, lvl * 80)} GP`,
    });
  }

  if (quests.length !== 8) throw new Error(`AI returned ${quests.length} quests, expected 8`);
  return quests;
}

async function generateDailyQuests() {
  let quests       = [];
  let apiOnline    = false;
  let comedic_note = '';

  try {
    console.log('[generator] Calling Gemini AI...');
    quests    = await buildAIQuests();
    apiOnline = true;
    console.log('[generator] AI quests generated successfully.');
  } catch (err) {
    console.warn('[generator] AI failed, using fallback pool:', err.message);
    quests = buildFallbackQuests();
  }

  comedic_note = randomChoice(GRIEVANCES);

  const data = { date: todayStr(), quests, comedic_note, api_online: apiOnline };
  saveCache(data);
  return data;
}

module.exports = { generateDailyQuests };
