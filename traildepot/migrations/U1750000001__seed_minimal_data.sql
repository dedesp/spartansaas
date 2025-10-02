-- TrailBase Migration: Seed Minimal Data for Pinjol Application
-- Created: 2025-10-02
-- Description: Initial test data with AUTO-GENERATED INTEGER IDs

-- ============================================================================
-- LOAN PRODUCTS
-- ============================================================================

INSERT INTO loan_products (name, description, min_amount, max_amount, min_tenor_days, max_tenor_days, interest_rate, interest_type, admin_fee_percentage, late_fee_percentage, is_active)
VALUES
('Pinjaman Mikro', 'Pinjaman kecil untuk kebutuhan mendesak', 500000, 5000000, 7, 30, 2.5, 'flat', 1.5, 5.0, TRUE),
('Pinjaman Usaha', 'Pinjaman untuk modal usaha kecil', 5000000, 50000000, 30, 180, 1.8, 'flat', 2.0, 3.0, TRUE),
('Pinjaman Pendidikan', 'Pinjaman untuk biaya pendidikan', 2000000, 30000000, 90, 365, 1.5, 'flat', 1.0, 2.0, TRUE);

-- ============================================================================
-- TEST USERS (App Users - separate from TrailBase _user)
-- ============================================================================

-- Admin user
INSERT INTO users (email, phone, full_name, nik, role, status, kyc_status, created_at, updated_at)
VALUES
('admin@pinjol.id', '081234567890', 'Admin Sistem', '3201234567890001', 'admin', 'active', 'approved', datetime('now'), datetime('now'));

-- KYC Verifier
INSERT INTO users (email, phone, full_name, nik, role, status, kyc_status, created_at, updated_at)
VALUES
('verifier@pinjol.id', '081234567891', 'Verifikator KYC', '3201234567890002', 'verifier', 'active', 'approved', datetime('now'), datetime('now'));

-- Test Borrowers
INSERT INTO users (email, phone, full_name, nik, role, status, kyc_status, created_at, updated_at)
VALUES
('borrower1@test.com', '081234567892', 'Budi Santoso', '3201234567890003', 'borrower', 'active', 'approved', datetime('now'), datetime('now')),
('borrower2@test.com', '081234567893', 'Siti Aminah', '3201234567890004', 'borrower', 'active', 'approved', datetime('now'), datetime('now')),
('borrower3@test.com', '081234567894', 'Ahmad Rizki', '3201234567890005', 'borrower', 'pending_verification', 'pending', datetime('now'), datetime('now'));

