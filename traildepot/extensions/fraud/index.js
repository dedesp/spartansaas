/**
 * Fraud Detection Extension
 * Multi-layer fraud detection system with device fingerprinting and behavioral analysis
 */

const crypto = require('crypto');

/**
 * Device Fingerprint Detection
 * FR-FRAUD-001: Device fingerprinting
 */
async function checkDeviceFingerprint(req, db) {
  const { deviceId, deviceModel, deviceOs, userAgent, userId } = req.body;
  
  if (!deviceId) {
    return { error: 'Device ID required' };
  }

  const deviceFingerprint = crypto
    .createHash('sha256')
    .update(`${deviceId}:${deviceModel}:${deviceOs}`)
    .digest('hex');

  // Check for rooted/jailbroken device indicators
  const isRooted = checkRootedDevice(deviceModel, deviceOs);
  const isEmulator = checkEmulator(deviceModel, userAgent);
  const hasVpn = checkVpnProxy(req);

  // Check multiple accounts on same device
  const deviceUsageQuery = `
    SELECT COUNT(DISTINCT user_id) as user_count
    FROM user_sessions
    WHERE device_id = ?
  `;
  const deviceUsage = await db.query(deviceUsageQuery, [deviceId]);
  const multipleAccounts = deviceUsage[0]?.user_count > 3;

  // Calculate risk score
  let riskScore = 0;
  const indicators = [];

  if (isRooted) {
    riskScore += 30;
    indicators.push({ type: 'rooted_device', severity: 'high' });
  }
  if (isEmulator) {
    riskScore += 40;
    indicators.push({ type: 'emulator_detected', severity: 'critical' });
  }
  if (hasVpn) {
    riskScore += 20;
    indicators.push({ type: 'vpn_detected', severity: 'medium' });
  }
  if (multipleAccounts) {
    riskScore += 25;
    indicators.push({ type: 'multiple_accounts', severity: 'high' });
  }

  // Determine action
  let action = 'allowed';
  let actionReason = 'Device check passed';

  if (riskScore >= 80) {
    action = 'blocked';
    actionReason = 'Critical fraud indicators detected';
  } else if (riskScore >= 60) {
    action = 'manual_review';
    actionReason = 'High risk device detected';
  } else if (riskScore >= 30) {
    action = 'challenged';
    actionReason = 'Suspicious device activity';
  }

  // Log fraud detection
  const logQuery = `
    INSERT INTO fraud_detection_logs (
      user_id, detection_type, risk_score, risk_level,
      indicators, device_id, device_fingerprint, is_rooted,
      is_emulator, has_vpn, action_taken, action_reason, detected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

  await db.execute(logQuery, [
    userId || null,
    'device',
    riskScore,
    riskLevel,
    JSON.stringify(indicators),
    deviceId,
    deviceFingerprint,
    isRooted ? 1 : 0,
    isEmulator ? 1 : 0,
    hasVpn ? 1 : 0,
    action,
    actionReason
  ]);

  return {
    allowed: action === 'allowed',
    action,
    actionReason,
    riskScore,
    riskLevel,
    indicators,
    deviceFingerprint
  };
}

/**
 * Behavioral Analysis
 * FR-FRAUD-002: Detect suspicious patterns
 */
async function analyzeBehavior(req, db) {
  const { userId, action, metadata } = req.body;

  if (!userId) {
    return { error: 'User ID required' };
  }

  const indicators = [];
  let riskScore = 0;

  // Check rapid applications (>3 in 24 hours)
  const rapidApplicationsQuery = `
    SELECT COUNT(*) as app_count
    FROM loans
    WHERE user_id = ?
      AND created_at >= datetime('now', '-24 hours')
  `;
  const rapidApps = await db.query(rapidApplicationsQuery, [userId]);
  if (rapidApps[0]?.app_count > 3) {
    riskScore += 35;
    indicators.push({
      type: 'rapid_applications',
      severity: 'high',
      detail: `${rapidApps[0].app_count} applications in 24 hours`
    });
  }

  // Check unusual location (if provided)
  if (metadata?.latitude && metadata?.longitude) {
    const userHomeQuery = `
      SELECT application_lat, application_lng
      FROM loans
      WHERE user_id = ?
        AND application_lat IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const userHome = await db.query(userHomeQuery, [userId]);
    
    if (userHome.length > 0) {
      const distance = calculateDistance(
        metadata.latitude,
        metadata.longitude,
        userHome[0].application_lat,
        userHome[0].application_lng
      );
      
      if (distance > 100) { // More than 100km from usual location
        riskScore += 25;
        indicators.push({
          type: 'unusual_location',
          severity: 'medium',
          detail: `${Math.round(distance)}km from usual location`
        });
      }
    }
  }

  // Check night time activity (00:00-05:00)
  const currentHour = new Date().getHours();
  if (currentHour >= 0 && currentHour < 5) {
    riskScore += 15;
    indicators.push({
      type: 'night_activity',
      severity: 'low',
      detail: `Activity at ${currentHour}:00`
    });
  }

  // Check form fill time (if provided)
  if (metadata?.formFillTime && metadata.formFillTime < 30) {
    riskScore += 30;
    indicators.push({
      type: 'bot_suspected',
      severity: 'high',
      detail: `Form completed in ${metadata.formFillTime} seconds`
    });
  }

  // Determine action
  let actionTaken = 'allowed';
  if (riskScore >= 60) {
    actionTaken = 'manual_review';
  } else if (riskScore >= 40) {
    actionTaken = 'flagged';
  }

  const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

  // Log behavioral analysis
  const logQuery = `
    INSERT INTO fraud_detection_logs (
      user_id, detection_type, risk_score, risk_level,
      indicators, action_taken, detected_at, additional_data
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `;

  await db.execute(logQuery, [
    userId,
    'behavior',
    riskScore,
    riskLevel,
    JSON.stringify(indicators),
    actionTaken,
    JSON.stringify(metadata || {})
  ]);

  return {
    riskScore,
    riskLevel,
    indicators,
    action: actionTaken,
    requiresReview: actionTaken === 'manual_review'
  };
}

