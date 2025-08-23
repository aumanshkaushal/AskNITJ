import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(key => key);
if (GEMINI_API_KEYS.length === 0) {
  console.error('No valid Gemini API keys found in environment variables');
  process.exit(1);
}

const requestTimestamps = GEMINI_API_KEYS.reduce((acc, key) => {
  acc[key] = { timestamps: [], requestCount: 0, lastReset: Date.now() };
  return acc;
}, {});
const REQUESTS_PER_MINUTE = 5;
const REQUEST_WINDOW_MS = 60 * 1000;
const TOTAL_REQUEST_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
let currentKeyIndex = 0;

async function getNextApiKey() {
  const now = Date.now();
  let attempts = 0;

  while (attempts < GEMINI_API_KEYS.length) {
    const key = GEMINI_API_KEYS[currentKeyIndex];
    const tracker = requestTimestamps[key];

    if (now - tracker.lastReset >= DAY_MS) {
      tracker.requestCount = 0;
      tracker.timestamps = [];
      tracker.lastReset = now;
      console.log(`Reset request count for API key ${currentKeyIndex + 1} for new day`);
    }

    tracker.timestamps = tracker.timestamps.filter(ts => now - ts < REQUEST_WINDOW_MS);

    if (tracker.requestCount >= TOTAL_REQUEST_LIMIT) {
      console.warn(`API key ${currentKeyIndex + 1} has reached the daily limit of ${TOTAL_REQUEST_LIMIT} requests`);
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
      attempts++;
      continue;
    }

    if (tracker.timestamps.length < REQUESTS_PER_MINUTE) {
      tracker.timestamps.push(now);
      tracker.requestCount++;
      const selectedKey = key;
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
      console.log(`Using API key ${currentKeyIndex} (Request ${tracker.requestCount}/${TOTAL_REQUEST_LIMIT})`);
      return [currentKeyIndex, selectedKey];
    }

    const oldestTimestamp = tracker.timestamps[0];
    const timeUntilNextMinute = REQUEST_WINDOW_MS - (now - oldestTimestamp);
    console.warn(`API key ${currentKeyIndex + 1} rate limit reached (${tracker.timestamps.length}/${REQUESTS_PER_MINUTE}). Waiting ${timeUntilNextMinute}ms`);
    await new Promise(resolve => setTimeout(resolve, timeUntilNextMinute));

    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    attempts++;
  }

  const nextReset = Math.min(...Object.values(requestTimestamps).map(t => t.lastReset + DAY_MS));
  const timeUntilNextReset = nextReset - now;
  if (timeUntilNextReset > 0) {
    console.error(`All API keys exhausted. Waiting ${timeUntilNextReset}ms until next daily reset`);
    await new Promise(resolve => setTimeout(resolve, timeUntilNextReset));
    return getNextApiKey();
  }

  console.error('All API keys are rate-limited or exhausted');
  return null;
}

export { getNextApiKey };