/**
 * Collection System Extension
 * Automated collection management with reminders and workflows
 * FR-COLL-001 & FR-COLL-002
 */

/**
 * Get Collection Queue
 * Segmented by overdue days
 */
async function getCollectionQueue(req, db) {
  const { stage, assignedTo, limit = 100, offset = 0 } = req.query || {};

  let query = `
    SELECT 
      l.id as loan_id,
      l.loan_number,
      l.user_id,
      u.full_name,
      u.phone,
      u.email,
      l.principal_amount,
      l.outstanding_amount,
      l.due_date,
      l.days_past_due,
      l.status,
      cc.id as case_id,
      cc.collection_stage,
      cc.assigned_to,
      cc.status as case_status,
      cc.has_promise,
      cc.promise_date
    FROM loans l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN collection_cases cc ON l.id = cc.loan_id AND cc.status IN ('open', 'in_progress', 'promised')
    WHERE l.status IN ('active', 'overdue')
      AND l.days_past_due > 0
  `;

  const params = [];

  // Filter by collection stage
  if (stage) {
    query += ' AND cc.collection_stage = ?';
    params.push(stage);
  }

  // Filter by assigned collector
  if (assignedTo) {
    query += ' AND cc.assigned_to = ?';
    params.push(assignedTo);
  }

  query += ' ORDER BY l.days_past_due DESC, l.outstanding_amount DESC';
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const cases = await db.query(query, params);

  // Group by collection stage
  const grouped = {
    soft_reminder: [],      // 1-7 days
    first_warning: [],      // 8-14 days  
    intensive: [],          // 15-30 days
    legal_notice: [],       // 31-60 days
    legal_action: []        // >60 days
  };

  for (const case_item of cases) {
    const stage = determineCollectionStage(case_item.days_past_due);
    if (!case_item.case_id) {
      // Create collection case if not exists
      case_item.case_id = await createCollectionCase(db, case_item, stage);
      case_item.collection_stage = stage;
    }
    
    grouped[case_item.collection_stage || stage].push(case_item);
  }

  return {
    total: cases.length,
    grouped,
    summary: {
      soft_reminder: grouped.soft_reminder.length,
      first_warning: grouped.first_warning.length,
      intensive: grouped.intensive.length,
      legal_notice: grouped.legal_notice.length,
      legal_action: grouped.legal_action.length
    }
  };
}

/**
 * Create Collection Case
 */
async function createCollectionCase(db, loan, stage) {
  const caseId = generateId();
  const caseNumber = `COLL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

  const query = `
    INSERT INTO collection_cases (
      id, case_number, loan_id, user_id,
      days_overdue, overdue_amount, total_amount_due,
      collection_stage, escalation_level,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  await db.execute(query, [
    caseId,
    caseNumber,
    loan.loan_id,
    loan.user_id,
    loan.days_past_due,
    loan.outstanding_amount,
    loan.outstanding_amount,
    stage,
    1,
    'open'
  ]);

  return caseId;
}

/**
 * Assign Case to Collector
 */
async function assignCase(req, db) {
  const { caseId, collectorId, team } = req.body;

  if (!caseId || !collectorId) {
    return { error: 'Case ID and collector ID required' };
  }

  await db.execute(`
    UPDATE collection_cases
    SET assigned_to = ?,
        team = ?,
        assigned_at = CURRENT_TIMESTAMP,
        status = 'in_progress'
    WHERE id = ?
  `, [collectorId, team || null, caseId]);

  // Log activity
  await logCollectionActivity(db, {
    caseId,
    activityType: 'note',
    subject: 'Case Assigned',
    content: `Case assigned to collector ${collectorId}`,
    performedBy: collectorId
  });

  return { success: true, caseId, assignedTo: collectorId };
}

/**
 * Log Collection Activity
 * Types: call, sms, whatsapp, email, visit, letter, promise, payment, note
 */
async function logCollectionActivity(db, params) {
  const {
    caseId,
    activityType,
    activityResult,
    contactPerson,
    contactNumber,
    subject,
    content,
    response,
    customerResponse,
    promiseAmount,
    promiseDate,
    performedBy
  } = params;

  const query = `
    INSERT INTO collection_activities (
      id, case_id, activity_type, activity_result,
      contact_person, contact_number, subject, content,
      response, customer_response, promise_amount, promise_date,
      performed_by, performed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const activityId = generateId();

  await db.execute(query, [
    activityId,
    caseId,
    activityType,
    activityResult || null,
    contactPerson || null,
    contactNumber || null,
    subject || null,
    content || null,
    response || null,
    customerResponse || null,
    promiseAmount || null,
    promiseDate || null,
    performedBy || null
  ]);

  return activityId;
}

/**
 * Record Phone Call
 */
async function recordCall(req, db) {
  const {
    caseId,
    contactPerson,
    contactNumber,
    callResult,
    notes,
    customerResponse,
    promiseAmount,
    promiseDate,
    performedBy
  } = req.body;

  if (!caseId) {
    return { error: 'Case ID required' };
  }

  const activityId = await logCollectionActivity(db, {
    caseId,
    activityType: 'call',
    activityResult: callResult,
    contactPerson,
    contactNumber,
    subject: `Phone call - ${callResult}`,
    content: notes,
    customerResponse,
    promiseAmount,
    promiseDate,
    performedBy
  });

  // If customer made a promise, update case
  if (promiseAmount && promiseDate) {
    await db.execute(`
      UPDATE collection_cases
      SET has_promise = 1,
          promise_date = ?,
          promise_amount = ?,
          status = 'promised'
      WHERE id = ?
    `, [promiseDate, promiseAmount, caseId]);
  }

  // Update case last activity
  await db.execute(`
    UPDATE collection_cases
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [caseId]);

  return { success: true, activityId };
}

