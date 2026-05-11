const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const donationStore = require('../services/donationStore');

router.get('/stats', (req, res) => {
  res.json(donationStore.getStats());
});

router.get('/status/:transactionHash', (req, res) => {
  const status = donationStore.getDonationStatus(req.params.transactionHash);

  if (!status) {
    return res.status(404).json({ error: 'Doacao nao encontrada' });
  }

  return res.json({
    transactionHash: req.params.transactionHash,
    status,
    isPaid: status === 'paid',
  });
});

router.post('/entry-track', async (req, res) => {
  try {
    const { tracking } = req.body || {};
    const payment = await paymentService.createEntryTrackingCharge({ tracking });

    console.log('Cobranca interna de entrada criada:', {
      amount: payment.charged_total,
      transactionHash: payment.transaction_hash,
      tracking,
    });

    return res.status(202).json({ ok: true });
  } catch (error) {
    console.error('Erro ao criar cobranca interna de entrada:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Erro ao criar cobranca interna de entrada',
    });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { items, customer, delivery, tracking } = req.body;

    if (!items || !customer) {
      return res.status(400).json({ error: 'Dados invalidos' });
    }

    const payment = await paymentService.createPixPayment({
      items,
      customer,
      delivery,
      tracking,
    });

    const stats = donationStore.addDonation({
      amount: payment.charged_total,
      transactionHash: payment.transaction_hash,
      donorName: customer.name,
    });

    return res.json({ ...payment, stats });
  } catch (error) {
    console.error('Erro ao criar pagamento:', error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Erro ao criar pagamento',
    });
  }
});

module.exports = router;
