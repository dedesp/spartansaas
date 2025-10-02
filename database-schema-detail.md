# Database Schema Documentation
## Aplikasi Pinjol KreditKu - TrailBase SQLite Implementation

### Version: 1.0
### Date: December 2024

---

## 1. Database Overview

### 1.1 Database Engine
- **Engine**: SQLite 3.x (Built-in TrailBase)
- **Mode**: WAL (Write-Ahead Logging)
- **Encoding**: UTF-8
- **Page Size**: 4096 bytes
- **Cache Size**: 10000 pages

### 1.2 Naming Conventions
- **Tables**: snake_case, plural (e.g., `users`, `loans`)
- **Columns**: snake_case (e.g., `user_id`, `created_at`)
- **Indexes**: idx_{table}_{column(s)} (e.g., `idx_users_email`)
- **Foreign Keys**: {table}_id (e.g., `user_id`)
- **Primary Keys**: `id` (UUID format)

### 1.3 Data Types Mapping
| SQLite Type | Application Type | Description |
|------------|------------------|-------------|
| TEXT | UUID | Primary keys, foreign keys |
| TEXT | String | General text data |
| INTEGER | Number | Amounts in smallest unit (cents) |
| REAL | Float | Percentages, scores |
| DATETIME | Timestamp | ISO 8601 format |
| JSON | Object | Structured data |
| BOOLEAN | Integer | 0 = false, 1 = true |

---

## 2. Core Tables Schema

### 2.1 Users Table

