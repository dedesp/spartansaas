/**
 * Accounting Module Extension
 * Double-entry bookkeeping system with journal entries and reconciliation
 * FR-ACC-001 & FR-ACC-002
 */

const crypto = require('crypto');

/**
 * Chart of Accounts Structure
 * Standard accounting accounts for lending business
 */
const DEFAULT_ACCOUNTS = {
  // Assets (1xxx)
  '1100': { name: 'Kas', type: 'asset', normal: 'debit' },
  '1110': { name: 'Bank - BCA', type: 'asset', normal: 'debit' },
  '1111': { name: 'Bank - Mandiri', type: 'asset', normal: 'debit' },
  '1112': { name: 'Bank - BNI', type: 'asset', normal: 'debit' },
  '1200': { name: 'Piutang Pinjaman', type: 'asset', normal: 'debit' },
  '1210': { name: 'Piutang Bunga', type: 'asset', normal: 'debit' },
  '1220': { name: 'Piutang Denda', type: 'asset', normal: 'debit' },
  
  // Liabilities (2xxx)
  '2100': { name: 'Utang Usaha', type: 'liability', normal: 'credit' },
  '2200': { name: 'Utang Pajak', type: 'liability', normal: 'credit' },
  
  // Equity (3xxx)
  '3100': { name: 'Modal', type: 'equity', normal: 'credit' },
  '3200': { name: 'Laba Ditahan', type: 'equity', normal: 'credit' },
  
  // Revenue (4xxx)
  '4100': { name: 'Pendapatan Bunga', type: 'revenue', normal: 'credit' },
  '4110': { name: 'Pendapatan Admin', type: 'revenue', normal: 'credit' },
  '4120': { name: 'Pendapatan Denda', type: 'revenue', normal: 'credit' },
  
  // Expenses (5xxx)
  '5100': { name: 'Beban Operasional', type: 'expense', normal: 'debit' },
  '5110': { name: 'Beban Gaji', type: 'expense', normal: 'debit' },
  '5120': { name: 'Beban Pemasaran', type: 'expense', normal: 'debit' },
  '5200': { name: 'Beban Penyisihan Piutang', type: 'expense', normal: 'debit' },
  '5300': { name: 'Beban Pajak', type: 'expense', normal: 'debit' }
};

/**
 * Initialize Chart of Accounts
 */
async function initializeChartOfAccounts(req, db) {
  // Create table if not exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id TEXT PRIMARY KEY,
      account_code TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
      normal_balance TEXT NOT NULL CHECK(normal_balance IN ('debit', 'credit')),
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default accounts if not exists
  const results = { inserted: 0, skipped: 0 };
  
  for (const [code, account] of Object.entries(DEFAULT_ACCOUNTS)) {
    const exists = await db.query('SELECT id FROM chart_of_accounts WHERE account_code = ?', [code]);
    
    if (exists.length === 0) {
      await db.execute(`
        INSERT INTO chart_of_accounts (id, account_code, account_name, account_type, normal_balance)
        VALUES (?, ?, ?, ?, ?)
      `, [generateId(), code, account.name, account.type, account.normal]);
      results.inserted++;
    } else {
      results.skipped++;
    }
  }

  return results;
}

/**
 * Create Journal Entry
 * Double-entry bookkeeping: total debits must equal total credits
 */
async function createJournalEntry(req, db) {
  const { 
    journalType, 
    description, 
    referenceType, 
    referenceId, 
    lines,
    createdBy 
  } = req.body;

  if (!journalType || !lines || lines.length < 2) {
    return { error: 'Journal type and at least 2 lines required' };
  }

  // Validate balanced entry
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  if (totalDebit !== totalCredit) {
    return { error: `Entry not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}` };
  }

  // Generate journal number
  const journalNumber = await generateJournalNumber(db, journalType);
  const journalId = generateId();

  // Create journal entry header
  await db.execute(`
    INSERT INTO journal_entries (
      id, journal_number, journal_date, journal_type,
      description, reference_type, reference_id,
      status, created_by, created_at
    ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    journalId,
    journalNumber,
    journalType,
    description,
    referenceType || null,
    referenceId || null,
    'draft',
    createdBy || null
  ]);

  // Create journal lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    await db.execute(`
      INSERT INTO journal_lines (
        id, journal_entry_id, line_number, account_code,
        debit_amount, credit_amount, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId(),
      journalId,
      i + 1,
      line.accountCode,
      line.debit || 0,
      line.credit || 0,
      line.description || ''
    ]);
  }

  return {
    journalId,
    journalNumber,
    totalDebit,
    totalCredit,
    status: 'draft'
  };
}

