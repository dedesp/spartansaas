/**
 * Credit Scoring Extension for TrailBase
 * Calculates and updates user credit scores
 */

/**
 * Calculate credit score for user
 */
export async function calculateCreditScore(ctx) {
  const { userId } = ctx.params;
  
  // Get user data
  const user = await ctx.db.get(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    return ctx.json({ error: 'User not found' }, 404);
  }
  
  // Get scoring config
  const config = ctx.config.scoring;
  let score = config.baseScore;
  
  // Factor 1: KYC Status (0-100 points)
  if (user.kyc_status === 'verified') {
    score += 100;
  }
  
  // Factor 2: Payment History (0-200 points)
  const paymentHistory = await ctx.db.get(
    `SELECT 
       COUNT(*) as total_payments,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_payments
     FROM payments WHERE user_id = ?`,
    [userId]
  );
  
  if (paymentHistory.total_payments > 0) {
    const successRate = paymentHistory.successful_payments / paymentHistory.total_payments;
    score += Math.floor(successRate * 200);
  }
  
  // Factor 3: Loan Performance (0-200 points)
  const loanHistory = await ctx.db.get(
    `SELECT 
       COUNT(*) as total_loans,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_loans,
       AVG(days_past_due) as avg_days_past_due
     FROM loans WHERE user_id = ?`,
    [userId]
  );
  
  if (loanHistory.total_loans > 0) {
    const paymentRate = loanHistory.paid_loans / loanHistory.total_loans;
    score += Math.floor(paymentRate * 150);
    
    // Deduct for late payments
    if (loanHistory.avg_days_past_due > 0) {
      score -= Math.floor(loanHistory.avg_days_past_due * 2);
    }
  }
  
  // Cap score between min and max
  score = Math.max(config.minScore, Math.min(config.maxScore, score));
  
  // Update user credit score
  await ctx.db.run(
    'UPDATE users SET credit_score = ? WHERE id = ?',
    [score, userId]
  );
  
  // Log scoring event
  await ctx.db.run(
    `INSERT INTO credit_scoring_logs (
      user_id, score_type, previous_score, new_score, score_change,
      factors, trigger_event
    ) VALUES (?, 'periodic', ?, ?, ?, ?, 'manual_calculation')`,
    [
      userId,
      user.credit_score,
      score,
      score - user.credit_score,
      JSON.stringify({
        kyc: user.kyc_status === 'verified' ? 100 : 0,
        payment_history: paymentHistory.total_payments,
        loan_performance: loanHistory.total_loans
      })
    ]
  );
  
  return ctx.json({
    success: true,
    previous_score: user.credit_score,
    new_score: score,
    change: score - user.credit_score
  });
}

/**
 * Get credit score history
 */
export async function getScoreHistory(ctx) {
  const userId = ctx.state.user.id;
  
  const history = await ctx.db.all(
    `SELECT * FROM credit_scoring_logs 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [userId]
  );
  
  return ctx.json({
    success: true,
    history
  });
}

/**
 * Trigger score recalculation on events
 */
export async function triggerScoreUpdate(userId, event, ctx) {
  // This is called internally by other extensions
  await calculateCreditScore({ ...ctx, params: { userId } });
}

export default {
  calculateCreditScore,
  getScoreHistory,
  triggerScoreUpdate
};
