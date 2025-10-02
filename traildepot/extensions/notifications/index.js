/**
 * Notification System Extension
 * Multi-channel notification delivery (Push, SMS, Email, WhatsApp)
 * FR-NOTIF-001 & FR-NOTIF-002
 */

// External service clients (would be configured via environment variables)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || 'demo';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'demo';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'demo';
const WHATSAPP_TOKEN = process.env.WHATSAPP_BUSINESS_TOKEN || 'demo';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || 'demo';

/**
 * Send Notification (Main Entry Point)
 * FR-NOTIF-001: Notification types and categories
 */
async function sendNotification(req, db) {
  const {
    userId,
    notificationType,
    category,
    priority,
    title,
    message,
    channels, // Array: ['push', 'sms', 'email', 'whatsapp']
    actionUrl,
    imageUrl,
    scheduledAt,
    metadata
  } = req.body;

  if (!userId || !message) {
    return { error: 'User ID and message required' };
  }

  // Get user preferences and contact info
  const userQuery = `
    SELECT 
      phone, email, fcm_token,
      notification_email, notification_sms,
      notification_push, notification_whatsapp
    FROM users
    WHERE id = ?
  `;
  const users = await db.query(userQuery, [userId]);
  
  if (users.length === 0) {
    return { error: 'User not found' };
  }

  const user = users[0];

  // Determine channels based on user preferences
  const effectiveChannels = filterChannelsByPreference(channels || ['push'], user);

  // Check quiet hours for non-critical notifications
  const currentHour = new Date().getHours();
  const isQuietHour = currentHour >= 22 || currentHour < 8;
  const isCritical = priority === 'urgent' || priority === 'high';

  if (isQuietHour && !isCritical && !category === 'transactional') {
    // Schedule for 8 AM next day
    const tomorrow8AM = new Date();
    tomorrow8AM.setDate(tomorrow8AM.getDate() + (currentHour >= 22 ? 1 : 0));
    tomorrow8AM.setHours(8, 0, 0, 0);
    
    return await scheduleNotification({
      body: { ...req.body, scheduledAt: tomorrow8AM.toISOString() }
    }, db);
  }

  // Create notification record
  const notifId = await createNotificationRecord(db, {
    userId,
    notificationType,
    category: category || 'system',
    priority: priority || 'normal',
    title,
    message,
    actionUrl,
    imageUrl,
    scheduledAt,
    metadata
  });

  const results = {
    notificationId: notifId,
    channels: {},
    success: false
  };

  // Send to each channel with fallback mechanism
  for (const channel of effectiveChannels) {
    try {
      let result;
      
      switch (channel) {
        case 'push':
          if (user.fcm_token) {
            result = await sendPushNotification(user.fcm_token, { title, message, actionUrl, imageUrl });
          }
          break;
        
        case 'sms':
          if (user.phone) {
            result = await sendSMS(user.phone, message);
          }
          break;
        
        case 'email':
          if (user.email) {
            result = await sendEmail(user.email, title, message, metadata);
          }
          break;
        
        case 'whatsapp':
          if (user.phone) {
            result = await sendWhatsApp(user.phone, message);
          }
          break;
      }

      results.channels[channel] = result || { status: 'skipped', reason: 'No contact info' };
      
      // Update notification status
      if (result && result.status === 'sent') {
        await updateNotificationStatus(db, notifId, channel, 'sent', result.externalId);
        results.success = true;
      }
    } catch (error) {
      results.channels[channel] = { status: 'failed', error: error.message };
      
      // Log error
      await updateNotificationStatus(db, notifId, channel, 'failed', null, error.message);
    }
  }

  // If all channels failed and priority is high, retry with fallback
  if (!results.success && (priority === 'high' || priority === 'urgent')) {
    // Try SMS as last resort for critical notifications
    if (!effectiveChannels.includes('sms') && user.phone) {
      try {
        const smsResult = await sendSMS(user.phone, message);
        results.channels.sms_fallback = smsResult;
        if (smsResult.status === 'sent') {
          results.success = true;
        }
      } catch (error) {
        results.channels.sms_fallback = { status: 'failed', error: error.message };
      }
    }
  }

  return results;
}

/**
 * Send Push Notification via FCM
 */