/**
 * Record Loan Disbursement
 * Debit: Piutang Pinjaman
 * Credit: Bank
 */
async function recordDisbursement(req, db) {
  const { loanId, amount, bankAccount, disbursedBy } = req.body;

  if (!loanId || !amount) {
    return { error: 'Loan ID and amount required' };
  }

  // Get loan details
  const loanQuery = `
    SELECT loan_number, user_id, principal_amount, admin_fee
    FROM loans
    WHERE id = ?
  `;
  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];
  const netDisbursement = amount - (loan.admin_fee || 0);

  // Create journal entry
  const lines = [
    {
      accountCode: '1200', // Piutang Pinjaman
      debit: amount,
      credit: 0,
      description: `Piutang pinjaman ${loan.loan_number}`
    },
    {
      accountCode: '4110', // Pendapatan Admin
      debit: 0,
      credit: loan.admin_fee || 0,
      description: `Pendapatan admin pinjaman ${loan.loan_number}`
    },
    {
      accountCode: bankAccount || '1110', // Bank
      debit: 0,
      credit: netDisbursement,
      description: `Pencairan pinjaman ${loan.loan_number}`
    }
  ];

  const result = await createJournalEntry({
    body: {
      journalType: 'disbursement',
      description: `Disbursement for loan ${loan.loan_number}`,
      referenceType: 'loan',
      referenceId: loanId,
      lines,
      createdBy: disbursedBy
    }
  }, db);

  // Auto-post the entry
  if (result.journalId) {
    await postJournalEntry({ body: { journalId: result.journalId, postedBy: disbursedBy } }, db);
  }

  return result;
}

/**
 * Record Payment Received
 * Debit: Bank
 * Credit: Piutang Pinjaman (principal)
 * Credit: Pendapatan Bunga (interest)
 */
async function recordPaymentReceived(req, db) {
  const { paymentId, loanId, amount, principalAmount, interestAmount, penaltyAmount } = req.body;

  if (!paymentId || !loanId || !amount) {
    return { error: 'Payment ID, loan ID, and amount required' };
  }

  // Get loan details
  const loanQuery = 'SELECT loan_number FROM loans WHERE id = ?';
  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];

  // Build journal lines
  const lines = [
    {
      accountCode: '1110', // Bank (assuming BCA)
      debit: amount,
      credit: 0,
      description: `Payment received for ${loan.loan_number}`
    }
  ];

  if (principalAmount > 0) {
    lines.push({
      accountCode: '1200', // Piutang Pinjaman
      debit: 0,
      credit: principalAmount,
      description: `Principal payment ${loan.loan_number}`
    });
  }

  if (interestAmount > 0) {
    lines.push({
      accountCode: '4100', // Pendapatan Bunga
      debit: 0,
      credit: interestAmount,
      description: `Interest income ${loan.loan_number}`
    });
  }

  if (penaltyAmount > 0) {
    lines.push({
      accountCode: '4120', // Pendapatan Denda
      debit: 0,
      credit: penaltyAmount,
      description: `Penalty income ${loan.loan_number}`
    });
  }

  const result = await createJournalEntry({
    body: {
      journalType: 'payment',
      description: `Payment received for loan ${loan.loan_number}`,
      referenceType: 'payment',
      referenceId: paymentId,
      lines,
      createdBy: 'system'
    }
  }, db);

  // Auto-post
  if (result.journalId) {
    await postJournalEntry({ body: { journalId: result.journalId, postedBy: 'system' } }, db);
  }

  return result;
}

/**
 * Post Journal Entry
 * Changes status from draft to posted
 */
