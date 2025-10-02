/**
 * Loans Extension for TrailBase
 * Handles loan applications, approvals, and management
 */

/**
 * Apply for a loan
 */
export async function applyLoan(ctx) {
  const userId = ctx.state.user.id;
  const { loan_type, principal_amount, tenor_days, purpose } = ctx.request.body;
  
  // Validation
  if (!loan_type || !principal_amount || !tenor_days) {
    return ctx.json({ error: 'Missing required fields' }, 400);
  }
  
  // Check limits from config
  const config = ctx.config.loan;
  if (principal_amount < config.minAmount || principal_amount > config.maxAmount) {
    return ctx.json({ 
      error: `Loan amount must be between ${config.minAmount} and ${config.maxAmount}` 
    }, 400);
  }
  
  if (tenor_days < config.minTenorDays || tenor_days > config.maxTenorDays) {
    return ctx.json({ 
      error: `Tenor must be between ${config.minTenorDays} and ${config.maxTenorDays} days` 
    }, 400);
  }
  
  // Check if user has active loan
  const activeLoan = await ctx.db.get(
    `SELECT id FROM loans 
     WHERE user_id = ? AND status IN ('pending', 'approved', 'active', 'disbursed')`,
    [userId]
  );
  
  if (activeLoan) {
    return ctx.json({ error: 'You already have an active loan' }, 409);
  }
  
  // Get user credit score
  const user = await ctx.db.get(
    'SELECT credit_score, kyc_status FROM users WHERE id = ?',
    [userId]
  );
  
  if (user.kyc_status !== 'verified') {
    return ctx.json({ error: 'Please complete KYC verification first' }, 403);
  }
  
  // Calculate interest based on loan type
  let interest_rate, total_interest;
  if (loan_type === 'conventional') {
    interest_rate = config.conventional.dailyInterestRate;
    total_interest = principal_amount * (interest_rate / 100) * tenor_days;
  } else if (loan_type === 'sharia') {
    interest_rate = config.sharia.dailyUjrohRate;
    total_interest = principal_amount * (interest_rate / 100) * tenor_days;
  } else {
    return ctx.json({ error: 'Invalid loan type' }, 400);
  }
  
  const total_payment = principal_amount + total_interest;
  
  // Generate loan number
  const loan_number = `LN${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  // Calculate due date
  const due_date = new Date();
  due_date.setDate(due_date.getDate() + tenor_days);
  
  // Create loan application
  const result = await ctx.db.run(
    `INSERT INTO loans (
      loan_number, user_id, loan_type, principal_amount, interest_rate, 
      tenor_days, total_payment, outstanding_amount, status, due_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      loan_number, userId, loan_type, principal_amount, interest_rate,
      tenor_days, total_payment, total_payment, due_date.toISOString().split('T')[0]
    ]
  );
  
  const loanId = result.lastID;
  
  // Log credit scoring
  await ctx.db.run(
    `INSERT INTO credit_scoring_logs (user_id, loan_id, score_type, new_score, trigger_event)
     VALUES (?, ?, 'application', ?, 'loan_application')`,
    [userId, loanId, user.credit_score]
  );
  
  // Log audit
  await ctx.db.run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
     VALUES (?, 'create', 'loan', ?, ?)`,
    [userId, loanId, JSON.stringify({ principal_amount, tenor_days, loan_type })]
  );
  
  // Create notification
  await ctx.db.run(
    `INSERT INTO notifications (user_id, type, channel, title, message, data)
     VALUES (?, 'loan_status', 'push', 'Loan Application Submitted', 
             'Your loan application is being reviewed', ?)`,
    [userId, JSON.stringify({ loan_id: loanId, loan_number })]
  );
  
  return ctx.json({
    success: true,
    loan_id: loanId,
    loan_number,
    principal_amount,
    total_payment,
    interest_rate,
    due_date: due_date.toISOString().split('T')[0],
    status: 'pending',
    message: 'Loan application submitted successfully'
  }, 201);
}

/**
 * Get user loans
 */
export async function getUserLoans(ctx) {
  const userId = ctx.state.user.id;
  const { status } = ctx.request.query;
  
  let query = 'SELECT * FROM loans WHERE user_id = ?';
  const params = [userId];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const loans = await ctx.db.all(query, params);
  
  return ctx.json({
    success: true,
    count: loans.length,
    loans
  });
}

/**
 * Get loan details
 */
export async function getLoanDetails(ctx) {
  const userId = ctx.state.user.id;
  const { loanId } = ctx.params;
  
  const loan = await ctx.db.get(
    'SELECT * FROM loans WHERE id = ? AND user_id = ?',
    [loanId, userId]
  );
  
  if (!loan) {
    return ctx.json({ error: 'Loan not found' }, 404);
  }
  
  // Get payments
  const payments = await ctx.db.all(
    'SELECT * FROM payments WHERE loan_id = ? ORDER BY created_at DESC',
    [loanId]
  );
  
  return ctx.json({
    success: true,
    loan,
    payments
  });
}

/**
 * Cancel loan application (only if pending)
 */
export async function cancelLoan(ctx) {
  const userId = ctx.state.user.id;
  const { loanId } = ctx.params;
  
  const loan = await ctx.db.get(
    'SELECT status FROM loans WHERE id = ? AND user_id = ?',
    [loanId, userId]
  );
  
  if (!loan) {
    return ctx.json({ error: 'Loan not found' }, 404);
  }
  
  if (loan.status !== 'pending') {
    return ctx.json({ error: 'Only pending loans can be cancelled' }, 400);
  }
  
  await ctx.db.run(
    'UPDATE loans SET status = ? WHERE id = ?',
    ['cancelled', loanId]
  );
  
  // Log audit
  await ctx.db.run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
     VALUES (?, 'cancel', 'loan', ?)`,
    [userId, loanId]
  );
  
  return ctx.json({
    success: true,
    message: 'Loan cancelled successfully'
  });
}

export default {
  applyLoan,
  getUserLoans,
  getLoanDetails,
  cancelLoan
};
