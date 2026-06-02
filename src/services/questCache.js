'use strict';

const fs   = require('fs');
const path = require('path');

const QUEST_FILE = path.resolve(__dirname, '../../quests.json');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadCache() {
  if (!fs.existsSync(QUEST_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(QUEST_FILE, 'utf8'));
    if (data.date !== todayStr() || !Array.isArray(data.quests) || data.quests.length === 0) {
      console.log('[cache] Stale or empty — will regenerate.');
      return null;
    }
    console.log(`[cache] Loaded ${data.quests.length} quests from cache.`);
    return data;
  } catch (err) {
    console.warn('[cache] Corrupt quests.json — will regenerate.', err.message);
    return null;
  }
}

function saveCache(data) {
  try {
    fs.writeFileSync(QUEST_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[cache] quests.json written.');
  } catch (err) {
    console.error('[cache] Failed to write quests.json:', err.message);
  }
}

module.exports = { loadCache, saveCache, todayStr };