/**
 * Document Fraud Detection
 * FR-FRAUD-003: Check for document manipulation
 */
async function checkDocumentFraud(req, db) {
  const { userId, documentType, documentUrl, extractedData } = req.body;

  if (!userId || !documentType) {
    return { error: 'User ID and document type required' };
  }

  const indicators = [];
  let riskScore = 0;

  // Check for duplicate KTP/NIK
  if (documentType === 'ktp' && extractedData?.nik) {
    const duplicateQuery = `
      SELECT COUNT(*) as dup_count
      FROM kyc_verifications
      WHERE extracted_nik = ?
        AND user_id != ?
        AND verification_status = 'success'
    `;
    const duplicates = await db.query(duplicateQuery, [extractedData.nik, userId]);
    
    if (duplicates[0]?.dup_count > 0) {
      riskScore += 80;
      indicators.push({
        type: 'duplicate_document',
        severity: 'critical',
        detail: `NIK already registered by ${duplicates[0].dup_count} other user(s)`
      });
    }
  }

  // Check for image manipulation (basic checks - would integrate with ML in production)
  // In production, this would call external service like Amazon Rekognition
  if (documentUrl) {
    // Placeholder for actual image analysis
    const manipulationCheck = await checkImageManipulation(documentUrl);
    if (manipulationCheck.isManipulated) {
      riskScore += 70;
      indicators.push({
        type: 'document_manipulation',
        severity: 'critical',
        detail: 'Image manipulation detected'
      });
    }
  }

  // Check face spoofing (if face data provided)
  if (extractedData?.faceUrl) {
    const spoofingCheck = await checkFaceSpoofing(extractedData.faceUrl);
    if (spoofingCheck.isSpoofed) {
      riskScore += 75;
      indicators.push({
        type: 'face_spoofing',
        severity: 'critical',
        detail: 'Face spoofing attempt detected'
      });
    }
  }

  // Check for inconsistent data
  if (extractedData?.name && extractedData?.birthDate) {
    const userDataQuery = `
      SELECT full_name, birth_date
      FROM users
      WHERE id = ?
    `;
    const userData = await db.query(userDataQuery, [userId]);
    
    if (userData.length > 0) {
      const nameSimilarity = calculateStringSimilarity(
        extractedData.name.toLowerCase(),
        userData[0].full_name.toLowerCase()
      );
      
      if (nameSimilarity < 0.7) {
        riskScore += 40;
        indicators.push({
          type: 'name_mismatch',
          severity: 'high',
          detail: `Name similarity: ${Math.round(nameSimilarity * 100)}%`
        });
      }
    }
  }

  // Determine action
  let action = 'allowed';
  if (riskScore >= 80) {
    action = 'blocked';
  } else if (riskScore >= 60) {
    action = 'manual_review';
  } else if (riskScore >= 40) {
    action = 'flagged';
  }

  const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

  // Log document fraud check
  const logQuery = `
    INSERT INTO fraud_detection_logs (
      user_id, detection_type, detection_method, risk_score, risk_level,
      indicators, action_taken, detected_at, additional_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `;

  await db.execute(logQuery, [
    userId,
    'document',
    documentType,
    riskScore,
    riskLevel,
    JSON.stringify(indicators),
    action,
    JSON.stringify({ documentUrl, extractedData })
  ]);

  return {
    riskScore,
    riskLevel,
    indicators,
    action,
    requiresReview: action === 'manual_review',
    blocked: action === 'blocked'
  };
}

