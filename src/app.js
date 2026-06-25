'use strict';

require('dotenv').config();

const express    = require('express');
const { engine } = require('express-handlebars');
const path       = require('path');
const cron       = require('node-cron');

const questsRouter            = require('./routes/quests.js');
const initiativeRouter        = require('./routes/initiative.js');
const { generateDailyQuests } = require('./services/questGenerator.js');
const penaltyRoutes           = require('./routes/penalty');
const app  = express();
const PORT = process.env.PORT ?? 3000;

// --- Templating ---
app.engine('hbs', engine({
  extname:       'hbs',
  defaultLayout: 'main',
  layoutsDir:    path.join(__dirname, '../views/layouts'),
  // Add this property to register the custom stringify helper:
  helpers: {
    json: function (context) {
      return JSON.stringify(context);
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../views'));

// --- Static files ---
app.use('/static', express.static(path.join(__dirname, '../public')));

// --- Routes ---
app.get('/', (req, res) => res.render('home'));
app.use('/quest',      questsRouter);
app.use('/initiative', initiativeRouter);
app.use('/penalty', penaltyRoutes);
// --- Daily midnight quest regeneration ---
cron.schedule('0 0 * * *', async () => {
  console.log('[cron] Midnight — regenerating daily quests...');
  try {
    await generateDailyQuests();
    console.log('[cron] Done.');
  } catch (err) {
    console.error('[cron] Failed:', err.message);
  }
});

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Adventurers Compendium running on http://0.0.0.0:${PORT}`);
});
