/**
 * Payment Gateway Integration Extension
 * Integrates with Xendit & Midtrans for payment processing
 * Supports: Virtual Account, E-Wallet, Retail payments
 */

const crypto = require('crypto');

// Configuration (from environment variables)
const XENDIT_API_KEY = process.env.XENDIT_API_KEY || 'demo_key';
const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || 'demo_token';
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'demo_key';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || 'demo_client';

/**
 * Create Virtual Account Payment
 * Supports: BCA, Mandiri, BNI, BRI, Permata
 */
async function createVirtualAccount(req, db) {
  const { loanId, paymentAmount, bankCode, expiryHours } = req.body;

  if (!loanId || !paymentAmount || !bankCode) {
    return { error: 'Loan ID, payment amount, and bank code required' };
  }

  // Get loan details
  const loanQuery = `
    SELECT l.*, u.full_name, u.phone, u.email
    FROM loans l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `;
  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];

  // Generate external ID
  const externalId = `LOAN-${loan.loan_number}-${Date.now()}`;

  // Calculate expiry
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + (expiryHours || 24));

  // Create VA via Xendit (mock for now)
  const vaResponse = await createXenditVA({
    externalId,
    bankCode,
    name: loan.full_name,
    amount: paymentAmount,
    expiryDate: expiryDate.toISOString(),
    description: `Payment for loan ${loan.loan_number}`
  });

  if (vaResponse.error) {
    return { error: vaResponse.error };
  }

  // Store payment record
  const paymentId = generateId();
  const insertQuery = `
    INSERT INTO payments (
      id, payment_number, loan_id, user_id,
      amount, payment_method, payment_channel,
      va_number, va_bank, va_expiry,
      status, external_id, payment_gateway,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  await db.execute(insertQuery, [
    paymentId,
    `PAY-${Date.now()}`,
    loanId,
    loan.user_id,
    paymentAmount,
    'virtual_account',
    bankCode,
    vaResponse.accountNumber,
    bankCode,
    expiryDate.toISOString(),
    'pending',
    externalId,
    'xendit'
  ]);

  return {
    paymentId,
    vaNumber: vaResponse.accountNumber,
    bank: bankCode,
    amount: paymentAmount,
    expiryDate: expiryDate.toISOString(),
    externalId,
    instructions: getVAInstructions(bankCode, vaResponse.accountNumber, paymentAmount)
  };
}

/**
 * Create E-Wallet Payment
 * Supports: DANA, GoPay, OVO, ShopeePay
 */
async function createEWalletPayment(req, db) {
  const { loanId, paymentAmount, ewalletType, redirectUrl } = req.body;

  if (!loanId || !paymentAmount || !ewalletType) {
    return { error: 'Loan ID, payment amount, and e-wallet type required' };
  }

  // Get loan details
  const loanQuery = `
    SELECT l.*, u.phone
    FROM loans l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `;
  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];
  const externalId = `LOAN-${loan.loan_number}-${Date.now()}`;

  // Create e-wallet charge via Xendit
  const ewalletResponse = await createXenditEWallet({
    externalId,
    amount: paymentAmount,
    phone: loan.phone,
    ewalletType,
    redirectUrl: redirectUrl || 'https://app.kreditku.id/payment/success'
  });

  if (ewalletResponse.error) {
    return { error: ewalletResponse.error };
  }

  // Store payment record
  const paymentId = generateId();
  const insertQuery = `
    INSERT INTO payments (
      id, payment_number, loan_id, user_id,
      amount, payment_method, payment_channel,
      status, external_id, payment_gateway,
      channel_reference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  await db.execute(insertQuery, [
    paymentId,
    `PAY-${Date.now()}`,
    loanId,
    loan.user_id,
    paymentAmount,
    'ewallet',
    ewalletType,
    'pending',
    externalId,
    'xendit',
    ewalletResponse.chargeId
  ]);

  return {
    paymentId,
    checkoutUrl: ewalletResponse.checkoutUrl,
    ewalletType,
    amount: paymentAmount,
    expiresAt: ewalletResponse.expiresAt
  };
}

