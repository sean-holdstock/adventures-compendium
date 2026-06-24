'use strict';

const express = require('express');
const router  = express.Router();
const fs      = require('fs').promises;
const fssync  = require('fs'); // Used for synchronous directory/existence checks
const path    = require('path');
const { GoogleGenAI } = require('@google/genai');

// Match your quest configuration paths
const CACHE_FILE  = path.resolve(__dirname, '../../services/penalty-cache.json');
const PROMPT_FILE = path.resolve(__dirname, '../../prompts/penalty_prompt.txt');

// Helper to get today's date string (YYYY-MM-DD)
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Helper to read file cache safely
async function loadFileCache() {
  try {
    if (fssync.existsSync(CACHE_FILE)) {
      const raw = await fs.readFile(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      // If the cached file matches today's date, use it!
      if (data.date === todayStr()) {
        return data.penalties;
      }
    }
  } catch (err) {
    console.error('[penaltyCache] Error reading cache file:', err.message);
  }
  return null;
}

// Helper to save file cache safely
async function saveFileCache(penalties) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fssync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
    
    const payload = { date: todayStr(), penalties };
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.log('[penaltyCache] Saved new daily penalties cache file.');
  } catch (err) {
    console.error('[penaltyCache] Error writing cache file:', err.message);
  }
}

// --- Main Route ---
router.get('/', async (req, res) => {
  try {
    // 1. Try to load today's penalties from the local JSON file first
    let penalties = await loadFileCache();

    // 2. If cache doesn't exist or is from a previous day, fetch from Gemini
    if (!penalties) {
      try {
        console.log('[penalties] Cache miss/expired. Requesting fresh dynamic penalties...');
        const systemPrompt = await fs.readFile(PROMPT_FILE, 'utf8');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: { responseMimeType: "application/json" }
        });

        penalties = JSON.parse(response.text.trim());
        
        // Save to file cache so subsequent refreshes today use 0 tokens
        await saveFileCache(penalties);

      } catch (aiError) {
        console.error("Spire Alert: Failed fetching new arcane scrolls from Gemini:", aiError);
        // Fallback: attempts to read expired cache data if API is down
        if (fssync.existsSync(CACHE_FILE)) {
          const raw = await fs.readFile(CACHE_FILE, 'utf8');
          penalties = JSON.parse(raw).penalties;
        }
      }
    }

    // 3. Render out the view layout
    res.render('penalty', { 
      penalties: penalties,
      using_archived: !penalties 
    });

  } catch (globalError) {
    console.error("Critical Failure Page Routing Error:", globalError);
    res.render('penalty', { penalties: null });
  }
});

module.exports = router;