```sql
CREATE TABLE users (
    -- Primary Identification
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin_hash TEXT, -- 6-digit transaction PIN
    
    -- Personal Information
    full_name TEXT NOT NULL,
    nik TEXT UNIQUE,
    birth_date DATE,
    birth_place TEXT,
    gender TEXT CHECK(gender IN ('M', 'F')),
    religion TEXT,
    marital_status TEXT CHECK(marital_status IN ('single', 'married', 'divorced', 'widowed')),
    education TEXT CHECK(education IN ('sd', 'smp', 'sma', 'd3', 's1', 's2', 's3')),
    mother_maiden_name TEXT,
    
    -- Address Information
    address TEXT,
    rt TEXT,
    rw TEXT,
    kelurahan TEXT,
    kecamatan TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    address_ownership TEXT CHECK(address_ownership IN ('owned', 'rented', 'family', 'company')),
    residence_duration INTEGER, -- in months
    
    -- Contact Information
    home_phone TEXT,
    office_phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    
    -- Employment Information
    occupation TEXT,
    employment_type TEXT CHECK(employment_type IN ('permanent', 'contract', 'freelance', 'business_owner', 'unemployed')),
    company_name TEXT,
    company_address TEXT,
    company_phone TEXT,
    position TEXT,
    work_duration INTEGER, -- in months
    monthly_income INTEGER, -- in IDR
    other_income INTEGER,
    monthly_expense INTEGER,
    
    -- Account Status
    user_type TEXT DEFAULT 'customer' CHECK(user_type IN ('customer', 'admin', 'credit_analyst', 'collector', 'accountant', 'super_admin')),
    status TEXT DEFAULT 'inactive' CHECK(status IN ('active', 'inactive', 'suspended', 'blacklisted', 'deleted')),
    kyc_status TEXT DEFAULT 'pending' CHECK(kyc_status IN ('pending', 'in_progress', 'verified', 'rejected', 'expired')),
    kyc_level INTEGER DEFAULT 0 CHECK(kyc_level IN (0, 1, 2, 3)), -- 0=none, 1=basic, 2=intermediate, 3=full
    
    -- Credit Information
    credit_score INTEGER DEFAULT 500 CHECK(credit_score BETWEEN 300 AND 850),
    credit_limit INTEGER DEFAULT 0,
    risk_rating TEXT DEFAULT 'medium' CHECK(risk_rating IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    
    -- Authentication & Security
    last_login DATETIME,
    last_password_change DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    two_factor_enabled BOOLEAN DEFAULT 0,
    two_factor_secret TEXT,
    
    -- Device & Session
    device_id TEXT,
    device_model TEXT,
    device_os TEXT,
    app_version TEXT,
    fcm_token TEXT,
    last_ip_address TEXT,
    
    -- Preferences
    notification_email BOOLEAN DEFAULT 1,
    notification_sms BOOLEAN DEFAULT 1,
    notification_push BOOLEAN DEFAULT 1,
    notification_whatsapp BOOLEAN DEFAULT 0,
    preferred_language TEXT DEFAULT 'id' CHECK(preferred_language IN ('id', 'en')),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- Metadata
    referral_code TEXT UNIQUE,
    referred_by TEXT REFERENCES users(id),
    acquisition_channel TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_nik ON users(nik) WHERE nik IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_credit_score ON users(credit_score);
CREATE INDEX idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 2.2 KYC Verifications Table

```sql
CREATE TABLE kyc_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Verification Type & Status
    verification_type TEXT NOT NULL CHECK(verification_type IN (
        'phone', 'email', 'ktp', 'selfie', 'selfie_ktp', 
        'npwp', 'bank_account', 'employment', 'address'
    )),
    verification_method TEXT CHECK(verification_method IN ('auto', 'manual', 'hybrid')),
    verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN (
        'pending', 'processing', 'success', 'failed', 'expired'
    )),
    
    -- Document Information
    document_type TEXT,
    document_number TEXT,
    document_url TEXT,
    document_url_back TEXT, -- for documents with back side
    document_expiry_date DATE,
    
    -- OCR & Extraction Results
    extracted_data JSON, -- Complete OCR result
    extracted_nik TEXT,
    extracted_name TEXT,
    extracted_birth_date DATE,
    extracted_address TEXT,
    
    -- Biometric Verification
    face_url TEXT,
    face_match_score REAL CHECK(face_match_score BETWEEN 0 AND 1),
    liveness_score REAL CHECK(liveness_score BETWEEN 0 AND 1),
    face_quality_score REAL CHECK(face_quality_score BETWEEN 0 AND 1),
    
    -- Verification Results
    is_data_match BOOLEAN,
    mismatch_fields JSON, -- Array of fields that don't match
    verification_score REAL CHECK(verification_score BETWEEN 0 AND 100),
    risk_indicators JSON, -- Array of risk flags
    
    -- Manual Review
    requires_manual_review BOOLEAN DEFAULT 0,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at DATETIME,
    review_notes TEXT,
    rejection_reason TEXT,
    rejection_code TEXT,
    
    -- External Service Response
    external_reference_id TEXT,
    external_provider TEXT,
    external_response JSON,
    
    -- Timestamps
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    expired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_kyc_user ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(verification_status);
CREATE INDEX idx_kyc_type ON kyc_verifications(verification_type);
CREATE INDEX idx_kyc_nik ON kyc_verifications(extracted_nik) WHERE extracted_nik IS NOT NULL;
CREATE INDEX idx_kyc_created ON kyc_verifications(created_at);
```

### 2.3 Loans Table

```sql
CREATE TABLE loans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    loan_number TEXT UNIQUE NOT NULL, -- Format: LN-YYYYMMDD-XXXXX
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Loan Type & Product
    loan_type TEXT NOT NULL CHECK(loan_type IN ('conventional', 'sharia')),
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    
    -- Loan Amount & Terms
    principal_amount INTEGER NOT NULL CHECK(principal_amount BETWEEN 1000000 AND 50000000),
    interest_rate REAL NOT NULL, -- Daily rate as percentage
    interest_amount INTEGER NOT NULL,
    admin_fee INTEGER DEFAULT 0,
    insurance_fee INTEGER DEFAULT 0,
    other_fees INTEGER DEFAULT 0,
    total_fees INTEGER GENERATED ALWAYS AS (admin_fee + insurance_fee + other_fees) STORED,
    tenor_days INTEGER NOT NULL CHECK(tenor_days BETWEEN 7 AND 90),
    total_payment INTEGER NOT NULL,
    outstanding_amount INTEGER NOT NULL,
    
    -- Dates
    application_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    approval_date DATETIME,
    contract_date DATETIME,
    disbursement_date DATETIME,
    first_payment_date DATE,
    due_date DATE,
    paid_off_date DATETIME,
    
    -- Status & State
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'draft', 'pending', 'reviewing', 'approved', 'rejected', 'cancelled',
        'contract_signed', 'disbursing', 'disbursed', 'active', 
        'paid', 'overdue', 'restructured', 'written_off'
    )),
    sub_status TEXT, -- More detailed status
    previous_status TEXT,
    status_changed_at DATETIME,
    
    -- Approval Process
    auto_approved BOOLEAN DEFAULT 0,
    approval_tier TEXT CHECK(approval_tier IN ('auto', 'tier1', 'tier2', 'tier3')),
    approved_by TEXT REFERENCES users(id),
    approval_notes TEXT,
    rejection_reason TEXT,
    rejection_code TEXT,
    rejection_details JSON,
    
    -- Disbursement Information
    disbursement_method TEXT CHECK(disbursement_method IN ('bank_transfer', 'ewallet')),
    disbursement_channel TEXT,
    bank_code TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    disbursement_reference TEXT,
    disbursement_status TEXT,
    disbursement_failure_reason TEXT,
    
    -- Purpose & Usage
    purpose TEXT CHECK(purpose IN (
        'working_capital', 'education', 'healthcare', 'emergency', 
        'consumption', 'travel', 'renovation', 'other'
    )),
    purpose_detail TEXT,
    
    -- Location
    application_lat REAL,
    application_lng REAL,
    application_address TEXT,
    application_city TEXT,
    application_province TEXT,
    
    -- Risk Assessment
    credit_score_at_apply INTEGER,
    risk_level TEXT CHECK(risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    risk_score REAL,
    fraud_score REAL,
    pd_score REAL, -- Probability of Default
    lgd_score REAL, -- Loss Given Default
    
    -- Performance
    days_past_due INTEGER DEFAULT 0,
    max_days_past_due INTEGER DEFAULT 0,
    payment_performance TEXT CHECK(payment_performance IN ('excellent', 'good', 'fair', 'poor', 'default')),
    restructure_count INTEGER DEFAULT 0,
    extension_count INTEGER DEFAULT 0,
    
    -- Contract
    contract_url TEXT,
    contract_signed_at DATETIME,
    contract_ip_address TEXT,
    contract_device_id TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- Metadata
    source TEXT DEFAULT 'mobile_app',
    campaign_code TEXT,
    promo_code TEXT,
    agent_code TEXT,
    notes TEXT
);

