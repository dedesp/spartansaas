# Requirements Specification Document
## Aplikasi Pinjol KreditKu

### Versi: 1.0
### Tanggal: Desember 2024
### Status: Draft

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen
Dokumen ini mendefinisikan spesifikasi kebutuhan fungsional dan non-fungsional untuk pengembangan aplikasi pinjaman online "KreditKu" yang berbasis pada teknologi TrailBase. Dokumen ini menjadi acuan bagi tim pengembang, stakeholder, dan pihak terkait dalam memahami scope dan requirements aplikasi.

### 1.2 Ruang Lingkup
Aplikasi KreditKu adalah platform pinjaman online yang melayani:
- Pinjaman konvensional dan syariah
- Limit pinjaman Rp 1-50 juta dengan tenor 7-90 hari
- Area layanan: Jabodetabek dan Bandung Raya
- Platform: Web dashboard untuk admin, Mobile app untuk nasabah

### 1.3 Definisi & Singkatan
- **KTP**: Kartu Tanda Penduduk
- **NIK**: Nomor Induk Kependudukan
- **OJK**: Otoritas Jasa Keuangan
- **AFPI**: Asosiasi Fintech Pendanaan Bersama Indonesia
- **NPL**: Non-Performing Loan
- **KYC**: Know Your Customer
- **AML**: Anti Money Laundering
- **API**: Application Programming Interface
- **JWT**: JSON Web Token
- **OTP**: One Time Password
- **VA**: Virtual Account

---

## 2. Deskripsi Umum Sistem

### 2.1 Perspektif Produk
KreditKu adalah sistem pinjaman online terintegrasi yang terdiri dari:
- Backend server berbasis TrailBase
- Web dashboard untuk pengelola
- Mobile application untuk nasabah
- Integrasi dengan layanan eksternal (payment gateway, KYC services)

### 2.2 Fungsi Produk Utama
1. **Manajemen Pengguna**: Registrasi, login, profile management
2. **Verifikasi Identitas**: KYC dengan facial recognition dan OCR KTP
3. **Pengajuan Pinjaman**: Apply, review, approval workflow
4. **Pencairan Dana**: Disbursement ke rekening nasabah
5. **Pembayaran**: Multiple payment channels
6. **Penagihan**: Automated reminders dan collection
7. **Reporting**: Financial dan operational reports

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Deskripsi | Hak Akses |
|---------------|-----------|-----------|
| Nasabah | End user yang mengajukan pinjaman | Aplikasi mobile, self-service |
| Admin | Pengelola sistem | Full access dashboard |
| Credit Analyst | Melakukan review aplikasi | Loan review, KYC verification |
| Collector | Menangani penagihan | Collection dashboard |
| Accountant | Mengelola keuangan | Financial reports, reconciliation |
| Super Admin | System administrator | System configuration, user management |

### 2.4 Batasan & Asumsi
**Batasan:**
- Maksimal pinjaman Rp 50 juta per user
- Bunga maksimal 0.8% per hari (sesuai regulasi OJK)
- Area layanan terbatas pada Jabodetabek & Bandung Raya
- Minimal usia peminjam 21 tahun

**Asumsi:**
- User memiliki smartphone Android/iOS
- User memiliki rekening bank aktif
- Koneksi internet stabil tersedia
- User memiliki KTP yang valid

---

## 3. Kebutuhan Fungsional

### 3.1 Modul Autentikasi & Otorisasi

#### FR-AUTH-001: Registrasi Pengguna
**Deskripsi**: Sistem harus menyediakan fungsi registrasi untuk pengguna baru
**Input**:
- Nomor telepon (unique)
- Email
- Password (min 8 karakter, kombinasi huruf, angka, simbol)
- Nama lengkap
- Tanggal lahir

**Proses**:
1. Validasi format input
2. Cek duplikasi nomor telepon/email
3. Kirim OTP ke nomor telepon
4. Verifikasi OTP
5. Enkripsi password dengan Argon2
6. Buat user record dengan status 'inactive'

**Output**: User berhasil terdaftar, redirect ke KYC

#### FR-AUTH-002: Login Multi-Factor
**Deskripsi**: Login dengan phone number, password, dan OTP
**Input**:
- Nomor telepon
- Password
- Device ID
- OTP (step 2)

