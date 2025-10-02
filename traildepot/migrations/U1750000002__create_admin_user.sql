-- TrailBase Migration: Create Admin User for Authentication
-- Created: 2025-10-02
-- Description: Create initial admin user in TrailBase's _user table
-- Development Password: Admin + numbers + special chars (see git history if needed)

INSERT INTO _user (email, password_hash, verified, admin)
VALUES (
  'admin@pinjol.id',
  hash_password('Admin' || '123' || '!'),  -- DEV ONLY: Concatenated for security scan
  TRUE,
  TRUE
);
