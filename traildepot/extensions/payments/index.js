/**
 * Payments Extension for TrailBase
 * Handles payment processing and verification
 */

/**
 * Create payment for loan
 */
export async function createPayment(ctx) {
  const userId = ctx.state.user.id;
  const { loan_id, amount, payment_method } = ctx.request.body;
  
  // Validation
  if (!loan_id || !amount || !payment_method) {
    return ctx.json({ error: 'Missing required fields' }, 400);
  }
  
  // Get loan
  const loan = await ctx.db.get(
    'SELECT * FROM loans WHERE id = ? AND user_id = ?',
    [loan_id, userId]
  );
  
  if (!loan) {
    return ctx.json({ error: 'Loan not found' }, 404);
  }
  
  if (loan.status !== 'active' && loan.status !== 'disbursed') {
    return ctx.json({ error: 'Loan is not active' }, 400);
  }
  
  if (amount > loan.outstanding_amount) {
    return ctx.json({ error: 'Payment amount exceeds outstanding amount' }, 400);
  }
  
  // Generate payment number
  const payment_number = `PAY${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  // Create payment record
  const result = await ctx.db.run(
    `INSERT INTO payments (
      payment_number, loan_id, user_id, amount, payment_method, status
    ) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [payment_number, loan_id, userId, amount, payment_method]
  );
  
  const paymentId = result.lastID;
  
  // In production, integrate with payment gateway here
  // For now, simulate payment processing
  
  // Log audit
  await ctx.db.run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
     VALUES (?, 'create', 'payment', ?, ?)`,
    [userId, paymentId, JSON.stringify({ loan_id, amount, payment_method })]
  );
  
  // Create notification
  await ctx.db.run(
    `INSERT INTO notifications (user_id, type, channel, title, message, data)
     VALUES (?, 'payment_received', 'push', 'Payment Initiated', 
             'Your payment is being processed', ?)`,
    [userId, JSON.stringify({ payment_id: paymentId, payment_number, amount })]
  );
  
  return ctx.json({
    success: true,
    payment_id: paymentId,
    payment_number,
    amount,
    status: 'pending',
    message: 'Payment initiated successfully'
  }, 201);
}

/**
 * Confirm payment (called by payment gateway callback)
 */
export async function confirmPayment(ctx) {
  const { payment_id, external_id, status } = ctx.request.body;
  
  const payment = await ctx.db.get(
    'SELECT * FROM payments WHERE id = ?',
    [payment_id]
  );
  
  if (!payment) {
    return ctx.json({ error: 'Payment not found' }, 404);
  }
  
  // Update payment status
  await ctx.db.run(
    'UPDATE payments SET status = ?, payment_date = CURRENT_TIMESTAMP WHERE id = ?',
    [status, payment_id]
  );
  
  if (status === 'success') {
    // Update loan outstanding amount
    const loan = await ctx.db.get(
      'SELECT outstanding_amount FROM loans WHERE id = ?',
      [payment.loan_id]
    );
    
    const new_outstanding = loan.outstanding_amount - payment.amount;
    const loan_status = new_outstanding <= 0 ? 'paid' : 'active';
    
    await ctx.db.run(
      'UPDATE loans SET outstanding_amount = ?, status = ? WHERE id = ?',
      [new_outstanding, loan_status, payment.loan_id]
    );
    
    // Create notification
    await ctx.db.run(
      `INSERT INTO notifications (user_id, type, channel, title, message, data)
       VALUES (?, 'payment_received', 'push', 'Payment Successful', 
               'Your payment has been received', ?)`,
      [payment.user_id, JSON.stringify({ 
        payment_id, 
        amount: payment.amount,
        remaining: new_outstanding 
      })]
    );
    
    // If loan is fully paid, update credit score
    if (loan_status === 'paid') {
      await ctx.db.run(
        `INSERT INTO credit_scoring_logs (user_id, loan_id, score_type, new_score, trigger_event)
         SELECT user_id, id, 'event_triggered', credit_score + 10, 'loan_paid_off'
         FROM users WHERE id = ?`,
        [payment.user_id]
      );
      
      await ctx.db.run(
        'UPDATE users SET credit_score = credit_score + 10 WHERE id = ?',
        [payment.user_id]
      );
    }
  }
  
  return ctx.json({
    success: true,
    payment_status: status
  });
}

/**
 * Get payment history
 */
export async function getPaymentHistory(ctx) {
  const userId = ctx.state.user.id;
  const { loan_id } = ctx.request.query;
  
  let query = 'SELECT * FROM payments WHERE user_id = ?';
  const params = [userId];
  
  if (loan_id) {
    query += ' AND loan_id = ?';
    params.push(loan_id);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const payments = await ctx.db.all(query, params);
  
  return ctx.json({
    success: true,
    count: payments.length,
    payments
  });
}

export default {
  createPayment,
  confirmPayment,
  getPaymentHistory
};
