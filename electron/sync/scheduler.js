const { runMidnightPull } = require('./engine');
const { logSync } = require('./logger');

let intervalId = null;

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function scheduleMidnightPull() {
  if (intervalId) clearTimeout(intervalId);

  const delay = msUntilNextMidnight();
  logSync('pull', 'scheduled', `Next midnight pull in ${Math.round(delay / 60000)} minutes`);

  intervalId = setTimeout(async () => {
    await runMidnightPull();
    scheduleMidnightPull();
  }, delay);
}

module.exports = { scheduleMidnightPull };
