-- KreditKu Database Schema - Migration 002
-- KYC, Credit Scoring, and Fraud Detection tables

PRAGMA foreign_keys = ON;

-- KYC Verifications Table
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    verification_type TEXT NOT NULL CHECK(verification_type IN ('id_card', 'selfie', 'liveness')),
    
    document_type TEXT,
    document_number TEXT,
    document_front_url TEXT,
    document_back_url TEXT,
    selfie_url TEXT,
    
    ocr_data JSON,
    face_match_score REAL,
    liveness_score REAL,
    
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'verified', 'rejected', 'expired')),
    rejection_reason TEXT,
    
    verified_by TEXT REFERENCES users(id),
    verified_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_user ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);
CREATE INDEX idx_kyc_type ON kyc_verifications(verification_type);

-- Credit Scoring Logs Table
CREATE TABLE IF NOT EXISTS credit_scoring_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    loan_id TEXT REFERENCES loans(id),
    
    score_type TEXT NOT NULL CHECK(score_type IN ('application', 'periodic', 'event_triggered')),
    previous_score INTEGER,
    new_score INTEGER NOT NULL,
    score_change INTEGER,
    
    factors JSON,
    calculation_method TEXT,
    model_version TEXT,
    
    trigger_event TEXT,
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scoring_user ON credit_scoring_logs(user_id);
CREATE INDEX idx_scoring_loan ON credit_scoring_logs(loan_id);
CREATE INDEX idx_scoring_date ON credit_scoring_logs(created_at);

-- Fraud Detection Logs Table
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id),
    loan_id TEXT REFERENCES loans(id),
    
    detection_type TEXT NOT NULL CHECK(detection_type IN ('device', 'behavior', 'document', 'pattern')),
    risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score REAL NOT NULL,
    
    fraud_indicators JSON,
    device_fingerprint TEXT,
    ip_address TEXT,
    location_data JSON,
    
    action_taken TEXT CHECK(action_taken IN ('none', 'flag', 'review', 'block', 'reject')),
    is_false_positive BOOLEAN DEFAULT 0,
    
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at DATETIME,
    review_notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_user ON fraud_detection_logs(user_id);
CREATE INDEX idx_fraud_loan ON fraud_detection_logs(loan_id);
CREATE INDEX idx_fraud_risk ON fraud_detection_logs(risk_level);
CREATE INDEX idx_fraud_date ON fraud_detection_logs(created_at);

SELECT 'Migration 002 completed: KYC, Credit Scoring, Fraud Detection tables' AS result;