**Proses**:
1. Validasi credentials
2. Generate dan kirim OTP
3. Verifikasi OTP
4. Generate JWT access token (15 menit)
5. Generate refresh token (7 hari)
6. Log aktivitas login

**Output**: Access token, refresh token, user profile

#### FR-AUTH-003: Biometric Authentication
**Deskripsi**: Login menggunakan fingerprint/face ID untuk trusted devices
**Prerequisite**: Device sudah registered dan biometric enabled
**Process**: 
1. Verify biometric
2. Validate device ID
3. Generate tokens

### 3.2 Modul KYC (Know Your Customer)

#### FR-KYC-001: Upload Dokumen KTP
**Deskripsi**: Upload dan verifikasi foto KTP
**Input**: 
- Foto KTP (max 5MB, format JPG/PNG)
- Metadata device

**Proses**:
1. Validasi format dan ukuran file
2. Upload ke object storage
3. OCR extraction (NIK, nama, alamat, TTL)
4. Validasi format NIK (16 digit)
5. Cek blacklist database
6. Store extracted data

**Output**: KTP data extracted, verification status

#### FR-KYC-002: Selfie Verification
**Deskripsi**: Verifikasi selfie dengan liveness detection
**Input**:
- Selfie photo
- Selfie with KTP

**Proses**:
1. Liveness detection (score > 0.8)
2. Face matching dengan foto KTP (score > 0.85)
3. Quality assessment
4. Store verification result

**Output**: Liveness score, matching score, verification status

#### FR-KYC-003: Data Verification
**Deskripsi**: Verifikasi data tambahan
**Input**:
- Alamat tinggal saat ini
- Data pekerjaan
- Penghasilan bulanan
- Kontak darurat

**Validasi**:
- Phone number format
- Income range validation
- Address completeness

### 3.3 Modul Pinjaman

#### FR-LOAN-001: Pengajuan Pinjaman
**Deskripsi**: User mengajukan pinjaman baru
**Prerequisite**: KYC verified, no active loan
**Input**:
- Jumlah pinjaman (Rp 1-50 juta)
- Tenor (7-90 hari)
- Tujuan pinjaman
- Tipe pinjaman (konvensional/syariah)
- Metode pencairan

**Proses**:
1. Validasi eligibility
2. Calculate credit score
3. Fraud detection check
4. Calculate interest & fees
5. Generate loan terms
6. Create loan application

**Output**: Loan application created, terms presented

#### FR-LOAN-002: Review & Approval
**Deskripsi**: Review dan approval aplikasi pinjaman
**Actor**: Credit Analyst / System (auto-approve)
**Process**:
1. Auto-scoring (score > 650 = auto-approve)
2. Manual review queue for borderline cases
3. Document verification
4. Final decision (approve/reject)
5. Generate loan agreement

**Decision Matrix**:
| Credit Score | Loan Amount | Action |
|--------------|-------------|---------|
| > 700 | < 10M | Auto-approve |
| 650-700 | < 5M | Auto-approve |
| 600-650 | Any | Manual Review |
| < 600 | Any | Auto-reject |

#### FR-LOAN-003: Pencairan Dana
**Deskripsi**: Disbursement dana ke rekening nasabah
**Trigger**: Loan approved & agreement signed
**Process**:
1. Validate bank account
2. Initiate transfer via bank API
3. Update loan status to 'disbursed'
4. Send notification
5. Create accounting entry

**SLA**: 15 menit - 24 jam

#### FR-LOAN-004: Loan Monitoring
**Deskripsi**: Monitor status pinjaman aktif
**Features**:
- Real-time loan balance
- Payment history
- Upcoming due date
- Early payment calculation
- Restructuring option (if eligible)

### 3.4 Modul Pembayaran

#### FR-PAY-001: Pembuat Virtual Account
**Deskripsi**: Generate VA untuk pembayaran
**Trigger**: User initiates payment
**Process**:
1. Calculate payment amount
2. Generate VA number
3. Set expiry time (24 jam)
4. Send VA details to user

**Supported Banks**:
- BCA
- Mandiri
- BNI
- BRI
- Permata

#### FR-PAY-002: Payment Confirmation
**Deskripsi**: Konfirmasi pembayaran dari payment gateway
**Trigger**: Webhook dari payment gateway
**Process**:
1. Validate webhook signature
2. Match payment with loan
3. Update payment status
4. Update loan balance
5. Send receipt to user
6. Create accounting entry