async function postJournalEntry(req, db) {
  const { journalId, postedBy } = req.body;

  if (!journalId) {
    return { error: 'Journal ID required' };
  }

  // Verify entry is balanced
  const verifyQuery = `
    SELECT 
      SUM(debit_amount) as total_debit,
      SUM(credit_amount) as total_credit
    FROM journal_lines
    WHERE journal_entry_id = ?
  `;
  const result = await db.query(verifyQuery, [journalId]);

  if (result[0].total_debit !== result[0].total_credit) {
    return { error: 'Cannot post unbalanced entry' };
  }

  // Update status to posted
  await db.execute(`
    UPDATE journal_entries
    SET status = 'posted',
        posted_by = ?,
        posted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [postedBy || null, journalId]);

  return { success: true, journalId, status: 'posted' };
}

/**
 * Void Journal Entry
 */
async function voidJournalEntry(req, db) {
  const { journalId, reason, voidedBy } = req.body;

  if (!journalId || !reason) {
    return { error: 'Journal ID and reason required' };
  }

  await db.execute(`
    UPDATE journal_entries
    SET status = 'void',
        voided_by = ?,
        voided_at = CURRENT_TIMESTAMP,
        void_reason = ?
    WHERE id = ?
  `, [voidedBy || null, reason, journalId]);

  return { success: true, journalId, status: 'void' };
}

/**
 * Get Trial Balance
 */
async function getTrialBalance(req, db) {
  const { startDate, endDate } = req.query || {};

  let whereClause = "je.status = 'posted'";
  const params = [];

  if (startDate) {
    whereClause += ' AND je.journal_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND je.journal_date <= ?';
    params.push(endDate);
  }

  const query = `
    SELECT 
      coa.account_code,
      coa.account_name,
      coa.account_type,
      coa.normal_balance,
      SUM(jl.debit_amount) as total_debit,
      SUM(jl.credit_amount) as total_credit,
      CASE 
        WHEN coa.normal_balance = 'debit' THEN SUM(jl.debit_amount) - SUM(jl.credit_amount)
        ELSE SUM(jl.credit_amount) - SUM(jl.debit_amount)
      END as balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON coa.account_code = jl.account_code
    LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE ${whereClause}
    GROUP BY coa.account_code, coa.account_name, coa.account_type, coa.normal_balance
    HAVING balance != 0
    ORDER BY coa.account_code
  `;

  const accounts = await db.query(query, params);

  const totalDebit = accounts.reduce((sum, acc) => sum + (acc.normal_balance === 'debit' ? acc.balance : 0), 0);
  const totalCredit = accounts.reduce((sum, acc) => sum + (acc.normal_balance === 'credit' ? acc.balance : 0), 0);

  return {
    accounts,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01 // Allow for rounding
  };
}

/**
 * Get Income Statement
 */
async function getIncomeStatement(req, db) {
  const { startDate, endDate } = req.query || {};

  const params = [startDate || '1900-01-01', endDate || '2999-12-31'];

  const query = `
    SELECT 
      coa.account_code,
      coa.account_name,
      coa.account_type,
      SUM(jl.credit_amount - jl.debit_amount) as amount
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON coa.account_code = jl.account_code
    LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE coa.account_type IN ('revenue', 'expense')
      AND je.status = 'posted'
      AND je.journal_date BETWEEN ? AND ?
    GROUP BY coa.account_code, coa.account_name, coa.account_type
    ORDER BY coa.account_code
  `;

  const accounts = await db.query(query, params);

  const revenue = accounts.filter(a => a.account_type === 'revenue');
  const expenses = accounts.filter(a => a.account_type === 'expense');

  const totalRevenue = revenue.reduce((sum, a) => sum + a.amount, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + Math.abs(a.amount), 0);
  const netIncome = totalRevenue - totalExpenses;

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome,
    period: { startDate: startDate || 'inception', endDate: endDate || 'now' }
  };
}

/**
 * Get Balance Sheet
 */
async function getBalanceSheet(req, db) {
  const { asOfDate } = req.query || {};

  const params = [asOfDate || '2999-12-31'];

  const query = `
    SELECT 
      coa.account_code,
      coa.account_name,
      coa.account_type,
      coa.normal_balance,
      CASE 
        WHEN coa.normal_balance = 'debit' THEN SUM(jl.debit_amount - jl.credit_amount)
        ELSE SUM(jl.credit_amount - jl.debit_amount)
      END as balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON coa.account_code = jl.account_code
    LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE coa.account_type IN ('asset', 'liability', 'equity')
      AND je.status = 'posted'
      AND je.journal_date <= ?
    GROUP BY coa.account_code, coa.account_name, coa.account_type, coa.normal_balance
    HAVING balance != 0
    ORDER BY coa.account_code
  `;

  const accounts = await db.query(query, params);

  const assets = accounts.filter(a => a.account_type === 'asset');
  const liabilities = accounts.filter(a => a.account_type === 'liability');
  const equity = accounts.filter(a => a.account_type === 'equity');

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    asOfDate: asOfDate || 'now'
  };
}

/**
 * Daily Reconciliation
 * Compare system records with actual bank statements
 */
async function dailyReconciliation(req, db) {
  const { reconciliationDate, bankAccount, bankBalance, transactions } = req.body;

  if (!reconciliationDate || !bankAccount) {
    return { error: 'Reconciliation date and bank account required' };
  }

  // Get system balance from general ledger
  const systemQuery = `
    SELECT 
      SUM(jl.debit_amount - jl.credit_amount) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE jl.account_code = ?
      AND je.status = 'posted'
      AND je.journal_date <= ?
  `;
  
  const systemResult = await db.query(systemQuery, [bankAccount, reconciliationDate]);
  const systemBalance = systemResult[0]?.balance || 0;

  const difference = bankBalance - systemBalance;

  // Log reconciliation
  const reconId = generateId();
  await db.execute(`
    INSERT INTO reconciliations (
      id, reconciliation_date, account_code,
      system_balance, bank_balance, difference,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    reconId,
    reconciliationDate,
    bankAccount,
    systemBalance,
    bankBalance,
    difference,
    Math.abs(difference) < 0.01 ? 'matched' : 'unmatched'
  ]);

  return {
    reconciliationId: reconId,
    systemBalance,
    bankBalance,
    difference,
    matched: Math.abs(difference) < 0.01,
    transactions: transactions || []
  };
}