/**
 * Create Retail Payment (Indomaret/Alfamart)
 */
async function createRetailPayment(req, db) {
  const { loanId, paymentAmount, retailOutlet } = req.body;

  if (!loanId || !paymentAmount || !retailOutlet) {
    return { error: 'Loan ID, payment amount, and retail outlet required' };
  }

  // Get loan details
  const loanQuery = `
    SELECT l.*, u.full_name
    FROM loans l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `;
  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];
  const externalId = `LOAN-${loan.loan_number}-${Date.now()}`;

  // Create retail payment via Xendit
  const retailResponse = await createXenditRetail({
    externalId,
    retailOutlet,
    name: loan.full_name,
    amount: paymentAmount
  });

  if (retailResponse.error) {
    return { error: retailResponse.error };
  }

  // Store payment record
  const paymentId = generateId();
  const insertQuery = `
    INSERT INTO payments (
      id, payment_number, loan_id, user_id,
      amount, payment_method, payment_channel,
      status, external_id, payment_gateway,
      channel_reference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  await db.execute(insertQuery, [
    paymentId,
    `PAY-${Date.now()}`,
    loanId,
    loan.user_id,
    paymentAmount,
    'retail',
    retailOutlet,
    'pending',
    externalId,
    'xendit',
    retailResponse.paymentCode
  ]);

  return {
    paymentId,
    paymentCode: retailResponse.paymentCode,
    retailOutlet,
    amount: paymentAmount,
    expiresAt: retailResponse.expiresAt
  };
}

/**
 * Handle Payment Callback/Webhook from Payment Gateway
 */
async function handlePaymentCallback(req, db) {
  const { gateway, signature, data } = req.body;

  // Verify webhook signature
  const isValid = verifyWebhookSignature(gateway, signature, data);
  if (!isValid) {
    return { error: 'Invalid webhook signature' };
  }

  let externalId, status, paidAmount, paidAt;

  if (gateway === 'xendit') {
    externalId = data.external_id;
    status = mapXenditStatus(data.status);
    paidAmount = data.amount;
    paidAt = data.paid_at || data.updated;
  } else if (gateway === 'midtrans') {
    externalId = data.order_id;
    status = mapMidtransStatus(data.transaction_status);
    paidAmount = parseFloat(data.gross_amount);
    paidAt = data.transaction_time;
  }

  // Find payment record
  const paymentQuery = `
    SELECT p.*, l.user_id, l.outstanding_amount
    FROM payments p
    JOIN loans l ON p.loan_id = l.id
    WHERE p.external_id = ?
  `;
  const payments = await db.query(paymentQuery, [externalId]);

  if (payments.length === 0) {
    return { error: 'Payment not found' };
  }

  const payment = payments[0];

  // Update payment status
  await db.execute(`
    UPDATE payments
    SET status = ?, payment_date = ?, gateway_response = ?
    WHERE id = ?
  `, [status, paidAt, JSON.stringify(data), payment.id]);

  // If payment successful, update loan
  if (status === 'success') {
    await processSuccessfulPayment(db, payment, paidAmount);
  }

  return { success: true, paymentId: payment.id, status };
}

/**
 * Process successful payment
 */
async function processSuccessfulPayment(db, payment, paidAmount) {
  // Update loan outstanding amount
  const updateLoanQuery = `
    UPDATE loans
    SET outstanding_amount = outstanding_amount - ?,
        status = CASE
          WHEN outstanding_amount - ? <= 0 THEN 'paid'
          ELSE status
        END,
        paid_off_date = CASE
          WHEN outstanding_amount - ? <= 0 THEN CURRENT_TIMESTAMP
          ELSE paid_off_date
        END
    WHERE id = ?
  `;
  await db.execute(updateLoanQuery, [paidAmount, paidAmount, paidAmount, payment.loan_id]);

  // Create accounting entry (double-entry bookkeeping)
  await createAccountingEntry(db, {
    type: 'payment_received',
    loanId: payment.loan_id,
    amount: paidAmount,
    paymentId: payment.id
  });

  // Send notification
  await sendPaymentNotification(db, payment, paidAmount);

  // Update payment performance
  await updatePaymentPerformance(db, payment.loan_id);
}

/**
 * Check Payment Status
 */
async function checkPaymentStatus(req, db) {
  const { paymentId } = req.params;

  const query = `
    SELECT 
      p.*,
      l.loan_number,
      u.full_name
    FROM payments p
    JOIN loans l ON p.loan_id = l.id
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;

  const payments = await db.query(query, [paymentId]);

  if (payments.length === 0) {
    return { error: 'Payment not found' };
  }

  const payment = payments[0];

  // If still pending, check with gateway
  if (payment.status === 'pending') {
    const gatewayStatus = await checkGatewayStatus(payment.payment_gateway, payment.external_id);
    
    if (gatewayStatus.status !== payment.status) {
      // Update if status changed
      await db.execute(
        'UPDATE payments SET status = ? WHERE id = ?',
        [gatewayStatus.status, payment.id]
      );
      payment.status = gatewayStatus.status;
    }
  }

  return {
    paymentId: payment.id,
    paymentNumber: payment.payment_number,
    loanNumber: payment.loan_number,
    customerName: payment.full_name,
    amount: payment.amount,
    method: payment.payment_method,
    channel: payment.payment_channel,
    status: payment.status,
    vaNumber: payment.va_number,
    paymentDate: payment.payment_date,
    createdAt: payment.created_at
  };
}