#### FR-PAY-003: Payment Methods
**Supported Channels**:
1. **Bank Transfer**: Virtual Account
2. **E-Wallet**: 
   - DANA
   - GoPay
   - OVO
   - ShopeePay
3. **Retail**: 
   - Indomaret
   - Alfamart

### 3.5 Modul Credit Scoring

#### FR-SCORE-001: Initial Scoring
**Deskripsi**: Calculate initial credit score saat KYC
**Factors**:
- Base score: 500
- KYC completion: +100
- Income verification: +50
- Employment status: +50
- Age factor: ±20
- Location risk: ±30

**Formula**:
```
Score = BaseScore + KYCScore + FinancialScore + DemographicScore - RiskDeductions
Range: 300-850
```

#### FR-SCORE-002: Dynamic Scoring
**Deskripsi**: Update score based on behavior
**Triggers**:
- Payment completed (on-time: +10, late: -20)
- Loan fully paid (+30)
- Default (-100)
- Fraud attempt (-200)

### 3.6 Modul Anti-Fraud

#### FR-FRAUD-001: Device Fingerprinting
**Checks**:
- Unique device ID
- Multiple accounts same device (max 3)
- Rooted/jailbroken device (blocked)
- Emulator detection (blocked)
- VPN/Proxy detection (flagged)

#### FR-FRAUD-002: Behavioral Analysis
**Patterns Detected**:
- Rapid applications (>3 in 24 hours)
- Unusual location (>100km from usual)
- Night time activity (00:00-05:00)
- Form fill time (<30 seconds = bot)

#### FR-FRAUD-003: Document Fraud Detection
**Checks**:
- KTP duplicate detection
- Photo manipulation detection
- Face spoofing detection
- Inconsistent data detection

**Risk Scoring**:
- Low (0-30): Proceed
- Medium (31-60): Additional verification
- High (61-80): Manual review
- Critical (81-100): Block

### 3.7 Modul Notifikasi

#### FR-NOTIF-001: Notification Types
**Categories**:
1. **Transactional** (Required):
   - OTP codes
   - Loan approval/rejection
   - Disbursement confirmation
   - Payment confirmation

2. **Reminders** (Automated):
   - Payment due (H-7, H-3, H-1, H-0)
   - Overdue (H+1, H+3, H+7, H+14, H+30)

3. **Marketing** (Opt-in):
   - Promotions
   - New features
   - Survey requests

#### FR-NOTIF-002: Multi-Channel Delivery
**Channels by Priority**:
1. Push Notification (primary)
2. SMS (critical only)
3. WhatsApp (with user consent)
4. Email (documentation)
5. In-app notification (always)

**Delivery Rules**:
- Max 3 attempts per channel
- Fallback to next channel on failure
- Respect quiet hours (22:00-08:00) for non-critical

### 3.8 Modul Admin Dashboard

#### FR-ADMIN-001: User Management
**Features**:
- User list with search/filter
- User detail view
- KYC document review
- User status management (activate/suspend/blacklist)
- Reset password
- Activity logs

#### FR-ADMIN-002: Loan Management
**Features**:
- Loan application queue
- Approval workflow
- Loan detail view
- Payment tracking
- Restructuring tools
- Write-off management

#### FR-ADMIN-003: Reporting
**Report Types**:
1. **Operational**:
   - Daily transaction summary
   - Loan performance
   - Collection efficiency
   - User acquisition

2. **Financial**:
   - Income statement
   - Balance sheet
   - Cash flow
   - NPL analysis

3. **Regulatory**:
   - OJK monthly report
   - AFPI compliance report
   - AML suspicious transactions

#### FR-ADMIN-004: System Configuration
**Configurable Parameters**:
- Interest rates by product
- Credit score thresholds
- Auto-approval limits
- Notification templates
- Fee structures
- Blacklist management

### 3.9 Modul Akuntansi

#### FR-ACC-001: Journal Entries
**Automated Entries**:
1. **Loan Disbursement**:
   - Debit: Piutang
   - Credit: Kas Bank

2. **Payment Received**:
   - Debit: Kas Bank
   - Credit: Piutang (principal)
   - Credit: Pendapatan Bunga (interest)

3. **Admin Fee**:
   - Debit: Kas Bank
   - Credit: Pendapatan Admin