-- Indexes
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_number ON loans(loan_number);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date);
CREATE INDEX idx_loans_disbursement_date ON loans(disbursement_date);
CREATE INDEX idx_loans_created ON loans(created_at);
CREATE INDEX idx_loans_risk_level ON loans(risk_level);
```

### 2.4 Payments Table

```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    payment_number TEXT UNIQUE NOT NULL, -- Format: PAY-YYYYMMDD-XXXXX
    loan_id TEXT NOT NULL REFERENCES loans(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Payment Amount
    amount INTEGER NOT NULL CHECK(amount > 0),
    principal_amount INTEGER,
    interest_amount INTEGER,
    penalty_amount INTEGER DEFAULT 0,
    fee_amount INTEGER DEFAULT 0,
    
    -- Payment Schedule
    installment_number INTEGER,
    due_date DATE,
    payment_date DATETIME,
    
    -- Payment Method & Channel
    payment_method TEXT NOT NULL CHECK(payment_method IN (
        'bank_transfer', 'virtual_account', 'ewallet', 'retail', 'other'
    )),
    payment_channel TEXT, -- BCA, Mandiri, DANA, GoPay, etc
    channel_reference TEXT,
    
    -- Virtual Account (if applicable)
    va_number TEXT,
    va_bank TEXT,
    va_expiry DATETIME,
    
    -- Payment Status
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'processing', 'success', 'failed', 
        'expired', 'cancelled', 'refunded'
    )),
    previous_status TEXT,
    status_changed_at DATETIME,
    
    -- Payment Gateway Response
    external_id TEXT,
    payment_gateway TEXT,
    gateway_response JSON,
    gateway_fee INTEGER,
    settlement_time DATETIME,
    
    -- Payment Proof
    payment_proof_url TEXT,
    payment_receipt_url TEXT,
    
    -- Verification
    verified_by TEXT REFERENCES users(id),
    verified_at DATETIME,
    verification_notes TEXT,
    
    -- Refund Information (if applicable)
    is_refunded BOOLEAN DEFAULT 0,
    refund_amount INTEGER,
    refund_reason TEXT,
    refund_date DATETIME,
    refund_reference TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    notes TEXT
);