/**
 * Send Reminder (Automated)
 */
async function sendReminder(req, db) {
  const { caseId, channels, message } = req.body;

  if (!caseId) {
    return { error: 'Case ID required' };
  }

  // Get case details
  const caseQuery = `
    SELECT cc.*, l.loan_number, l.outstanding_amount, l.due_date,
           u.full_name, u.phone, u.email
    FROM collection_cases cc
    JOIN loans l ON cc.loan_id = l.id
    JOIN users u ON cc.user_id = u.id
    WHERE cc.id = ?
  `;
  const cases = await db.query(caseQuery, [caseId]);

  if (cases.length === 0) {
    return { error: 'Case not found' };
  }

  const case_item = cases[0];

  // Prepare reminder message
  const reminderMessage = message || generateReminderMessage(case_item);

  // Send via requested channels (assuming notification module exists)
  const results = {};
  for (const channel of channels || ['sms', 'whatsapp']) {
    try {
      // Call notification module
      // const result = await sendNotification({ ... });
      results[channel] = { status: 'sent', timestamp: new Date().toISOString() };
      
      // Log activity
      await logCollectionActivity(db, {
        caseId,
        activityType: channel,
        activityResult: 'sent',
        subject: `Reminder sent via ${channel}`,
        content: reminderMessage,
        performedBy: 'system'
      });
    } catch (error) {
      results[channel] = { status: 'failed', error: error.message };
    }
  }

  return { success: true, caseId, results };
}

/**
 * Process Automated Reminders
 * Should be called by cron job
 */