#### FR-ACC-002: Reconciliation
**Daily Reconciliation**:
- Bank statement matching
- Payment gateway settlement
- System vs actual balance
- Discrepancy reporting

### 3.10 Modul Collection

#### FR-COLL-001: Collection Queue
**Queue Segmentation**:
- Soft reminder (1-7 days overdue)
- First warning (8-14 days)
- Intensive follow-up (15-30 days)
- Legal notice (>30 days)

#### FR-COLL-002: Collection Tools
**Features**:
- Automated reminder scheduling
- Call log recording
- Promise to pay tracking
- Field visit scheduling
- Settlement negotiation
- Payment arrangement

---

## 4. Kebutuhan Non-Fungsional

### 4.1 Performance Requirements

#### NFR-PERF-001: Response Time
- API response time: < 500ms (p95)
- Page load time: < 2 seconds
- Database query: < 100ms
- File upload: < 10 seconds for 5MB

#### NFR-PERF-002: Throughput
- Concurrent users: 10,000
- Transactions per second: 100
- Loan applications per hour: 1,000
- Payments per minute: 50

#### NFR-PERF-003: Resource Usage
- CPU usage: < 70% average
- Memory usage: < 80%
- Database size growth: < 10GB/month
- Storage optimization: Auto-archive after 2 years

### 4.2 Security Requirements

#### NFR-SEC-001: Authentication
- Password complexity: Min 8 char, uppercase, lowercase, number, symbol
- Session timeout: 15 minutes idle
- Max login attempts: 5 (lockout 30 minutes)
- Two-factor authentication: Required

#### NFR-SEC-002: Encryption
- Data at rest: AES-256
- Data in transit: TLS 1.3
- Password hashing: Argon2id
- Sensitive fields: Field-level encryption

#### NFR-SEC-003: Access Control
- Role-based access control (RBAC)
- Principle of least privilege
- API authentication: JWT
- Rate limiting: 100 requests/minute

#### NFR-SEC-004: Audit Trail
- All transactions logged
- User activity tracking
- Data change history
- Login/logout events
- Retention: 7 years

### 4.3 Reliability Requirements

#### NFR-REL-001: Availability
- System uptime: 99.9% (excluding maintenance)
- Planned maintenance window: Sunday 00:00-04:00
- Maximum unplanned downtime: 4 hours/month

#### NFR-REL-002: Fault Tolerance
- Graceful degradation
- Circuit breaker pattern
- Retry mechanism with exponential backoff
- Fallback procedures

#### NFR-REL-003: Disaster Recovery
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 1 hour
- Daily backups to cloud
- Backup retention: 30 days
- DR drill: Quarterly

### 4.4 Scalability Requirements

#### NFR-SCAL-001: Horizontal Scaling
- Auto-scaling based on load
- Load balancing across instances
- Database read replicas
- Caching strategy

#### NFR-SCAL-002: Growth Projections
- Year 1: 50,000 users
- Year 2: 200,000 users
- Year 3: 500,000 users
- Transaction growth: 20% monthly

### 4.5 Usability Requirements

#### NFR-USE-001: User Interface
- Mobile-first design
- Responsive web dashboard
- Support screens: 5"-7" phones
- Accessibility: WCAG 2.1 Level AA

#### NFR-USE-002: User Experience
- Maximum 3 clicks to core function
- Form validation: Real-time
- Error messages: User-friendly
- Loading indicators: All async operations
- Offline capability: View mode

#### NFR-USE-003: Language Support
- Primary: Bahasa Indonesia
- Date format: DD/MM/YYYY
- Currency: IDR (Rupiah)
- Number format: 1.000.000

### 4.6 Compatibility Requirements

#### NFR-COMP-001: Mobile Platforms
- Android: 6.0 (API 23) and above
- iOS: 12.0 and above
- Flutter SDK: 3.x

#### NFR-COMP-002: Web Browsers
- Chrome: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Edge: Latest 2 versions

#### NFR-COMP-003: Integration
- Payment Gateway: REST API
- Bank API: ISO 8583 / REST
- SMS Gateway: REST API
- WhatsApp: Business API

### 4.7 Compliance Requirements

#### NFR-COMPL-001: Regulatory
- OJK POJK 77/2016 compliance
- AFPI code of conduct
- BI-SLIK reporting ready
- Anti-money laundering (AML)