-- Indexes
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_number ON payments(payment_number);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_due ON payments(due_date);
CREATE INDEX idx_payments_external ON payments(external_id);
```

### 2.5 Credit Scoring Logs Table

```sql
CREATE TABLE credit_scoring_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    loan_id TEXT REFERENCES loans(id),
    
    -- Score Changes
    previous_score INTEGER,
    new_score INTEGER,
    score_change INTEGER GENERATED ALWAYS AS (new_score - previous_score) STORED,
    score_category TEXT CHECK(score_category IN ('poor', 'fair', 'good', 'very_good', 'excellent')),
    
    -- Scoring Components
    base_score INTEGER,
    kyc_score INTEGER,
    financial_score INTEGER,
    behavioral_score INTEGER,
    payment_history_score INTEGER,
    risk_deduction INTEGER,
    
    -- Detailed Factors
    scoring_factors JSON, -- Array of factor objects
    positive_factors JSON,
    negative_factors JSON,
    
    -- Calculation Details
    calculation_method TEXT DEFAULT 'v1',
    calculation_details JSON,
    model_version TEXT,
    
    -- Trigger Information
    triggered_by TEXT CHECK(triggered_by IN (
        'system', 'kyc_complete', 'payment', 'default', 
        'loan_application', 'periodic_review', 'manual'
    )),
    trigger_detail TEXT,
    
    -- Timestamps
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_credit_scoring_user ON credit_scoring_logs(user_id);
CREATE INDEX idx_credit_scoring_loan ON credit_scoring_logs(loan_id);
CREATE INDEX idx_credit_scoring_date ON credit_scoring_logs(calculated_at);
```

### 2.6 Fraud Detection Logs Table

```sql
CREATE TABLE fraud_detection_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id),
    loan_id TEXT REFERENCES loans(id),
    
    -- Detection Information
    detection_type TEXT NOT NULL CHECK(detection_type IN (
        'device', 'behavior', 'document', 'network', 
        'velocity', 'identity', 'transaction', 'location'
    )),
    detection_method TEXT,
    detection_rule TEXT,
    
    -- Risk Assessment
    risk_score REAL CHECK(risk_score BETWEEN 0 AND 100),
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score REAL CHECK(confidence_score BETWEEN 0 AND 1),
    
    -- Fraud Indicators
    indicators JSON, -- Array of indicator objects
    matched_rules JSON, -- Array of matched rule IDs
    anomaly_details JSON,
    
    -- Device Information
    device_id TEXT,
    device_fingerprint TEXT,
    is_rooted BOOLEAN,
    is_emulator BOOLEAN,
    has_vpn BOOLEAN,
    has_proxy BOOLEAN,
    
    -- Network Information
    ip_address TEXT,
    ip_country TEXT,
    ip_region TEXT,
    ip_city TEXT,
    ip_isp TEXT,
    ip_risk_score REAL,
    
    -- Location Information
    latitude REAL,
    longitude REAL,
    location_accuracy REAL,
    location_provider TEXT,
    distance_from_home REAL,
    is_unusual_location BOOLEAN,
    
    -- Action Taken
    action_taken TEXT CHECK(action_taken IN (
        'allowed', 'flagged', 'challenged', 'blocked', 
        'manual_review', 'reported'
    )),
    action_reason TEXT,
    
    -- Review Process
    requires_review BOOLEAN DEFAULT 0,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at DATETIME,
    review_decision TEXT,
    review_notes TEXT,
    
    -- Timestamps
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    session_id TEXT,
    user_agent TEXT,
    app_version TEXT,
    additional_data JSON
);

-- Indexes
CREATE INDEX idx_fraud_user ON fraud_detection_logs(user_id);
CREATE INDEX idx_fraud_loan ON fraud_detection_logs(loan_id);
CREATE INDEX idx_fraud_risk_level ON fraud_detection_logs(risk_level);
CREATE INDEX idx_fraud_action ON fraud_detection_logs(action_taken);
CREATE INDEX idx_fraud_date ON fraud_detection_logs(detected_at);
CREATE INDEX idx_fraud_device ON fraud_detection_logs(device_id);
CREATE INDEX idx_fraud_ip ON fraud_detection_logs(ip_address);
```

---

## 3. Supporting Tables Schema

### 3.1 Notifications Table

```sql
CREATE TABLE notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Notification Details
    notification_type TEXT NOT NULL CHECK(notification_type IN (
        'otp', 'loan_approved', 'loan_rejected', 'loan_disbursed',
        'payment_reminder', 'payment_received', 'payment_failed',
        'overdue_reminder', 'kyc_required', 'kyc_verified',
        'promotion', 'announcement', 'other'
    )),
    category TEXT CHECK(category IN ('transactional', 'reminder', 'marketing', 'system')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Content
    title TEXT,
    message TEXT NOT NULL,
    action_url TEXT,
    image_url TEXT,
    
    -- Delivery Channel
    channel TEXT NOT NULL CHECK(channel IN (
        'push', 'sms', 'email', 'whatsapp', 'in_app'
    )),
    
    -- Scheduling
    scheduled_at DATETIME,
    send_after DATETIME,
    expires_at DATETIME,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'queued', 'sending', 'sent', 
        'delivered', 'failed', 'expired', 'cancelled', 'read'
    )),
    
    -- Delivery Information
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    failed_at DATETIME,
    
    -- Error Handling
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at DATETIME,
    
    -- External Service
    external_provider TEXT,
    external_id TEXT,
    external_response JSON,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    template_id TEXT,
    template_params JSON,
    tags JSON,
    reference_type TEXT,
    reference_id TEXT
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at);
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