async function sendPushNotification(fcmToken, payload) {
  // In production, this would use Firebase Cloud Messaging SDK
  // For now, return mock success
  
  if (process.env.NODE_ENV === 'production' && FCM_SERVER_KEY !== 'demo') {
    // Real implementation would be here
    // const admin = require('firebase-admin');
    // await admin.messaging().send({ token: fcmToken, notification: payload });
  }

  return {
    status: 'sent',
    channel: 'push',
    externalId: `fcm_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(phone, message) {
  // In production, this would use Twilio SDK
  // For now, return mock success
  
  if (process.env.NODE_ENV === 'production' && TWILIO_SID !== 'demo') {
    // Real implementation:
    // const twilio = require('twilio');
    // const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    // const result = await client.messages.create({
    //   body: message,
    //   to: phone,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });
  }

  return {
    status: 'sent',
    channel: 'sms',
    externalId: `sms_${Date.now()}`,
    timestamp: new Date().toISOString(),
    recipient: phone
  };
}

/**
 * Send Email via SendGrid
 */
async function sendEmail(email, subject, htmlContent, metadata) {
  // In production, this would use SendGrid SDK
  // For now, return mock success
  
  if (process.env.NODE_ENV === 'production' && SENDGRID_API_KEY !== 'demo') {
    // Real implementation:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: email,
    //   from: process.env.FROM_EMAIL,
    //   subject: subject,
    //   html: htmlContent
    // });
  }

  return {
    status: 'sent',
    channel: 'email',
    externalId: `email_${Date.now()}`,
    timestamp: new Date().toISOString(),
    recipient: email
  };
}

/**
 * Send WhatsApp Message via WhatsApp Business API
 */
async function sendWhatsApp(phone, message) {
  // In production, this would use WhatsApp Business API
  // For now, return mock success
  
  if (process.env.NODE_ENV === 'production' && WHATSAPP_TOKEN !== 'demo') {
    // Real implementation:
    // Make HTTP request to WhatsApp Business API
  }

  return {
    status: 'sent',
    channel: 'whatsapp',
    externalId: `wa_${Date.now()}`,
    timestamp: new Date().toISOString(),
    recipient: phone
  };
}

/**
 * Send OTP
 */
async function sendOTP(req, db) {
  const { userId, phone, purpose } = req.body;

  if (!phone) {
    return { error: 'Phone number required' };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry

  // Store OTP (in production, use encrypted storage)
  const otpQuery = `
    INSERT INTO otp_codes (user_id, phone, code, purpose, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  
  // Create table if not exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT,
      verified BOOLEAN DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(otpQuery, [userId || null, phone, otp, purpose || 'verification', expiresAt.toISOString()]);

  // Send OTP via SMS
  const message = `Your KreditKu OTP code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  const smsResult = await sendSMS(phone, message);

  // Also create notification record
  if (userId) {
    await createNotificationRecord(db, {
      userId,
      notificationType: 'otp',
      category: 'transactional',
      priority: 'urgent',
      title: 'Kode OTP',
      message,
      metadata: { purpose, expiresAt: expiresAt.toISOString() }
    });
  }

  return {
    success: smsResult.status === 'sent',
    expiresAt: expiresAt.toISOString(),
    channel: 'sms'
  };
}

/**
 * Verify OTP
 */
async function verifyOTP(req, db) {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return { error: 'Phone and code required' };
  }

  const query = `
    SELECT id, user_id, expires_at, verified
    FROM otp_codes
    WHERE phone = ? AND code = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const otps = await db.query(query, [phone, code]);

  if (otps.length === 0) {
    return { valid: false, reason: 'Invalid OTP code' };
  }

  const otp = otps[0];

  if (otp.verified) {
    return { valid: false, reason: 'OTP already used' };
  }

  const expiresAt = new Date(otp.expires_at);
  if (expiresAt < new Date()) {
    return { valid: false, reason: 'OTP expired' };
  }

  // Mark as verified
  await db.execute('UPDATE otp_codes SET verified = 1 WHERE id = ?', [otp.id]);

  return {
    valid: true,
    userId: otp.user_id
  };
}

/**
 * Send Payment Reminder
 * FR-NOTIF-002: Automated reminders
 */
async function sendPaymentReminder(req, db) {
  const { loanId, daysBefore } = req.body;

  const loanQuery = `
    SELECT 
      l.id, l.loan_number, l.user_id, l.due_date,
      l.outstanding_amount, l.total_payment,
      u.full_name, u.phone, u.email
    FROM loans l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `;

  const loans = await db.query(loanQuery, [loanId]);

  if (loans.length === 0) {
    return { error: 'Loan not found' };
  }

  const loan = loans[0];
  const dueDate = new Date(loan.due_date);
  const formattedDate = dueDate.toLocaleDateString('id-ID');
  const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(loan.outstanding_amount);

  let title, message;

  if (daysBefore === 0) {
    title = 'Pembayaran Jatuh Tempo Hari Ini!';
    message = `Halo ${loan.full_name}, pembayaran pinjaman ${loan.loan_number} jatuh tempo HARI INI. Jumlah: ${amount}. Segera lakukan pembayaran untuk menghindari denda.`;
  } else if (daysBefore > 0) {
    title = `Pengingat Pembayaran (H-${daysBefore})`;
    message = `Halo ${loan.full_name}, pembayaran pinjaman ${loan.loan_number} akan jatuh tempo dalam ${daysBefore} hari (${formattedDate}). Jumlah: ${amount}.`;
  } else {
    // Overdue
    const daysOverdue = Math.abs(daysBefore);
    title = `Pembayaran Terlambat (H+${daysOverdue})`;
    message = `Halo ${loan.full_name}, pembayaran pinjaman ${loan.loan_number} telah terlambat ${daysOverdue} hari. Jumlah: ${amount}. Harap segera lakukan pembayaran untuk menghindari denda tambahan.`;
  }

  // Send via multiple channels for overdue
  const channels = daysBefore < 0 ? ['push', 'sms', 'whatsapp'] : ['push', 'sms'];

  return await sendNotification({
    body: {
      userId: loan.user_id,
      notificationType: daysBefore >= 0 ? 'payment_reminder' : 'overdue_reminder',
      category: 'reminder',
      priority: daysBefore <= 0 ? 'high' : 'normal',
      title,
      message,
      channels,
      actionUrl: `/loans/${loan.id}/payment`,
      metadata: { loanId, daysBefore, amount: loan.outstanding_amount }
    }
  }, db);
}

/**
 * Process Scheduled Notifications
 * Cron job would call this periodically
 */
async function processScheduledNotifications(req, db) {
  const query = `
    SELECT id, user_id, notification_type, title, message,
           channel, action_url, image_url, template_params
    FROM notifications
    WHERE status = 'pending'
      AND scheduled_at <= CURRENT_TIMESTAMP
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT 100
  `;

  const notifications = await db.query(query);

  const results = {
    processed: 0,
    success: 0,
    failed: 0
  };

  for (const notif of notifications) {
    try {
      // Update status to queued
      await db.execute(
        'UPDATE notifications SET status = ? WHERE id = ?',
        ['queued', notif.id]
      );

      // Send notification
      const result = await sendNotification({
        body: {
          userId: notif.user_id,
          notificationType: notif.notification_type,
          title: notif.title,
          message: notif.message,
          channels: [notif.channel],
          actionUrl: notif.action_url,
          imageUrl: notif.image_url,
          metadata: JSON.parse(notif.template_params || '{}')
        }
      }, db);

      results.processed++;
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      await updateNotificationStatus(db, notif.id, notif.channel, 'failed', null, error.message);
    }
  }

  return results;
}

/**
 * Get User Notifications
 */
async function getUserNotifications(req, db) {
  const { userId } = req.params;
  const { limit = 50, offset = 0, unreadOnly = false } = req.query || {};

  let query = `
    SELECT 
      id, notification_type, category, priority,
      title, message, action_url, image_url,
      status, created_at, read_at
    FROM notifications
    WHERE user_id = ?
  `;

  if (unreadOnly === 'true' || unreadOnly === true) {
    query += ' AND read_at IS NULL';
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const notifications = await db.query(query, [userId, parseInt(limit), parseInt(offset)]);

  // Get unread count
  const unreadCountQuery = `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND read_at IS NULL
  `;
  const unreadCount = await db.query(unreadCountQuery, [userId]);

  return {
    notifications,
    unreadCount: unreadCount[0].count,
    total: notifications.length
  };
}

/**
 * Mark Notification as Read
 */
async function markAsRead(req, db) {
  const { notificationId } = req.params;

  await db.execute(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
    ['read', notificationId]
  );

  return { success: true };
}

// ============ Helper Functions ============

function filterChannelsByPreference(channels, user) {
  return channels.filter(channel => {
    switch (channel) {
      case 'push':
        return user.notification_push === 1;
      case 'sms':
        return user.notification_sms === 1;
      case 'email':
        return user.notification_email === 1;
      case 'whatsapp':
        return user.notification_whatsapp === 1;
      default:
        return true;
    }
  });
}

async function createNotificationRecord(db, data) {
  const id = generateId();
  
  const query = `
    INSERT INTO notifications (
      id, user_id, notification_type, category, priority,
      title, message, action_url, image_url,
      channel, status, scheduled_at, template_params, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  await db.execute(query, [
    id,
    data.userId,
    data.notificationType,
    data.category,
    data.priority,
    data.title,
    data.message,
    data.actionUrl || null,
    data.imageUrl || null,
    'in_app', // Default channel
    'pending',
    data.scheduledAt || null,
    JSON.stringify(data.metadata || {})
  ]);

  return id;
}

async function updateNotificationStatus(db, notifId, channel, status, externalId, errorMessage) {
  const updates = [`status = ?`];
  const params = [status];

  if (status === 'sent') {
    updates.push('sent_at = CURRENT_TIMESTAMP');
    if (externalId) {
      updates.push('external_id = ?');
      params.push(externalId);
    }
  } else if (status === 'failed') {
    updates.push('failed_at = CURRENT_TIMESTAMP');
    updates.push('retry_count = retry_count + 1');
    if (errorMessage) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    }
  }

  params.push(notifId);

  await db.execute(
    `UPDATE notifications SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

async function scheduleNotification(req, db) {
  const notifId = await createNotificationRecord(db, req.body);
  return { scheduled: true, notificationId: notifId, scheduledAt: req.body.scheduledAt };
}

function generateId() {
  return require('crypto').randomBytes(16).toString('hex');
}

// Export functions
module.exports = {
  sendNotification,
  sendOTP,
  verifyOTP,
  sendPaymentReminder,
  processScheduledNotifications,
  getUserNotifications,
  markAsRead
};
