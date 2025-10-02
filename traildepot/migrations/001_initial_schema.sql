-- KreditKu Initial Database Schema
-- Core tables: users, loans, payments

PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin_hash TEXT,
    
    full_name TEXT NOT NULL,
    nik TEXT UNIQUE,
    birth_date DATE,
    gender TEXT CHECK(gender IN ('M', 'F')),
    
    address TEXT,
    city TEXT,
    province TEXT,
    
    occupation TEXT,
    monthly_income INTEGER,
    
    user_type TEXT DEFAULT 'customer',
    status TEXT DEFAULT 'inactive',
    kyc_status TEXT DEFAULT 'pending',
    
    credit_score INTEGER DEFAULT 500,
    credit_limit INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    loan_number TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    
    loan_type TEXT NOT NULL CHECK(loan_type IN ('conventional', 'sharia')),
    principal_amount INTEGER NOT NULL,
    interest_rate REAL NOT NULL,
    tenor_days INTEGER NOT NULL,
    total_payment INTEGER NOT NULL,
    outstanding_amount INTEGER NOT NULL,
    
    status TEXT DEFAULT 'pending',
    application_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    disbursement_date DATETIME,
    due_date DATE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    payment_number TEXT UNIQUE NOT NULL,
    loan_id TEXT NOT NULL REFERENCES loans(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_date DATETIME,
    
    status TEXT DEFAULT 'pending',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

SELECT 'Initial schema created successfully' AS result;