### 3.2 User Sessions Table

```sql
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Session Information
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    
    -- Device Information
    device_id TEXT NOT NULL,
    device_type TEXT,
    device_model TEXT,
    device_os TEXT,
    app_version TEXT,
    
    -- Network Information
    ip_address TEXT,
    user_agent TEXT,
    
    -- Session Status
    is_active BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    refresh_expires_at DATETIME,
    revoked_at DATETIME,
    
    -- Security
    is_trusted_device BOOLEAN DEFAULT 0,
    biometric_enabled BOOLEAN DEFAULT 0
);

-- Indexes
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_refresh ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_device ON user_sessions(device_id);
CREATE INDEX idx_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
```

### 3.3 Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Actor Information
    user_id TEXT REFERENCES users(id),
    user_type TEXT,
    user_name TEXT,
    
    -- Action Information
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    
    -- Change Details
    old_values JSON,
    new_values JSON,
    changed_fields JSON,
    
    -- Context
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'error')),
    error_message TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

### 3.4 Blacklist Table

```sql
CREATE TABLE blacklist (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Identifier
    identifier_type TEXT NOT NULL CHECK(identifier_type IN (
        'nik', 'phone', 'email', 'device_id', 'ip_address', 'bank_account'
    )),
    identifier_value TEXT NOT NULL,
    
    -- Blacklist Information
    reason TEXT NOT NULL,
    reason_code TEXT,
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Source
    source TEXT CHECK(source IN ('internal', 'ojk', 'partner', 'bank', 'police')),
    source_reference TEXT,
    
    -- Management
    added_by TEXT REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    removed_by TEXT REFERENCES users(id),
    
    -- Status
    is_active BOOLEAN DEFAULT 1,
    expires_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    removed_at DATETIME,
    
    -- Notes
    notes TEXT,
    evidence_url TEXT
);

-- Unique constraint
CREATE UNIQUE INDEX idx_blacklist_unique ON blacklist(identifier_type, identifier_value) WHERE is_active = 1;
-- Other indexes
CREATE INDEX idx_blacklist_type ON blacklist(identifier_type);
CREATE INDEX idx_blacklist_value ON blacklist(identifier_value);
CREATE INDEX idx_blacklist_active ON blacklist(is_active);
```

### 3.5 System Configuration Table

```sql
CREATE TABLE system_configurations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Configuration Details
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type TEXT CHECK(config_type IN ('string', 'number', 'boolean', 'json')),
    
    -- Category
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Description
    description TEXT,
    
    -- Validation
    min_value REAL,
    max_value REAL,
    allowed_values JSON,
    
    -- Status
    is_active BOOLEAN DEFAULT 1,
    is_editable BOOLEAN DEFAULT 1,
    requires_restart BOOLEAN DEFAULT 0,
    
    -- Audit
    updated_by TEXT REFERENCES users(id),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_config_key ON system_configurations(config_key);
CREATE INDEX idx_config_category ON system_configurations(category);
CREATE INDEX idx_config_active ON system_configurations(is_active);

-- Default configurations
INSERT INTO system_configurations (config_key, config_value, config_type, category, description) VALUES
('max_loan_amount', '50000000', 'number', 'loan', 'Maximum loan amount in IDR'),
('min_loan_amount', '1000000', 'number', 'loan', 'Minimum loan amount in IDR'),
('max_tenor_days', '90', 'number', 'loan', 'Maximum loan tenor in days'),
('min_tenor_days', '7', 'number', 'loan', 'Minimum loan tenor in days'),
('daily_interest_rate', '0.8', 'number', 'loan', 'Daily interest rate as percentage'),
('admin_fee_percentage', '3', 'number', 'loan', 'Admin fee as percentage of principal'),
('late_fee_percentage', '0.5', 'number', 'loan', 'Daily late fee as percentage'),
('min_credit_score_auto_approve', '650', 'number', 'scoring', 'Minimum credit score for auto approval'),
('max_payment_retry', '3', 'number', 'payment', 'Maximum payment retry attempts'),
('otp_expiry_minutes', '5', 'number', 'auth', 'OTP expiry time in minutes'),
('session_timeout_minutes', '15', 'number', 'auth', 'Session timeout in minutes'),
('max_login_attempts', '5', 'number', 'auth', 'Maximum failed login attempts before lockout');
```

