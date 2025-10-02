-- TrailBase Migration: Initial Schema for Pinjol (Peer-to-Peer Lending) Application
-- Created: 2025-10-02
-- Description: Complete database schema with INTEGER PRIMARY KEYs for TrailBase compatibility

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

-- Application users table (separate from TrailBase's _user table)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nik TEXT UNIQUE,  -- Indonesian National ID
    role TEXT NOT NULL CHECK(role IN ('borrower', 'lender', 'admin', 'verifier')),
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK(status IN ('pending_verification', 'active', 'suspended', 'blocked')),
    kyc_status TEXT NOT NULL DEFAULT 'not_started' CHECK(kyc_status IN ('not_started', 'pending', 'approved', 'rejected')),
    kyc_verified_at TEXT,
    kyc_verified_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (kyc_verified_by) REFERENCES users(id)
) STRICT;

-- User profiles with detailed information
CREATE TABLE user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    date_of_birth TEXT,
    gender TEXT CHECK(gender IN ('male', 'female')),
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    occupation TEXT,
    monthly_income REAL,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

-- KYC documents for verification
CREATE TABLE kyc_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_type TEXT NOT NULL CHECK(document_type IN ('ktp', 'selfie', 'npwp', 'salary_slip', 'bank_statement')),
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    verified_by INTEGER,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id)
) STRICT;

-- ============================================================================
-- LOAN PRODUCTS & CONFIGURATION
-- ============================================================================

CREATE TABLE loan_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    min_amount REAL NOT NULL CHECK(min_amount > 0),
    max_amount REAL NOT NULL CHECK(max_amount > 0),
    min_tenor_days INTEGER NOT NULL CHECK(min_tenor_days > 0),
    max_tenor_days INTEGER NOT NULL CHECK(max_tenor_days > 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    interest_type TEXT NOT NULL CHECK(interest_type IN ('flat', 'effective')),
    admin_fee_percentage REAL NOT NULL DEFAULT 0 CHECK(admin_fee_percentage >= 0),
    late_fee_percentage REAL NOT NULL DEFAULT 0 CHECK(late_fee_percentage >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK(max_amount >= min_amount),
    CHECK(max_tenor_days >= min_tenor_days)
) STRICT;

-- ============================================================================
-- LOAN APPLICATIONS & MANAGEMENT
-- ============================================================================

CREATE TABLE loan_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borrower_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    loan_amount REAL NOT NULL CHECK(loan_amount > 0),
    tenor_days INTEGER NOT NULL CHECK(tenor_days > 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    admin_fee REAL NOT NULL DEFAULT 0 CHECK(admin_fee >= 0),
    total_interest REAL NOT NULL CHECK(total_interest >= 0),
    total_repayment REAL NOT NULL CHECK(total_repayment > 0),
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled', 'funded')),
    submitted_at TEXT,
    reviewed_by INTEGER,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (borrower_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES loan_products(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
) STRICT;

CREATE TABLE loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL UNIQUE,
    borrower_id INTEGER NOT NULL,
    loan_number TEXT NOT NULL UNIQUE,
    principal_amount REAL NOT NULL CHECK(principal_amount > 0),
    interest_amount REAL NOT NULL CHECK(interest_amount >= 0),
    admin_fee REAL NOT NULL DEFAULT 0 CHECK(admin_fee >= 0),
    total_amount REAL NOT NULL CHECK(total_amount > 0),
    outstanding_amount REAL NOT NULL CHECK(outstanding_amount >= 0),
    tenor_days INTEGER NOT NULL CHECK(tenor_days > 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'fully_paid', 'defaulted', 'written_off')),
    disbursement_date TEXT,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (application_id) REFERENCES loan_applications(id),
    FOREIGN KEY (borrower_id) REFERENCES users(id)
) STRICT;

-- ============================================================================
-- FUNDING & INVESTMENTS
-- ============================================================================

CREATE TABLE funding_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    lender_id INTEGER NOT NULL,
    offered_amount REAL NOT NULL CHECK(offered_amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (application_id) REFERENCES loan_applications(id),
    FOREIGN KEY (lender_id) REFERENCES users(id)
) STRICT;

CREATE TABLE investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    lender_id INTEGER NOT NULL,
    investment_amount REAL NOT NULL CHECK(investment_amount > 0),
    expected_return REAL NOT NULL CHECK(expected_return >= 0),
    actual_return REAL NOT NULL DEFAULT 0 CHECK(actual_return >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'defaulted')),
    investment_date TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (lender_id) REFERENCES users(id)
) STRICT;

