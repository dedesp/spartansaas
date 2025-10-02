-- KreditKu Database Schema - Migration 003
-- Notifications, Audit Logs, and System tables

PRAGMA foreign_keys = ON;

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    type TEXT NOT NULL CHECK(type IN ('loan_status', 'payment_due', 'payment_received', 'kyc_update', 'system', 'promo')),
    channel TEXT NOT NULL CHECK(channel IN ('push', 'sms', 'email', 'whatsapp', 'in_app')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_status ON notifications(status);
CREATE INDEX idx_notif_type ON notifications(type);
CREATE INDEX idx_notif_created ON notifications(created_at);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id),
    
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    
    old_values JSON,
    new_values JSON,
    changes JSON,
    
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    
    status TEXT CHECK(status IN ('success', 'failed')),
    error_message TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    
    device_id TEXT,
    device_name TEXT,
    device_os TEXT,
    app_version TEXT,
    
    ip_address TEXT,
    location TEXT,
    
    is_active BOOLEAN DEFAULT 1,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_user ON user_sessions(user_id);
CREATE INDEX idx_session_token ON user_sessions(session_token);
CREATE INDEX idx_session_active ON user_sessions(is_active);

-- Blacklist Table
CREATE TABLE IF NOT EXISTS blacklist (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    blacklist_type TEXT NOT NULL CHECK(blacklist_type IN ('user', 'phone', 'email', 'device', 'ip')),
    value TEXT NOT NULL,
    
    reason TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
    
    added_by TEXT REFERENCES users(id),
    expires_at DATETIME,
    
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_blacklist_unique ON blacklist(blacklist_type, value);
CREATE INDEX idx_blacklist_type ON blacklist(blacklist_type);
CREATE INDEX idx_blacklist_active ON blacklist(is_active);

SELECT 'Migration 003 completed: Notifications, Audit, Sessions, Blacklist tables' AS result;