---

## 4. Accounting Tables

### 4.1 Chart of Accounts Table

```sql
CREATE TABLE chart_of_accounts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Account Information
    account_code TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_name_en TEXT,
    
    -- Classification
    account_type TEXT NOT NULL CHECK(account_type IN (
        'asset', 'liability', 'equity', 'revenue', 'expense'
    )),
    account_category TEXT,
    account_subcategory TEXT,
    
    -- Hierarchy
    parent_account_code TEXT REFERENCES chart_of_accounts(account_code),
    level INTEGER NOT NULL,
    is_header BOOLEAN DEFAULT 0,
    
    -- Properties
    normal_balance TEXT CHECK(normal_balance IN ('debit', 'credit')),
    is_active BOOLEAN DEFAULT 1,
    is_cash_account BOOLEAN DEFAULT 0,
    is_bank_account BOOLEAN DEFAULT 0,
    
    -- Bank Details (if applicable)
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_coa_code ON chart_of_accounts(account_code);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_code);
```

### 4.2 Journal Entries Table

```sql
CREATE TABLE journal_entries (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Journal Information
    journal_number TEXT UNIQUE NOT NULL, -- Format: JV-YYYYMM-XXXXX
    journal_date DATE NOT NULL,
    journal_type TEXT CHECK(journal_type IN (
        'general', 'disbursement', 'payment', 'adjustment', 'closing'
    )),
    
    -- Description
    description TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'posted', 'void')),
    
    -- Audit
    created_by TEXT REFERENCES users(id),
    posted_by TEXT REFERENCES users(id),
    posted_at DATETIME,
    voided_by TEXT REFERENCES users(id),
    voided_at DATETIME,
    void_reason TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_journal_number ON journal_entries(journal_number);
CREATE INDEX idx_journal_date ON journal_entries(journal_date);
CREATE INDEX idx_journal_status ON journal_entries(status);
CREATE INDEX idx_journal_reference ON journal_entries(reference_type, reference_id);
```

### 4.3 Journal Lines Table

```sql
CREATE TABLE journal_lines (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
    
    -- Line Information
    line_number INTEGER NOT NULL,
    account_code TEXT NOT NULL REFERENCES chart_of_accounts(account_code),
    
    -- Amounts
    debit_amount INTEGER DEFAULT 0 CHECK(debit_amount >= 0),
    credit_amount INTEGER DEFAULT 0 CHECK(credit_amount >= 0),
    
    -- Description
    description TEXT,
    
    -- Dimensions
    cost_center TEXT,
    project_code TEXT,
    
    -- Constraints
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    ),
    
    -- Unique constraint
    UNIQUE(journal_entry_id, line_number)
);

-- Indexes
CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_code);
```

---

## 5. Collection Tables

### 5.1 Collection Cases Table