-- ============================================================================
-- PAYMENTS & TRANSACTIONS
-- ============================================================================

CREATE TABLE repayment_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    installment_number INTEGER NOT NULL CHECK(installment_number > 0),
    due_date TEXT NOT NULL,
    principal_amount REAL NOT NULL CHECK(principal_amount > 0),
    interest_amount REAL NOT NULL CHECK(interest_amount >= 0),
    total_amount REAL NOT NULL CHECK(total_amount > 0),
    paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
    outstanding_amount REAL NOT NULL CHECK(outstanding_amount >= 0),
    late_fee REAL NOT NULL DEFAULT 0 CHECK(late_fee >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'partial')),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    UNIQUE(loan_id, installment_number)
) STRICT;

CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    schedule_id INTEGER,
    payer_id INTEGER NOT NULL,
    payment_number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('bank_transfer', 'virtual_account', 'ewallet', 'retail')),
    payment_channel TEXT,
    reference_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_date TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (schedule_id) REFERENCES repayment_schedules(id),
    FOREIGN KEY (payer_id) REFERENCES users(id)
) STRICT;

CREATE TABLE disbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    borrower_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    reference_number TEXT,
    disbursed_at TEXT,
    failed_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (borrower_id) REFERENCES users(id)
) STRICT;

-- ============================================================================
-- WALLETS & BALANCES
-- ============================================================================

CREATE TABLE wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0 CHECK(balance >= 0),
    pending_balance REAL NOT NULL DEFAULT 0 CHECK(pending_balance >= 0),
    total_invested REAL NOT NULL DEFAULT 0 CHECK(total_invested >= 0),
    total_returned REAL NOT NULL DEFAULT 0 CHECK(total_returned >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('deposit', 'withdrawal', 'investment', 'return', 'fee', 'refund')),
    amount REAL NOT NULL CHECK(amount != 0),
    balance_before REAL NOT NULL CHECK(balance_before >= 0),
    balance_after REAL NOT NULL CHECK(balance_after >= 0),
    reference_type TEXT CHECK(reference_type IN ('loan', 'investment', 'payment', 'disbursement')),
    reference_id INTEGER,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
) STRICT;

-- ============================================================================
-- NOTIFICATIONS & COMMUNICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('loan_status', 'payment_reminder', 'payment_received', 'investment', 'kyc', 'general')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- KYC documents indexes
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_status ON kyc_documents(status);

-- Loan applications indexes
CREATE INDEX idx_loan_applications_borrower_id ON loan_applications(borrower_id);
CREATE INDEX idx_loan_applications_product_id ON loan_applications(product_id);
CREATE INDEX idx_loan_applications_status ON loan_applications(status);

-- Loans indexes
CREATE INDEX idx_loans_application_id ON loans(application_id);
CREATE INDEX idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX idx_loans_loan_number ON loans(loan_number);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date);

-- Funding offers indexes
CREATE INDEX idx_funding_offers_application_id ON funding_offers(application_id);
CREATE INDEX idx_funding_offers_lender_id ON funding_offers(lender_id);
CREATE INDEX idx_funding_offers_status ON funding_offers(status);

-- Investments indexes
CREATE INDEX idx_investments_loan_id ON investments(loan_id);
CREATE INDEX idx_investments_lender_id ON investments(lender_id);
CREATE INDEX idx_investments_status ON investments(status);

-- Repayment schedules indexes
CREATE INDEX idx_repayment_schedules_loan_id ON repayment_schedules(loan_id);
CREATE INDEX idx_repayment_schedules_due_date ON repayment_schedules(due_date);
CREATE INDEX idx_repayment_schedules_status ON repayment_schedules(status);

-- Payments indexes
CREATE INDEX idx_payments_loan_id ON payments(loan_id);
CREATE INDEX idx_payments_schedule_id ON payments(schedule_id);
CREATE INDEX idx_payments_payer_id ON payments(payer_id);
CREATE INDEX idx_payments_payment_number ON payments(payment_number);
CREATE INDEX idx_payments_status ON payments(status);

-- Disbursements indexes
CREATE INDEX idx_disbursements_loan_id ON disbursements(loan_id);
CREATE INDEX idx_disbursements_borrower_id ON disbursements(borrower_id);
CREATE INDEX idx_disbursements_status ON disbursements(status);

-- Wallets indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Wallet transactions indexes
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at   