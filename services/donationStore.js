const fs = require('fs');
const path = require('path');

const BASE_RAISED = Number(process.env.CAMPAIGN_BASE_RAISED || 0);
const GOAL_AMOUNT = Number(process.env.CAMPAIGN_GOAL_AMOUNT || 300000);
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'donations.json');

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ donations: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();

  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(parsed.donations) ? parsed : { donations: [] };
  } catch (error) {
    return { donations: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function getStats() {
  const store = readStore();
  const onlineRaised = store.donations.reduce((total, donation) => total + Number(donation.amount || 0), 0);
  const raised = BASE_RAISED + onlineRaised;

  return {
    baseRaised: BASE_RAISED,
    onlineRaised,
    raised,
    goal: GOAL_AMOUNT,
    percentage: Math.min(100, Math.round((raised / GOAL_AMOUNT) * 100)),
    donationCount: store.donations.length,
  };
}

function addDonation({ amount, transactionHash, donorName }) {
  const store = readStore();
  const normalizedAmount = Number(amount || 0);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return getStats();
  }

  store.donations.push({
    amount: normalizedAmount,
    transactionHash: transactionHash || null,
    donorName: donorName || null,
    createdAt: new Date().toISOString(),
  });

  writeStore(store);
  return getStats();
}

module.exports = {
  addDonation,
  getStats,
};
