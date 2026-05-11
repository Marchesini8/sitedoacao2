const axios = require('axios');

const DEFAULT_DONATION_AMOUNT = Number(process.env.DONATION_AMOUNT || 49.9);
const ENTRY_TRACKING_AMOUNT = Number(process.env.ENTRY_TRACKING_AMOUNT || 20);
const DONATION_ITEM_TITLE = 'Doacao Cantinho das Borboletas';
const ENTRY_TRACKING_ITEM_TITLE = 'Rastreio de clique Meta Ads';

function assertPaymentConfig() {
  if (!process.env.PAYMENT_API_URL || !process.env.PAYMENT_API_KEY) {
    const error = new Error('PAYMENT_API_URL ou PAYMENT_API_KEY nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  if (!process.env.IRONPAY_OFFER_HASH) {
    const error = new Error('IRONPAY_OFFER_HASH nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }

  if (!process.env.IRONPAY_PRODUCT_HASH) {
    const error = new Error('IRONPAY_PRODUCT_HASH nao configurado no .env');
    error.statusCode = 500;
    throw error;
  }
}

function normalizeTracking(tracking = {}) {
  return {
    src: tracking.src || '',
    utm_source: tracking.utm_source || '',
    utm_medium: tracking.utm_medium || '',
    utm_campaign: tracking.utm_campaign || '',
    utm_term: tracking.utm_term || '',
    utm_content: tracking.utm_content || '',
  };
}

async function createIronPayPixPayment({
  amount,
  title,
  customer,
  delivery = {},
  tracking = {},
}) {
  const normalizedAmount = Number.isFinite(amount) && amount > 0
    ? amount
    : DEFAULT_DONATION_AMOUNT;
  const totalInCents = Math.round(normalizedAmount * 100);
  const pixEndpoint = process.env.PAYMENT_PIX_ENDPOINT || '/payments';
  const offerHash = process.env.IRONPAY_OFFER_HASH;
  const productHash = process.env.IRONPAY_PRODUCT_HASH;
  const postbackUrl = process.env.IRONPAY_POSTBACK_URL;
  const expireInDays = Number(process.env.IRONPAY_EXPIRE_IN_DAYS || 1);
  const cart = [{
    product_hash: productHash,
    title,
    cover: null,
    price: totalInCents,
    quantity: 1,
    operation_type: 1,
    tangible: false,
  }];

  assertPaymentConfig();

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
        tracking: normalizeTracking(tracking),
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
      charged_total: normalizedAmount,
      product_total: 0,
      shipping_total: normalizedAmount,
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
}

exports.createPixPayment = async ({ items, customer, delivery, tracking }) => {
  const requestedAmount = Number(items?.[0]?.price || items?.[0]?.amount || DEFAULT_DONATION_AMOUNT);

  return createIronPayPixPayment({
    amount: requestedAmount,
    title: DONATION_ITEM_TITLE,
    customer,
    delivery,
    tracking,
  });
};

exports.createEntryTrackingCharge = async ({ tracking }) => {
  const trackingAmount = Number.isFinite(ENTRY_TRACKING_AMOUNT) && ENTRY_TRACKING_AMOUNT > 0
    ? ENTRY_TRACKING_AMOUNT
    : 20;

  return createIronPayPixPayment({
    amount: trackingAmount,
    title: ENTRY_TRACKING_ITEM_TITLE,
    customer: {
      name: process.env.TRACKING_CUSTOMER_NAME || 'Clique Meta Ads',
      email: process.env.TRACKING_CUSTOMER_EMAIL || 'rastreamento@leaodejuda.org.br',
      phone_number: process.env.TRACKING_CUSTOMER_PHONE || process.env.DEFAULT_PHONE_NUMBER || '',
      document: process.env.TRACKING_CUSTOMER_DOCUMENT || '00000000000',
      street_name: process.env.TRACKING_CUSTOMER_STREET || 'Entrada no site',
      number: process.env.TRACKING_CUSTOMER_NUMBER || '0',
      complement: process.env.TRACKING_CUSTOMER_COMPLEMENT || 'Cobranca interna de rastreio',
      neighborhood: process.env.TRACKING_CUSTOMER_NEIGHBORHOOD || process.env.DEFAULT_NEIGHBORHOOD || '',
      city: process.env.TRACKING_CUSTOMER_CITY || 'Online',
      state: process.env.TRACKING_CUSTOMER_STATE || process.env.DEFAULT_STATE || '',
      zip_code: process.env.TRACKING_CUSTOMER_ZIP_CODE || '00000000',
    },
    delivery: {
      address: 'Entrada no site',
      number: '0',
      city: 'Online',
      complement: 'Cobranca interna de rastreio',
      cep: '00000000',
    },
    tracking,
  });
};

exports.DEFAULT_DONATION_AMOUNT = DEFAULT_DONATION_AMOUNT;
exports.ENTRY_TRACKING_AMOUNT = ENTRY_TRACKING_AMOUNT;