#### NFR-COMPL-002: Data Privacy
- User consent management
- Data retention policy
- Right to be forgotten
- Data portability
- Privacy policy display

### 4.8 Maintainability Requirements

#### NFR-MAINT-001: Code Quality
- Code coverage: > 80%
- Documentation: JSDoc/Dartdoc
- Linting: ESLint/Dart analyzer
- Code review: Required for merge

#### NFR-MAINT-002: Monitoring
- Application performance monitoring
- Error tracking and alerting
- Log aggregation
- Health check endpoints
- Metrics dashboard

#### NFR-MAINT-003: Deployment
- CI/CD pipeline
- Blue-green deployment
- Database migration automation
- Rollback capability
- Environment parity

---

## 5. External Interface Requirements

### 5.1 User Interfaces

#### Mobile App Screens
1. **Authentication**:
   - Splash screen
   - Login screen
   - Register screen
   - OTP verification
   - Forgot password

2. **Main Features**:
   - Home dashboard
   - Loan application
   - KYC verification
   - Payment screen
   - Transaction history
   - Profile management

3. **Support**:
   - Help center
   - Chat support
   - FAQ
   - Terms & conditions

#### Web Dashboard Pages
1. **Main Navigation**:
   - Dashboard overview
   - User management
   - Loan management
   - Payment tracking
   - Reports
   - Settings

2. **Functional Pages**:
   - Loan approval workflow
   - KYC verification
   - Collection management
   - Financial reports
   - System configuration

### 5.2 Hardware Interfaces

#### Mobile Device Requirements
- Camera: For KTP and selfie capture
- Storage: Min 100MB available
- Network: 3G/4G/5G/WiFi
- GPS: For location services
- Biometric: Fingerprint/FaceID (optional)

#### Server Requirements
- CPU: 8 cores minimum
- RAM: 16GB minimum
- Storage: SSD 500GB
- Network: 1Gbps
- OS: Ubuntu 20.04 LTS / Amazon Linux 2

### 5.3 Software Interfaces

#### Payment Gateway API
- Provider: Xendit/Midtrans
- Protocol: REST API
- Authentication: API Key
- Endpoints:
  - Create VA
  - Check payment status
  - Webhook callback

#### Bank API
- Transfer API for disbursement
- Balance inquiry
- Transaction status
- Format: REST/ISO 8583

#### KYC Services
- OCR Service: Google Vision API
- Face Recognition: Amazon Rekognition
- Liveness Detection: Face++

#### Notification Services
- SMS: Twilio/Vonage
- Email: SendGrid/AWS SES
- WhatsApp: WhatsApp Business API
- Push: Firebase Cloud Messaging

### 5.4 Communication Interfaces

#### API Protocols
- REST API over HTTPS
- WebSocket for real-time updates
- JSON data format
- JWT authentication

#### Network Requirements
- HTTPS only (TLS 1.3)
- IPv4 and IPv6 support
- CDN for static assets
- DDoS protection

---

## 6. System Constraints

### 6.1 Regulatory Constraints
- Maximum interest rate: 0.8% per day
- Maximum total cost: 100% of principal
- Cooling-off period: 1 day
- Data localization: Indonesia

### 6.2 Technical Constraints
- Database: SQLite (TrailBase built-in)
- Backend: TrailBase (Rust-based)
- Single executable deployment
- Backup storage: Cloud (S3 compatible)

### 6.3 Business Constraints
- Service area: Jabodetabek & Bandung Raya only
- Age limit: 21-55 years
- Indonesian citizen only
- Must have bank account

---

## 7. Appendices

### 7.1 Glossary
- **TrailBase**: Open-source backend platform built with Rust and SQLite
- **NPL**: Non-Performing Loan - pinjaman yang gagal bayar
- **Disbursement**: Pencairan dana pinjaman
- **Collection**: Proses penagihan
- **Underwriting**: Proses evaluasi risiko kredit

### 7.2 References
1. OJK POJK 77/2016 - Layanan Pinjam Meminjam Uang Berbasis Teknologi Informasi
2. AFPI Code of Conduct
3. TrailBase Documentation - https://trailbase.io
4. ISO 27001 - Information Security Management

### 7.3 Revision History
| Version | Date | Changes | Author |
|---------|------|---------|---------|
| 1.0 | Dec 2024 | Initial draft | System Architect |

---

*End of Requirements Specification Document*