```sql
CREATE TABLE collection_cases (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    case_number TEXT UNIQUE NOT NULL, -- Format: COLL-YYYYMM-XXXXX
    
    -- Loan Information
    loan_id TEXT NOT NULL REFERENCES loans(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Case Details
    days_overdue INTEGER NOT NULL,
    overdue_amount INTEGER NOT NULL,
    total_amount_due INTEGER NOT NULL,
    
    -- Collection Stage
    collection_stage TEXT CHECK(collection_stage IN (
        'soft_reminder', 'first_warning', 'intensive', 
        'legal_notice', 'legal_action', 'write_off'
    )),
    escalation_level INTEGER DEFAULT 1,
    
    -- Assignment
    assigned_to TEXT REFERENCES users(id),
    assigned_at DATETIME,
    team TEXT,
    
    -- Status
    status TEXT DEFAULT 'open' CHECK(status IN (
        'open', 'in_progress', 'promised', 'partial_paid', 
        'paid', 'closed', 'escalated', 'legal'
    )),
    
    -- Promise to Pay
    has_promise BOOLEAN DEFAULT 0,
    promise_date DATE,
    promise_amount INTEGER,
    
    -- Results
    resolution TEXT,
    resolution_date DATETIME,
    amount_collected INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
);

-- Indexes
CREATE INDEX idx_collection_loan ON collection_cases(loan_id);
CREATE INDEX idx_collection_user ON collection_cases(user_id);
CREATE INDEX idx_collection_status ON collection_cases(status);
CREATE INDEX idx_collection_assigned ON collection_cases(assigned_to);
CREATE INDEX idx_collection_stage ON collection_cases(collection_stage);
```

### 5.2 Collection Activities Table

```sql
CREATE TABLE collection_activities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    case_id TEXT NOT NULL REFERENCES collection_cases(id),
    
    -- Activity Information
    activity_type TEXT NOT NULL CHECK(activity_type IN (
        'call', 'sms', 'whatsapp', 'email', 'visit', 
        'letter', 'promise', 'payment', 'note'
    )),
    activity_result TEXT,
    
    -- Contact Details
    contact_person TEXT,
    contact_number TEXT,
    
    -- Content
    subject TEXT,
    content TEXT,
    
    -- Response
    response TEXT,
    customer_response TEXT,
    
    -- Promise Details (if applicable)
    promise_amount INTEGER,
    promise_date DATE,
    
    -- Performed By
    performed_by TEXT REFERENCES users(id),
    
    -- Timestamps
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_collection_activity_case ON collection_activities(case_id);
CREATE INDEX idx_collection_activity_type ON collection_activities(activity_type);
CREATE INDEX idx_collection_activity_date ON collection_activities(performed_at);
```

---

## 6. Database Views

### 6.1 Active Loans View

```sql
CREATE VIEW view_active_loans AS
SELECT 
    l.id,
    l.loan_number,
    l.user_id,
    u.full_name,
    u.phone,
    l.principal_amount,
    l.outstanding_amount,
    l.due_date,
    l.days_past_due,
    l.status,
    l.risk_level,
    CASE 
        WHEN l.days_past_due = 0 THEN 'current'
        WHEN l.days_past_due BETWEEN 1 AND 7 THEN 'late'
        WHEN l.days_past_due BETWEEN 8 AND 30 THEN 'overdue'
        WHEN l.days_past_due > 30 THEN 'default'
    END as payment_status
FROM loans l
JOIN users u ON l.user_id = u.id
WHERE l.status IN ('active', 'overdue')
  AND l.deleted_at IS NULL;
```

### 6.2 User Credit Summary View

```sql
CREATE VIEW view_user_credit_summary AS
SELECT 
    u.id,
    u.full_name,
    u.credit_score,
    u.credit_limit,
    COUNT(DISTINCT l.id) as total_loans,
    SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) as active_loans,
    SUM(CASE WHEN l.status = 'paid' THEN 1 ELSE 0 END) as paid_loans,
    SUM(CASE WHEN l.status = 'overdue' THEN 1 ELSE 0 END) as overdue_loans,
    MAX(l.created_at) as last_loan_date,
    SUM(l.principal_amount) as total_borrowed,
    SUM(p.amount) as total_paid
FROM users u
LEFT JOIN loans l ON u.id = l.user_id
LEFT JOIN payments p ON l.id = p.loan_id AND p.status = 'success'
GROUP BY u.id, u.full_name, u.credit_score, u.credit_limit;
```

### 6.3 Daily Transaction Summary View

```sql
CREATE VIEW view_daily_transactions AS
SELECT 
    DATE(created_at) as transaction_date,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as applications,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approvals,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejections,
    COUNT(CASE WHEN status = 'disbursed' THEN 1 END) as disbursements,
    SUM(CASE WHEN status = 'disbursed' THEN principal_amount ELSE 0 END) as disbursed_amount,
    AVG(CASE WHEN status = 'disbursed' THEN principal_amount ELSE NULL END) as avg_loan_amount
FROM loans
WHERE created_at >= date('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY transaction_date DESC;
```