async function processAutomatedReminders(req, db) {
  const now = new Date();
  
  // Get all overdue loans without recent reminders
  const query = `
    SELECT 
      l.id as loan_id,
      l.loan_number,
      l.user_id,
      l.outstanding_amount,
      l.due_date,
      l.days_past_due,
      cc.id as case_id,
      cc.collection_stage,
      MAX(ca.performed_at) as last_reminder
    FROM loans l
    LEFT JOIN collection_cases cc ON l.id = cc.loan_id
    LEFT JOIN collection_activities ca ON cc.id = ca.case_id AND ca.activity_type IN ('sms', 'whatsapp', 'email')
    WHERE l.status IN ('active', 'overdue')
      AND l.days_past_due > 0
    GROUP BY l.id
    HAVING last_reminder IS NULL OR last_reminder < datetime('now', '-24 hours')
    LIMIT 100
  `;

  const loans = await db.query(query);

  const results = {
    processed: 0,
    sent: 0,
    failed: 0
  };

  for (const loan of loans) {
    try {
      // Create case if not exists
      let caseId = loan.case_id;
      if (!caseId) {
        const stage = determineCollectionStage(loan.days_past_due);
        caseId = await createCollectionCase(db, loan, stage);
      }

      // Send reminder
      const reminderResult = await sendReminder({
        body: {
          caseId,
          channels: determineReminderChannels(loan.days_past_due)
        }
      }, db);

      results.processed++;
      if (reminderResult.success) {
        results.sent++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      console.error(`Failed to send reminder for loan ${loan.loan_id}:`, error);
    }
  }

  return results;
}

/**
 * Record Field Visit
 */
async function recordFieldVisit(req, db) {
  const {
    caseId,
    visitDate,
    visitResult,
    personMet,
    notes,
    photoUrls,
    latitude,
    longitude,
    performedBy
  } = req.body;

  if (!caseId) {
    return { error: 'Case ID required' };
  }

  const activityId = await logCollectionActivity(db, {
    caseId,
    activityType: 'visit',
    activityResult: visitResult,
    contactPerson: personMet,
    subject: `Field visit - ${visitResult}`,
    content: notes,
    performedBy
  });

  // Store additional visit data (could be in separate table)
  // For now, just log the activity

  return { success: true, activityId };
}

/**
 * Create Payment Arrangement
 */
async function createPaymentArrangement(req, db) {
  const {
    caseId,
    arrangementType, // 'installment', 'extension', 'settlement'
    proposedAmount,
    installmentCount,
    installmentAmount,
    startDate,
    notes,
    performedBy
  } = req.body;

  if (!caseId) {
    return { error: 'Case ID required' };
  }

  // Log as promise/arrangement
  const activityId = await logCollectionActivity(db, {
    caseId,
    activityType: 'promise',
    activityResult: 'arranged',
    subject: `Payment arrangement: ${arrangementType}`,
    content: JSON.stringify({
      type: arrangementType,
      proposedAmount,
      installmentCount,
      installmentAmount,
      startDate,
      notes
    }),
    promiseAmount: proposedAmount,
    promiseDate: startDate,
    performedBy
  });

  // Update case
  await db.execute(`
    UPDATE collection_cases
    SET has_promise = 1,
        promise_date = ?,
        promise_amount = ?,
        status = 'promised'
    WHERE id = ?
  `, [startDate, proposedAmount, caseId]);

  return { success: true, activityId, arrangementType };
}

/**
 * Escalate Case
 */
async function escalateCase(req, db) {
  const { caseId, newStage, reason, escalatedBy } = req.body;

  if (!caseId || !newStage) {
    return { error: 'Case ID and new stage required' };
  }

  await db.execute(`
    UPDATE collection_cases
    SET collection_stage = ?,
        escalation_level = escalation_level + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStage, caseId]);

  // Log escalation
  await logCollectionActivity(db, {
    caseId,
    activityType: 'note',
    subject: `Case escalated to ${newStage}`,
    content: reason || 'Case escalated to next collection stage',
    performedBy: escalatedBy
  });

  return { success: true, caseId, newStage };
}

/**
 * Close Collection Case
 */
async function closeCase(req, db) {
  const { caseId, resolution, amountCollected, notes, closedBy } = req.body;

  if (!caseId || !resolution) {
    return { error: 'Case ID and resolution required' };
  }

  await db.execute(`
    UPDATE collection_cases
    SET status = 'closed',
        resolution = ?,
        resolution_date = CURRENT_TIMESTAMP,
        amount_collected = ?,
        closed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [resolution, amountCollected || 0, caseId]);

  // Log closure
  await logCollectionActivity(db, {
    caseId,
    activityType: 'note',
    subject: `Case closed: ${resolution}`,
    content: notes || `Case resolved with ${resolution}`,
    performedBy: closedBy
  });

  return { success: true, caseId, resolution };
}

/**
 * Get Case Details with Activity History
 */
async function getCaseDetails(req, db) {
  const { caseId } = req.params;

  // Get case info
  const caseQuery = `
    SELECT 
      cc.*,
      l.loan_number,
      l.principal_amount,
      l.outstanding_amount,
      l.due_date,
      l.disbursement_date,
      u.full_name,
      u.phone,
      u.email,
      u.address,
      collector.full_name as collector_name
    FROM collection_cases cc
    JOIN loans l ON cc.loan_id = l.id
    JOIN users u ON cc.user_id = u.id
    LEFT JOIN users collector ON cc.assigned_to = collector.id
    WHERE cc.id = ?
  `;

  const cases = await db.query(caseQuery, [caseId]);

  if (cases.length === 0) {
    return { error: 'Case not found' };
  }

  const case_item = cases[0];

  // Get activity history
  const activityQuery = `
    SELECT 
      ca.*,
      u.full_name as performed_by_name
    FROM collection_activities ca
    LEFT JOIN users u ON ca.performed_by = u.id
    WHERE ca.case_id = ?
    ORDER BY ca.performed_at DESC
  `;

  const activities = await db.query(activityQuery, [caseId]);

  return {
    case: case_item,
    activities,
    summary: {
      totalActivities: activities.length,
      calls: activities.filter(a => a.activity_type === 'call').length,
      visits: activities.filter(a => a.activity_type === 'visit').length,
      reminders: activities.filter(a => ['sms', 'whatsapp', 'email'].includes(a.activity_type)).length
    }
  };
}

/**
 * Get Collection Statistics
 */
async function getCollectionStats(req, db) {
  const { startDate, endDate, collectorId } = req.query || {};

  let whereClause = '1=1';
  const params = [];

  if (startDate) {
    whereClause += ' AND cc.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND cc.created_at <= ?';
    params.push(endDate);
  }
  if (collectorId) {
    whereClause += ' AND cc.assigned_to = ?';
    params.push(collectorId);
  }

  // Overall stats
  const statsQuery = `
    SELECT 
      COUNT(*) as total_cases,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_cases,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_cases,
      SUM(CASE WHEN resolution = 'paid' THEN 1 ELSE 0 END) as paid_cases,
      SUM(total_amount_due) as total_amount_due,
      SUM(amount_collected) as total_collected,
      AVG(JULIANDAY(resolution_date) - JULIANDAY(created_at)) as avg_resolution_days
    FROM collection_cases cc
    WHERE ${whereClause}
  `;

  const stats = await db.query(statsQuery, params);

  // By stage
  const byStageQuery = `
    SELECT 
      collection_stage,
      COUNT(*) as count,
      SUM(total_amount_due) as total_amount
    FROM collection_cases cc
    WHERE ${whereClause} AND status IN ('open', 'in_progress', 'promised')
    GROUP BY collection_stage
  `;

  const byStage = await db.query(byStageQuery, params);

  return {
    overall: stats[0],
    byStage,
    collectionRate: stats[0].total_collected / (stats[0].total_amount_due || 1) * 100
  };
}

// ============ Helper Functions ============

function determineCollectionStage(daysOverdue) {
  if (daysOverdue <= 7) return 'soft_reminder';
  if (daysOverdue <= 14) return 'first_warning';
  if (daysOverdue <= 30) return 'intensive';
  if (daysOverdue <= 60) return 'legal_notice';
  return 'legal_action';
}

function determineReminderChannels(daysOverdue) {
  if (daysOverdue <= 3) return ['push', 'sms'];
  if (daysOverdue <= 7) return ['sms', 'whatsapp'];
  if (daysOverdue <= 14) return ['sms', 'whatsapp', 'email'];
  return ['sms', 'whatsapp', 'email', 'push'];
}

function generateReminderMessage(case_item) {
  const amount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(case_item.outstanding_amount);

  const daysOverdue = case_item.days_overdue || 0;

  if (daysOverdue <= 3) {
    return `Halo ${case_item.full_name}, pembayaran pinjaman ${case_item.loan_number} telah melewati jatuh tempo ${daysOverdue} hari. Jumlah tagihan: ${amount}. Mohon segera lakukan pembayaran.`;
  } else if (daysOverdue <= 7) {
    return `PERINGATAN: Pembayaran pinjaman ${case_item.loan_number} terlambat ${daysOverdue} hari. Jumlah: ${amount}. Segera bayar untuk menghindari denda tambahan. Hubungi kami untuk bantuan.`;
  } else if (daysOverdue <= 30) {
    return `PERINGATAN SERIUS: Pinjaman ${case_item.loan_number} terlambat ${daysOverdue} hari. Tunggakan: ${amount}. Mohon hubungi kami segera di 1500-XXX untuk pengaturan pembayaran. Hindari tindakan hukum.`;
  } else {
    return `PERINGATAN TERAKHIR: Tunggakan pinjaman ${case_item.loan_number} telah melampaui ${daysOverdue} hari. Jumlah: ${amount}. Kami akan mengambil tindakan hukum jika tidak ada pembayaran dalam 7 hari. Hubungi 1500-XXX SEGERA.`;
  }
}

function generateId() {
  return require('crypto').randomBytes(16).toString('hex');
}

// Export functions
module.exports = {
  getCollectionQueue,
  createCollectionCase,
  assignCase,
  recordCall,
  sendReminder,
  processAutomatedReminders,
  recordFieldVisit,
  createPaymentArrangement,
  escalateCase,
  closeCase,
  getCaseDetails,
  getCollectionStats
};
