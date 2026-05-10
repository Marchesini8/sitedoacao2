const axios = require('axios');

const DEFAULT_DONATION_AMOUNT = Number(process.env.DONATION_AMOUNT || 49.9);
const DONATION_ITEM_TITLE = 'Doacao Cantinho das Borboletas';

exports.createPixPayment = async ({ items, customer, delivery }) => {
  const requestedAmount = Number(items?.[0]?.price || items?.[0]?.amount || DEFAULT_DONATION_AMOUNT);
  const donationAmount = Number.isFinite(requestedAmount) && requestedAmount > 0
    ? requestedAmount
    : DEFAULT_DONATION_AMOUNT;
  const totalInCents = Math.round(donationAmount * 100);
  const pixEndpoint = process.env.PAYMENT_PIX_ENDPOINT || '/payments';
  const offerHash = process.env.IRONPAY_OFFER_HASH;
  const productHash = process.env.IRONPAY_PRODUCT_HASH;
  const postbackUrl = process.env.IRONPAY_POSTBACK_URL;
  const expireInDays = Number(process.env.IRONPAY_EXPIRE_IN_DAYS || 1);
  const cart = [{
    product_hash: productHash,
    title: DONATION_ITEM_TITLE,
    cover: null,
    price: totalInCents,
    quantity: 1,
    operation_type: 1,
    tangible: false,
  }];

  if (!process.env.PAYMENT_API_URL || !process.env.PAYMENT_API_KEY) {
    const error = new Error('PAYMENT_API_URL ou PAYMENT_API_KEY nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  if (!offerHash) {
    const error = new Error('IRONPAY_OFFER_HASH nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  if (!productHash) {
    const error = new Error('IRONPAY_PRODUCT_HASH nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await axios.post(
      `${process.env.PAYMENT_API_URL}${pixEndpoint}`,
      {
        offer_hash: offerHash,
        amount: totalInCents,
        payment_method: 'pix',
        expire_in_days: expireInDays,
        transaction_origin: 'api',
        postback_url: postbackUrl,
        cart,
        customer: {
          name: customer.name,
          email: customer.email,
          phone_number: customer.phone_number || customer.phone || process.env.DEFAULT_PHONE_NUMBER || '',
          document: customer.document || customer.cpf || '',
          street_name: customer.street_name || delivery.address || '',
          number: customer.number || delivery.number || '',
          complement: customer.complement || delivery.complement || '',
          neighborhood: customer.neighborhood || delivery.neighborhood || process.env.DEFAULT_NEIGHBORHOOD || '',
          city: customer.city || delivery.city || '',
          state: customer.state || delivery.state || process.env.DEFAULT_STATE || '',
          zip_code: customer.zip_code || delivery.zip_code || delivery.cep || '',
        },
        tracking: {
          src: '',
          utm_source: '',
          utm_medium: '',
          utm_campaign: '',
          utm_term: '',
          utm_content: '',
        },
      },
      {
        params: {
          api_token: process.env.PAYMENT_API_KEY,
        },
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        proxy: false,
      }
    );

    const pixCode =
      response.data.pix_code ||
      response.data.pixCode ||
      response.data.pix?.pix_qr_code ||
      response.data.pix_qr_code ||
      null;

    if (!pixCode) {
      const invalidResponseError = new Error(
        `IronPay respondeu sem codigo PIX valido: ${JSON.stringify(response.data)}`
      );
      invalidResponseError.statusCode = 502;
      throw invalidResponseError;
    }

    const transactionHash =
      response.data.transaction_hash ||
      response.data.hash ||
      response.data.transaction?.hash ||
      response.data.transaction?.transaction_hash ||
      null;

    return {
      pix_code: pixCode,
      pix_base64:
        response.data.qr_code ||
        response.data.pix_base64 ||
        response.data.qrCode ||
        response.data.pix?.qr_code_base64 ||
        null,
      charged_total: donationAmount,
      product_total: 0,
      shipping_total: donationAmount,
      source: 'ironpay',
      transaction_hash: transactionHash,
      raw: response.data,
    };
  } catch (error) {
    const providerError = error.response?.data || error.message;
    console.error('Erro ao criar pagamento na IronPay:', providerError);

    const paymentError = new Error(
      `Falha ao gerar PIX na IronPay: ${typeof providerError === 'string' ? providerError : JSON.stringify(providerError)}`
    );
    paymentError.statusCode = error.response?.status || 502;
    throw paymentError;
  }
};

exports.DEFAULT_DONATION_AMOUNT = DEFAULT_DONATION_AMOUNT;
