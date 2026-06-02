'use strict';

const express = require('express');
const router  = express.Router();
const { loadCache }           = require('../services/questCache.js');
const { generateDailyQuests } = require('../services/questGenerator.js');

router.get('/', async (req, res) => {
  try {
    let data = loadCache();
    if (!data) data = await generateDailyQuests();

    const now             = new Date();
    const midnight        = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const secondsSinceMid = (now - midnight) / 1000;
    const dayProgress     = (secondsSinceMid / 86400) * 100;
    const timerBarWidth   = Math.round(100 - dayProgress);
    const hoursLeft       = 24 - now.getHours();
    const hoursLabel      = hoursLeft === 1 ? 'bell' : 'bells';
    const hoursLeftText   = `The ink fades in approximately ${hoursLeft} ${hoursLabel}...`;

    res.render('quest', {
      quests:       data.quests,
      comedic_note: data.comedic_note ?? 'No notes today.',
      timerBarWidth,
      hoursLeftText,
      api_failed:   !data.api_online,
    });
  } catch (err) {
    console.error('[/quest] Unhandled error:', err);
    res.status(500).send('The quest board is on fire. Literally. Come back later.');
  }
});

module.exports = router;