---

## 7. Database Triggers

### 7.1 Update Timestamps Trigger

```sql
-- Trigger for users table
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Similar triggers for other tables
CREATE TRIGGER update_loans_timestamp 
AFTER UPDATE ON loans
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE loans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### 7.2 Audit Log Trigger

```sql
CREATE TRIGGER audit_user_changes
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, 
        action, 
        entity_type, 
        entity_id,
        old_values,
        new_values,
        created_at
    ) VALUES (
        NEW.id,
        'update',
        'user',
        NEW.id,
        json_object('status', OLD.status, 'credit_score', OLD.credit_score),
        json_object('status', NEW.status, 'credit_score', NEW.credit_score),
        CURRENT_TIMESTAMP
    );
END;
```

### 7.3 Loan Status Change Trigger

```sql
CREATE TRIGGER loan_status_change
AFTER UPDATE OF status ON loans
FOR EACH ROW
WHEN NEW.status != OLD.status
BEGIN
    UPDATE loans 
    SET 
        previous_status = OLD.status,
        status_changed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
    
    -- Create notification for status change
    INSERT INTO notifications (
        user_id,
        notification_type,
        title,
        message,
        channel
    ) VALUES (
        NEW.user_id,
        CASE 
            WHEN NEW.status = 'approved' THEN 'loan_approved'
            WHEN NEW.status = 'rejected' THEN 'loan_rejected'
            WHEN NEW.status = 'disbursed' THEN 'loan_disbursed'
            ELSE 'loan_status_change'
        END,
        'Status Pinjaman Berubah',
        'Status pinjaman Anda telah diperbarui menjadi ' || NEW.status,
        'push'
    );
END;
```

---

## 8. Database Indexes Strategy

### 8.1 Index Naming Convention
- Primary Key: Automatic by SQLite
- Unique: `idx_{table}_{column}_unique`
- Single Column: `idx_{table}_{column}`
- Composite: `idx_{table}_{col1}_{col2}`
- Partial: `idx_{table}_{column}_where_{condition}`

### 8.2 Critical Indexes for Performance

```sql
-- Composite indexes for common queries
CREATE INDEX idx_loans_user_status ON loans(user_id, status);
CREATE INDEX idx_payments_loan_status ON payments(loan_id, status);
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);

-- Partial indexes for active records
CREATE INDEX idx_loans_active ON loans(status) WHERE status IN ('active', 'overdue');
CREATE INDEX idx_users_active ON users(status) WHERE status = 'active';

-- Covering indexes for frequent queries
CREATE INDEX idx_loans_dashboard ON loans(user_id, status, principal_amount, due_date, created_at);
```

---

## 9. Data Migration & Maintenance

### 9.1 Archive Strategy

```sql
-- Archive old completed loans
CREATE TABLE loans_archive AS 
SELECT * FROM loans 
WHERE status IN ('paid', 'written_off') 
  AND updated_at < date('now', '-2 years');

-- Archive old notifications
CREATE TABLE notifications_archive AS
SELECT * FROM notifications
WHERE created_at < date('now', '-90 days');
```

### 9.2 Data Cleanup Procedures

```sql
-- Clean up expired sessions
DELETE FROM user_sessions 
WHERE expires_at < CURRENT_TIMESTAMP;

-- Clean up old audit logs
DELETE FROM audit_logs 
WHERE created_at < date('now', '-7 years');

-- Clean up failed notifications
DELETE FROM notifications 
WHERE status = 'failed' 
  AND created_at < date('now', '-30 days');
```

### 9.3 Database Optimization

```sql
-- Analyze tables for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Rebuild indexes
REINDEX;
```

---

## 10. Security Considerations

### 10.1 Sensitive Data Handling
- Password fields use `_hash` suffix and are never stored in plain text
- PII fields (NIK, bank account) are encrypted at application level
- Audit logs track all sensitive data access
- Row-level security implemented at application layer

### 10.2 Access Control
- Database accessed only through TrailBase API
- No direct database connections allowed
- All queries parameterized to prevent SQL injection
- Database file encrypted at rest

### 10.3 Backup & Recovery
- Daily automated backups to cloud storage
- Point-in-time recovery capability
- Backup encryption with separate key management
- Regular backup restoration tests

---

*End of Database Schema Documentation*