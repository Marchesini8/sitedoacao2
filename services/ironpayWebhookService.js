function validateWebhookKey(receivedKey) {
  const expectedKey = process.env.IRONPAY_WEBHOOK_SECRET || process.env.PAYMENT_API_KEY;

  if (!expectedKey) {
    const error = new Error('IRONPAY_WEBHOOK_SECRET nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  if (!receivedKey || receivedKey !== expectedKey) {
    const error = new Error('Chave do webhook invalida');
    error.statusCode = 401;
    throw error;
  }
}

function processWebhook(payload) {
  const {
    transaction_hash,
    status,
    amount,
    payment_method,
    paid_at,
  } = payload || {};

  const normalizedAmount = Number(amount);

  if (!transaction_hash || !status || !Number.isFinite(normalizedAmount)) {
    const error = new Error('Payload do webhook invalido');
    error.statusCode = 400;
    throw error;
  }

  const normalizedStatus = String(status).toLowerCase();

  const normalized = {
    transactionHash: transaction_hash,
    status: normalizedStatus,
    amount: normalizedAmount,
    paymentMethod: payment_method || null,
    paidAt: paid_at || null,
    isPaid: ['paid', 'approved', 'completed', 'success'].includes(normalizedStatus),
  };

  console.log('Webhook IronPay recebido:', normalized);

  return normalized;
}

module.exports = {
  validateWebhookKey,
  processWebhook,
};