/**
 * Get Payment Methods Available
 */
async function getAvailablePaymentMethods(req, db) {
  const { loanId } = req.query;

  // Get loan amount to determine available methods
  let amount = 0;
  if (loanId) {
    const loanQuery = 'SELECT outstanding_amount FROM loans WHERE id = ?';
    const loans = await db.query(loanQuery, [loanId]);
    if (loans.length > 0) {
      amount = loans[0].outstanding_amount;
    }
  }

  return {
    virtualAccount: {
      available: true,
      banks: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'PERMATA'],
      fee: 0,
      minAmount: 10000,
      maxAmount: 50000000
    },
    ewallet: {
      available: amount <= 10000000, // E-wallet limit 10M
      providers: ['DANA', 'GOPAY', 'OVO', 'SHOPEEPAY'],
      fee: Math.ceil(amount * 0.007), // 0.7% fee
      minAmount: 10000,
      maxAmount: 10000000
    },
    retail: {
      available: amount <= 5000000, // Retail limit 5M
      outlets: ['INDOMARET', 'ALFAMART'],
      fee: 5000,
      minAmount: 10000,
      maxAmount: 5000000
    }
  };
}

// ============ External API Calls (Mock) ============

async function createXenditVA(params) {
  // In production, this would call Xendit API
  if (process.env.NODE_ENV === 'production' && XENDIT_API_KEY !== 'demo_key') {
    // Real Xendit API call
    // const response = await fetch('https://api.xendit.co/callback_virtual_accounts', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(XENDIT_API_KEY + ':').toString('base64')}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(params)
    // });
    // return await response.json();
  }

  // Mock response
  return {
    id: `va_${Date.now()}`,
    externalId: params.externalId,
    bankCode: params.bankCode,
    accountNumber: generateVANumber(params.bankCode),
    name: params.name,
    amount: params.amount,
    expiryDate: params.expiryDate,
    status: 'ACTIVE'
  };
}

async function createXenditEWallet(params) {
  // Mock response
  return {
    id: `ewc_${Date.now()}`,
    externalId: params.externalId,
    chargeId: `charge_${Date.now()}`,
    checkoutUrl: `https://ewallet.xendit.co/checkout/${params.externalId}`,
    amount: params.amount,
    ewalletType: params.ewalletType,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
  };
}

async function createXenditRetail(params) {
  // Mock response
  return {
    id: `ret_${Date.now()}`,
    externalId: params.externalId,
    paymentCode: generateRetailCode(),
    retailOutlet: params.retailOutlet,
    amount: params.amount,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  };
}

