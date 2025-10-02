/**
 * Authentication Extension for TrailBase
 * Handles user registration, login, OTP verification
 */

import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'PLACEHOLDER_CHANGE_IN_PRODUCTION';

/**
 * Register new user
 */
export async function register(ctx) {
  const { email, phone, password, full_name, birth_date } = ctx.request.body;
  
  // Validation
  if (!email || !phone || !password || !full_name) {
    return ctx.json({ error: 'Missing required fields' }, 400);
  }
  
  // Check if user exists
  const existing = await ctx.db.get(
    'SELECT id FROM users WHERE email = ? OR phone = ?',
    [email, phone]
  );
  
  if (existing) {
    return ctx.json({ error: 'User already exists' }, 409);
  }
  
  // Hash password
  const password_hash = await hash(password, SALT_ROUNDS);
  
  // Create user
  const result = await ctx.db.run(
    `INSERT INTO users (email, phone, password_hash, full_name, birth_date, status)
     VALUES (?, ?, ?, ?, ?, 'inactive')`,
    [email, phone, password_hash, full_name, birth_date]
  );
  
  const userId = result.lastID;
  
  // Log audit
  await ctx.db.run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
     VALUES (?, 'register', 'user', ?, ?, ?)`,
    [userId, userId, ctx.request.ip, ctx.request.headers['user-agent']]
  );
  
  return ctx.json({
    success: true,
    user_id: userId,
    message: 'Registration successful. Please verify your phone.'
  }, 201);
}

/**
 * Login user
 */
export async function login(ctx) {
  const { phone, password } = ctx.request.body;
  
  if (!phone || !password) {
    return ctx.json({ error: 'Phone and password required' }, 400);
  }
  
  // Get user
  const user = await ctx.db.get(
    'SELECT id, password_hash, status, failed_login_attempts, locked_until FROM users WHERE phone = ?',
    [phone]
  );
  
  if (!user) {
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }
  
  // Check if locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return ctx.json({ error: 'Account temporarily locked' }, 423);
  }
  
  // Check if suspended
  if (user.status === 'suspended' || user.status === 'blacklisted') {
    return ctx.json({ error: 'Account suspended' }, 403);
  }
  
  // Verify password
  const valid = await compare(password, user.password_hash);
  
  if (!valid) {
    // Increment failed attempts
    const attempts = (user.failed_login_attempts || 0) + 1;
    const locked_until = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
    
    await ctx.db.run(
      'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
      [attempts, locked_until, user.id]
    );
    
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }
  
  // Generate tokens
  const accessToken = sign(
    { user_id: user.id, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = sign(
    { user_id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Create session
  await ctx.db.run(
    `INSERT INTO user_sessions (user_id, session_token, refresh_token, device_id, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))`,
    [user.id, accessToken, refreshToken, ctx.request.body.device_id, ctx.request.ip]
  );
  
  // Reset failed attempts
  await ctx.db.run(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
    [user.id]
  );
  
  return ctx.json({
    success: true,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900
  });
}

/**
 * Refresh access token
 */
export async function refresh(ctx) {
  const { refresh_token } = ctx.request.body;
  
  if (!refresh_token) {
    return ctx.json({ error: 'Refresh token required' }, 400);
  }
  
  try {
    const decoded = verify(refresh_token, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return ctx.json({ error: 'Invalid token type' }, 401);
    }
    
    // Check session
    const session = await ctx.db.get(
      'SELECT user_id FROM user_sessions WHERE refresh_token = ? AND is_active = 1',
      [refresh_token]
    );
    
    if (!session) {
      return ctx.json({ error: 'Invalid session' }, 401);
    }
    
    // Generate new access token
    const accessToken = sign(
      { user_id: decoded.user_id, type: 'access' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    return ctx.json({
      success: true,
      access_token: accessToken,
      expires_in: 900
    });
    
  } catch (err) {
    return ctx.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Logout user
 */
export async function logout(ctx) {
  const token = ctx.request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return ctx.json({ error: 'No token provided' }, 400);
  }
  
  // Deactivate session
  await ctx.db.run(
    'UPDATE user_sessions SET is_active = 0 WHERE session_token = ?',
    [token]
  );
  
  return ctx.json({ success: true, message: 'Logged out successfully' });
}

export default {
  register,
  login,
  refresh,
  logout
};