/**
 * Comprehensive Fraud Check
 * Combines all fraud detection layers
 */
async function comprehensiveFraudCheck(req, db) {
  const { userId, context } = req.body;

  if (!userId) {
    return { error: 'User ID required' };
  }

  // Run all fraud checks in parallel
  const [deviceCheck, behaviorCheck, documentCheck] = await Promise.all([
    checkDeviceFingerprint({ body: { ...context.device, userId } }, db),
    analyzeBehavior({ body: { userId, action: context.action, metadata: context.metadata } }, db),
    context.document
      ? checkDocumentFraud({ body: { userId, ...context.document } }, db)
      : Promise.resolve({ riskScore: 0, indicators: [] })
  ]);

  // Aggregate risk scores
  const totalRiskScore = Math.min(
    100,
    (deviceCheck.riskScore || 0) * 0.35 +
    (behaviorCheck.riskScore || 0) * 0.35 +
    (documentCheck.riskScore || 0) * 0.30
  );

  const allIndicators = [
    ...(deviceCheck.indicators || []),
    ...(behaviorCheck.indicators || []),
    ...(documentCheck.indicators || [])
  ];

  // Determine final action
  let finalAction = 'allowed';
  if (deviceCheck.action === 'blocked' || documentCheck.blocked) {
    finalAction = 'blocked';
  } else if (totalRiskScore >= 60) {
    finalAction = 'manual_review';
  } else if (totalRiskScore >= 40) {
    finalAction = 'flagged';
  }

  const riskLevel = totalRiskScore >= 60 ? 'high' : totalRiskScore >= 30 ? 'medium' : 'low';

  return {
    allowed: finalAction === 'allowed',
    action: finalAction,
    totalRiskScore,
    riskLevel,
    indicators: allIndicators,
    checks: {
      device: deviceCheck,
      behavior: behaviorCheck,
      document: documentCheck
    }
  };
}

/**
 * Get User Fraud History
 */
async function getUserFraudHistory(req, db) {
  const { userId } = req.params;

  const query = `
    SELECT 
      id,
      detection_type,
      risk_score,
      risk_level,
      indicators,
      action_taken,
      detected_at
    FROM fraud_detection_logs
    WHERE user_id = ?
    ORDER BY detected_at DESC
    LIMIT 50
  `;

  const logs = await db.query(query, [userId]);

  return {
    userId,
    totalChecks: logs.length,
    logs: logs.map(log => ({
      ...log,
      indicators: JSON.parse(log.indicators || '[]')
    }))
  };
}

// ============ Helper Functions ============

function checkRootedDevice(model, os) {
  // Simplified check - production would use more sophisticated detection
  const rootIndicators = [
    'rooted', 'magisk', 'supersu', 'jailbroken', 'cydia'
  ];
  
  const modelLower = (model || '').toLowerCase();
  const osLower = (os || '').toLowerCase();
  
  return rootIndicators.some(indicator => 
    modelLower.includes(indicator) || osLower.includes(indicator)
  );
}

function checkEmulator(model, userAgent) {
  const emulatorIndicators = [
    'emulator', 'simulator', 'genymotion', 'bluestacks',
    'android sdk', 'generic', 'goldfish'
  ];
  
  const modelLower = (model || '').toLowerCase();
  const uaLower = (userAgent || '').toLowerCase();
  
  return emulatorIndicators.some(indicator =>
    modelLower.includes(indicator) || uaLower.includes(indicator)
  );
}

function checkVpnProxy(req) {
  // Simplified check - production would use IP intelligence services
  const userAgent = req.headers['user-agent'] || '';
  const forwarded = req.headers['x-forwarded-for'] || '';
  
  return userAgent.toLowerCase().includes('vpn') || 
         forwarded.split(',').length > 2;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

async function checkImageManipulation(imageUrl) {
  // Placeholder - production would integrate with Amazon Rekognition or similar
  // For now, return safe result
  return { isManipulated: false, confidence: 0.95 };
}

async function checkFaceSpoofing(faceUrl) {
  // Placeholder - production would integrate with Face++ or AWS Rekognition
  return { isSpoofed: false, confidence: 0.9 };
}

function calculateStringSimilarity(str1, str2) {
  // Simple Levenshtein distance similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Export functions
module.exports = {
  checkDeviceFingerprint,
  analyzeBehavior,
  checkDocumentFraud,
  comprehensiveFraudCheck,
  getUserFraudHistory
};