async function checkGatewayStatus(gateway, externalId) {
  // Mock check
  return { status: 'pending' };
}

// ============ Helper Functions ============

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateVANumber(bankCode) {
  const prefix = {
    'BCA': '7900',
    'MANDIRI': '8900',
    'BNI': '8800',
    'BRI': '2600',
    'PERMATA': '8800'
  };
  
  const randomDigits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return (prefix[bankCode] || '9900') + randomDigits;
}

function generateRetailCode() {
  return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
}

function verifyWebhookSignature(gateway, signature, data) {
  if (gateway === 'xendit') {
    // Verify Xendit signature
    const computedSignature = crypto
      .createHmac('sha256', XENDIT_CALLBACK_TOKEN)
      .update(JSON.stringify(data))
      .digest('hex');
    return computedSignature === signature;
  } else if (gateway === 'midtrans') {
    // Verify Midtrans signature
    const signatureKey = data.order_id + data.status_code + data.gross_amount + MIDTRANS_SERVER_KEY;
    const computedSignature = crypto.createHash('sha512').update(signatureKey).digest('hex');
    return computedSignature === signature;
  }
  return false;
}

function mapXenditStatus(status) {
  const statusMap = {
    'ACTIVE': 'pending',
    'PENDING': 'pending',
    'PAID': 'success',
    'COMPLETED': 'success',
    'EXPIRED': 'expired',
    'FAILED': 'failed'
  };
  return statusMap[status] || 'pending';
}

function mapMidtransStatus(status) {
  const statusMap = {
    'capture': 'success',
    'settlement': 'success',
    'pending': 'pending',
    'deny': 'failed',
    'cancel': 'cancelled',
    'expire': 'expired'
  };
  return statusMap[status] || 'pending';
}

function getVAInstructions(bankCode, vaNumber, amount) {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);

  const instructions = {
    'BCA': [
      '1. Masuk ke m-BCA atau KlikBCA',
      '2. Pilih m-Transfer > BCA Virtual Account',
      `3. Masukkan nomor VA: ${vaNumber}`,
      `4. Periksa detail pembayaran (${formattedAmount})`,
      '5. Masukkan PIN dan konfirmasi'
    ],
    'MANDIRI': [
      '1. Masuk ke ATM Mandiri atau Livin\' by Mandiri',
      '2. Pilih Bayar/Beli > Multipayment',
      `3. Masukkan nomor VA: ${vaNumber}`,
      '4. Konfirmasi pembayaran'
    ],
    'BNI': [
      '1. Masuk ke BNI Mobile Banking',
      '2. Pilih Transfer > Virtual Account Billing',
      `3. Masukkan nomor VA: ${vaNumber}`,
      '4. Konfirmasi pembayaran'
    ],
    'BRI': [
      '1. Masuk ke BRImo',
      '2. Pilih Pembayaran > BRIVA',
      `3. Masukkan nomor VA: ${vaNumber}`,
      '4. Konfirmasi pembayaran'
    ]
  };

  return instructions[bankCode] || [];
}

async function createAccountingEntry(db, params) {
  // Placeholder - will be implemented in accounting module
  // This creates journal entries for payment received
  return { success: true };
}

async function sendPaymentNotification(db, payment, amount) {
  // Placeholder - calls notification module
  // Send payment confirmation notification
  return { success: true };
}

async function updatePaymentPerformance(db, loanId) {
  // Update loan payment performance metrics
  await db.execute(`
    UPDATE loans
    SET payment_performance = CASE
      WHEN days_past_due = 0 THEN 'excellent'
      WHEN days_past_due <= 3 THEN 'good'
      WHEN days_past_due <= 7 THEN 'fair'
      ELSE 'poor'
    END
    WHERE id = ?
  `, [loanId]);
}

// Export functions
module.exports = {
  createVirtualAccount,
  createEWalletPayment,
  createRetailPayment,
  handlePaymentCallback,
  checkPaymentStatus,
  getAvailablePaymentMethods
};