-- Test Lenders
INSERT INTO users (email, phone, full_name, nik, role, status, kyc_status, created_at, updated_at)
VALUES
('lender1@test.com', '081234567895', 'Dewi Lestari', '3201234567890006', 'lender', 'active', 'approved', datetime('now'), datetime('now')),
('lender2@test.com', '081234567896', 'Eko Prasetyo', '3201234567890007', 'lender', 'active', 'approved', datetime('now'), datetime('now'));

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- Borrower profiles
INSERT INTO user_profiles (user_id, date_of_birth, gender, address, city, province, postal_code, occupation, monthly_income, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
SELECT id, '1990-05-15', 'male', 'Jl. Sudirman No. 123', 'Jakarta', 'DKI Jakarta', '12190', 'Karyawan Swasta', 8000000, 'Ani Santoso', '081234567899', 'Istri'
FROM users WHERE email = 'borrower1@test.com';

INSERT INTO user_profiles (user_id, date_of_birth, gender, address, city, province, postal_code, occupation, monthly_income, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
SELECT id, '1988-03-20', 'female', 'Jl. Gatot Subroto No. 45', 'Bandung', 'Jawa Barat', '40123', 'Wiraswasta', 12000000, 'Andi Wijaya', '081234567898', 'Suami'
FROM users WHERE email = 'borrower2@test.com';

INSERT INTO user_profiles (user_id, date_of_birth, gender, address, city, province, postal_code, occupation, monthly_income, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
SELECT id, '1995-07-10', 'male', 'Jl. Ahmad Yani No. 78', 'Surabaya', 'Jawa Timur', '60234', 'Freelancer', 6000000, 'Rina Rizki', '081234567897', 'Kakak'
FROM users WHERE email = 'borrower3@test.com';

-- Lender profiles
INSERT INTO user_profiles (user_id, date_of_birth, gender, address, city, province, postal_code, occupation, monthly_income, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
SELECT id, '1985-11-25', 'female', 'Jl. Thamrin No. 99', 'Jakarta', 'DKI Jakarta', '10350', 'Pengusaha', 50000000, 'Budi Lestari', '081234567896', 'Suami'
FROM users WHERE email = 'lender1@test.com';

INSERT INTO user_profiles (user_id, date_of_birth, gender, address, city, province, postal_code, occupation, monthly_income, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)
SELECT id, '1982-09-08', 'male', 'Jl. HR Rasuna Said No. 56', 'Jakarta', 'DKI Jakarta', '12940', 'Investor', 100000000, 'Sri Prasetyo', '081234567895', 'Istri'
FROM users WHERE email = 'lender2@test.com';

-- ============================================================================
-- WALLETS (Created for all users)
-- ============================================================================

-- Create wallets for all users
INSERT INTO wallets (user_id, balance, pending_balance, total_invested, total_returned)
SELECT id, 
    CASE 
        WHEN role = 'lender' THEN 50000000.0 
        WHEN role = 'borrower' THEN 0.0
        ELSE 0.0 
    END as balance,
    0.0, 0.0, 0.0
FROM users;

-- ============================================================================
-- SAMPLE LOAN APPLICATION (Approved and Active)
-- ============================================================================

-- Loan Application 1: Approved and funded
INSERT INTO loan_applications (borrower_id, product_id, loan_amount, tenor_days, interest_rate, admin_fee, total_interest, total_repayment, purpose, status, submitted_at, reviewed_by, reviewed_at, review_notes)
SELECT 
    (SELECT id FROM users WHERE email = 'borrower1@test.com'),
    (SELECT id FROM loan_products WHERE name = 'Pinjaman Mikro'),
    3000000,
    30,
    2.5,
    45000,
    75000,
    3075000,
    'Modal usaha warung kelontong',
    'funded',
    datetime('now', '-5 days'),
    (SELECT id FROM users WHERE email = 'verifier@pinjol.id'),
    datetime('now', '-4 days'),
    'Verifikasi lengkap, approved';

-- Create active loan from approved application
INSERT INTO loans (application_id, borrower_id, loan_number, principal_amount, interest_amount, admin_fee, total_amount, outstanding_amount, tenor_days, interest_rate, status, disbursement_date, due_date)
SELECT 
    (SELECT id FROM loan_applications WHERE purpose = 'Modal usaha warung kelontong'),
    (SELECT id FROM users WHERE email = 'borrower1@test.com'),
    'LN-' || strftime('%Y%m%d', 'now') || '-001',
    3000000,
    75000,
    45000,
    3075000,
    3075000,
    30,
    2.5,
    'active',
    datetime('now', '-3 days'),
    date('now', '+27 days');

-- Create repayment schedule
INSERT INTO repayment_schedules (loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, paid_amount, outstanding_amount, late_fee, status)
SELECT 
    (SELECT id FROM loans WHERE loan_number LIKE 'LN-%001'),
    1,
    date('now', '+27 days'),
    3000000,
    75000,
    3075000,
    0,
    3075000,
    0,
    'pending';

-- ============================================================================
-- SAMPLE LOAN APPLICATION (Under Review)
-- ============================================================================

INSERT INTO loan_applications (borrower_id, product_id, loan_amount, tenor_days, interest_rate, admin_fee, total_interest, total_repayment, purpose, status, submitted_at)
SELECT 
    (SELECT id FROM users WHERE email = 'borrower2@test.com'),
    (SELECT id FROM loan_products WHERE name = 'Pinjaman Usaha'),
    10000000,
    90,
    1.8,
    200000,
    1620000,
    11620000,
    'Pengembangan usaha catering',
    'under_review',
    datetime('now', '-1 day');

-- ============================================================================
-- SAMPLE FUNDING OFFER
-- ============================================================================

INSERT INTO funding_offers (application_id, lender_id, offered_amount, status, expires_at)
SELECT 
    (SELECT id FROM loan_applications WHERE purpose = 'Pengembangan usaha catering'),
    (SELECT id FROM users WHERE email = 'lender1@test.com'),
    5000000,
    'pending',
    datetime('now', '+7 days');

INSERT INTO funding_offers (application_id, lender_id, offered_amount, status, expires_at)
SELECT 
    (SELECT id FROM loan_applications WHERE purpose = 'Pengembangan usaha catering'),
    (SELECT id FROM users WHERE email = 'lender2@test.com'),
    5000000,
    'pending',
    datetime('now', '+7 days');
