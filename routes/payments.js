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

router.post('/checkout', async (req, res) => {
  try {
    const { items, customer, delivery } = req.body;

    if (!items || !customer) {
      return res.status(400).json({ error: 'Dados invalidos' });
    }

    const payment = await paymentService.createPixPayment({
      items,
      customer,
      delivery,
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