/**
 * Get Journal Entry Details
 */
async function getJournalEntry(req, db) {
  const { journalId } = req.params;

  const headerQuery = `
    SELECT * FROM journal_entries WHERE id = ?
  `;
  const headers = await db.query(headerQuery, [journalId]);

  if (headers.length === 0) {
    return { error: 'Journal entry not found' };
  }

  const linesQuery = `
    SELECT 
      jl.*,
      coa.account_name
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON jl.account_code = coa.account_code
    WHERE jl.journal_entry_id = ?
    ORDER BY jl.line_number
  `;
  const lines = await db.query(linesQuery, [journalId]);

  return {
    header: headers[0],
    lines
  };
}

// ============ Helper Functions ============

async function generateJournalNumber(db, journalType) {
  const prefix = {
    'general': 'JV',
    'disbursement': 'JD',
    'payment': 'JP',
    'adjustment': 'JA',
    'closing': 'JC'
  };

  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  
  // Get last number for this month
  const query = `
    SELECT journal_number 
    FROM journal_entries 
    WHERE journal_number LIKE ?
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  const pattern = `${prefix[journalType] || 'JV'}-${yearMonth}-%`;
  const result = await db.query(query, [pattern]);
  
  let sequence = 1;
  if (result.length > 0) {
    const lastNumber = result[0].journal_number;
    const lastSeq = parseInt(lastNumber.split('-')[2]);
    sequence = lastSeq + 1;
  }

  return `${prefix[journalType] || 'JV'}-${yearMonth}-${sequence.toString().padStart(5, '0')}`;
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// Create reconciliations table if not exists
async function createReconciliationsTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reconciliations (
      id TEXT PRIMARY KEY,
      reconciliation_date DATE NOT NULL,
      account_code TEXT NOT NULL,
      system_balance REAL,
      bank_balance REAL,
      difference REAL,
      status TEXT CHECK(status IN ('matched', 'unmatched', 'reconciled')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reconciled_by TEXT,
      reconciled_at DATETIME
    )
  `);
}

// Export functions
module.exports = {
  initializeChartOfAccounts,
  createJournalEntry,
  recordDisbursement,
  recordPaymentReceived,
  postJournalEntry,
  voidJournalEntry,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  dailyReconciliation,
  getJournalEntry,
  createReconciliationsTable
};
