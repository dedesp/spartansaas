# TrailBase Extensions

Business logic extensions for KreditKu application.

## Structure

```
extensions/
├── auth/           # Authentication & Authorization
├── loans/          # Loan Management
├── payments/       # Payment Processing
├── kyc/            # KYC Verification (to be implemented)
├── scoring/        # Credit Scoring (to be implemented)
├── fraud/          # Fraud Detection (to be implemented)
├── notifications/  # Multi-channel Notifications (to be implemented)
└── accounting/     # Accounting Module (to be implemented)
```

## Implemented Extensions

### 1. Auth Extension (`auth/index.js`)

**Functions:**
- `register(ctx)` - User registration with password hashing
- `login(ctx)` - User authentication with JWT tokens
- `refresh(ctx)` - Refresh access token
- `logout(ctx)` - End user session

**Features:**
- bcrypt password hashing
- JWT access & refresh tokens
- Account lockout after failed attempts
- Session management
- Audit logging

### 2. Loans Extension (`loans/index.js`)

**Functions:**
- `applyLoan(ctx)` - Submit loan application
- `getUserLoans(ctx)` - Get user's loan history
- `getLoanDetails(ctx)` - Get loan details with payments
- `cancelLoan(ctx)` - Cancel pending loan

**Features:**
- Loan amount & tenor validation
- Interest calculation (conventional & sharia)
- KYC verification check
- Active loan prevention
- Credit score logging
- Automatic notifications

### 3. Payments Extension (`payments/index.js`)

**Functions:**
- `createPayment(ctx)` - Initiate payment
- `confirmPayment(ctx)` - Confirm payment (webhook)
- `getPaymentHistory(ctx)` - Get payment history

**Features:**
- Payment validation
- Outstanding amount tracking
- Automatic loan status update
- Credit score improvement on full payment
- Multi-channel notifications

## Usage Example

### Register User
```javascript
POST /api/auth/register
{
  "email": "john@domain.com",
  "phone": "081234567890",
  "password": "[YOUR_PASSWORD]",
  "full_name": "John Doe",
  "birth_date": "1990-01-15"
}
```

### Login
```javascript
POST /api/auth/login
{
  "phone": "081234567890",
  "password": "[YOUR_PASSWORD]"
}

Response:
{
  "success": true,
  "access_token": "[TOKEN]",
  "refresh_token": "[REFRESH]",
  "expires_in": 900
}
```

### Apply for Loan
```javascript
POST /api/loans/apply
Authorization: Bearer {access_token}
{
  "loan_type": "conventional",
  "principal_amount": 5000000,
  "tenor_days": 30,
  "purpose": "working_capital"
}
```

### Make Payment
```javascript
POST /api/payments/create
Authorization: Bearer {access_token}
{
  "loan_id": "abc123",
  "amount": 5500000,
  "payment_method": "bank_transfer"
}
```

## Configuration

Extensions read configuration from `traildepot/config.js`:

- **Loan limits**: `config.loan.minAmount`, `config.loan.maxAmount`
- **Interest rates**: `config.loan.conventional.dailyInterestRate`
- **JWT settings**: `config.auth.jwt.secret`
- **Security**: `config.security.rateLimit`

## Database Access

Extensions use TrailBase's database API:

```javascript
// Single row
const user = await ctx.db.get('SELECT * FROM users WHERE id = ?', [userId]);

// Multiple rows
const loans = await ctx.db.all('SELECT * FROM loans WHERE user_id = ?', [userId]);

// Insert/Update
const result = await ctx.db.run('INSERT INTO users (...) VALUES (...)', [...]);
```

## Error Handling

All extensions return consistent JSON responses:

**Success:**
```json
{
  "success": true,
  "data": {...}
}
```

**Error:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Testing

Run tests (when implemented):
```bash
trailbase test --extensions ./traildepot/extensions
```

## To Be Implemented

- [ ] KYC Extension - OCR, face recognition
- [ ] Scoring Extension - Credit score calculation
- [ ] Fraud Extension - Real-time fraud detection
- [ ] Notifications Extension - Push, SMS, email, WhatsApp
- [ ] Accounting Extension - Journal entries, reports

## Security Notes

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire after 15 minutes (access) / 7 days (refresh)
- Failed login attempts trigger account lockout
- All actions are logged in audit_logs table
- Rate limiting applies per endpoint (configured in config.js)
