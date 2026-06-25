'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.resolve(__dirname, '../../data/penalty-cache.json');

function todayStr() {
  return new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data.date === todayStr()) {
        return data;
      }
    }
  } catch (err) {
    console.error('[penaltyCache] Error reading cache file:', err.message);
  }
  return null;
}

function saveCache(data) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[penaltyCache] Saved new daily penalties cache.');
  } catch (err) {
    console.error('[penaltyCache] Error writing cache file:', err.message);
  }
}

module.exports = { loadCache, saveCache, todayStr };