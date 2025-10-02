// TrailBase Configuration for KreditKu Application
// https://trailbase.io/docs/configuration

export default {
  server: {
    host: '0.0.0.0',
    port: 4000,
    workers: 4,
    maxConnections: 10000,
    requestTimeout: 30000,
  },

  database: {
    path: './traildepot/kreditku.db',
    mode: 'WAL',
    busyTimeout: 5000,
    cacheSize: 10000,
    synchronous: 'NORMAL',
    foreignKeys: true,
  },

  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'PLACEHOLDER_CHANGE_IN_PRODUCTION',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      algorithm: 'HS256',
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: '/auth/google/callback',
      },
    },
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAttempts: 5,
      lockoutDuration: 1800,
    },
    otp: {
      length: 6,
      expiry: 300,
      maxAttempts: 3,
    },
  },

  security: {
    cors: {
      origins: [
        'https://admin.kreditku.id',
        'https://kreditku.id',
        'http://localhost:3000',
        'http://localhost:5173',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    rateLimit: {
      global: 1000,
      perUser: 100,
      perEndpoint: {
        '/api/auth/login': 5,
        '/api/auth/register': 3,
        '/api/loans/apply': 10,
      },
    },
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
    },
  },

  loan: {
    maxAmount: 50000000,
    minAmount: 1000000,
    maxTenorDays: 90,
    minTenorDays: 7,
    conventional: {
      dailyInterestRate: 0.8,
      adminFeePercentage: 3,
      lateFeePercentage: 0.5,
    },
    sharia: {
      dailyUjrohRate: 0.7,
      adminFeePercentage: 2.5,
      tawidh: 0.3,
    },
  },

  scoring: {
    baseScore: 500,
    minScore: 300,
    maxScore: 850,
  },

  fraud: {
    enabled: true,
    blockEmulators: true,
    blockRootedDevices: true,
  },

  services: {
    sms: {
      provider: 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    },
    email: {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: 'noreply@kreditku.id',
    },
    paymentGateway: {
      provider: 'xendit',
      apiKey: process.env.XENDIT_API_KEY,
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
    },
  },

  jobs: {
    enabled: true,
    schedule: {
      'daily-interest': '0 0 * * *',
      'payment-reminders': '0 9 * * *',
      'backup-database': '0 4 * * *',
    },
  },

  features: {
    autoApproval: true,
    biometricAuth: true,
    syariahLoan: true,
  },

  development: {
    debug: process.env.NODE_ENV === 'development',
  },
};
