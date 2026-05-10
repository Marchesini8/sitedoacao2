const fs = require('fs');
const path = require('path');

const CAMPAIGN_GOAL_AMOUNT = 60250;
const CAMPAIGN_MIN_RAISED = 12976;
const CAMPAIGN_MIN_DONOR_COUNT = 250;
const BASE_RAISED = Math.max(Number(process.env.CAMPAIGN_BASE_RAISED || 0), CAMPAIGN_MIN_RAISED);
const GOAL_AMOUNT = CAMPAIGN_GOAL_AMOUNT;
const BASE_DONOR_COUNT = Math.max(Number(process.env.CAMPAIGN_BASE_DONOR_COUNT || 0), CAMPAIGN_MIN_DONOR_COUNT);
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
  const paidDonations = store.donations.filter((donation) => donation.status !== 'pending');
  const onlineRaised = paidDonations.reduce((total, donation) => total + Number(donation.amount || 0), 0);
  const raised = BASE_RAISED + onlineRaised;

  return {
    baseRaised: BASE_RAISED,
    onlineRaised,
    raised,
    goal: GOAL_AMOUNT,
    percentage: Math.min(100, Math.round((raised / GOAL_AMOUNT) * 100)),
    donationCount: BASE_DONOR_COUNT + paidDonations.length,
  };
}

function addDonation({ amount, transactionHash, donorName }) {
  const store = readStore();
  const normalizedAmount = Number(amount || 0);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return getStats();
  }

  const existingDonation = transactionHash
    ? store.donations.find((donation) => donation.transactionHash === transactionHash)
    : null;

  if (existingDonation) {
    return getStats();
  }

  store.donations.push({
    amount: normalizedAmount,
    transactionHash: transactionHash || null,
    donorName: donorName || null,
    status: transactionHash ? 'pending' : 'paid',
    createdAt: new Date().toISOString(),
  });

  writeStore(store);
  return getStats();
}

function getDonationStatus(transactionHash) {
  const store = readStore();
  const donation = store.donations.find((item) => item.transactionHash === transactionHash);

  return donation ? donation.status || 'paid' : null;
}

function markDonationPaid(transactionHash, paidAt) {
  const store = readStore();
  const donation = store.donations.find((item) => item.transactionHash === transactionHash);

  if (!donation) {
    return { found: false, stats: getStats() };
  }

  donation.status = 'paid';
  donation.paidAt = paidAt || new Date().toISOString();
  writeStore(store);

  return { found: true, stats: getStats() };
}

module.exports = {
  addDonation,
  getDonationStatus,
  getStats,
  markDonationPaid,
};
