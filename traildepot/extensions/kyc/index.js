/**
 * KYC Extension for TrailBase
 * Handles KYC verification with OCR and face recognition
 */

/**
 * Submit KYC document
 */
export async function submitKYC(ctx) {
  const userId = ctx.state.user.id;
  const { verification_type, document_type, document_number } = ctx.request.body;
  
  if (!verification_type) {
    return ctx.json({ error: 'Verification type required' }, 400);
  }
  
  // Create KYC verification record
  const result = await ctx.db.run(
    `INSERT INTO kyc_verifications (
      user_id, verification_type, document_type, document_number, status
    ) VALUES (?, ?, ?, ?, 'pending')`,
    [userId, verification_type, document_type, document_number]
  );
  
  const kycId = result.lastID;
  
  // Log audit
  await ctx.db.run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
     VALUES (?, 'kyc_submit', 'kyc_verification', ?)`,
    [userId, kycId]
  );
  
  return ctx.json({
    success: true,
    kyc_id: kycId,
    status: 'pending',
    message: 'KYC verification submitted'
  }, 201);
}

/**
 * Process OCR for document
 */
export async function processOCR(ctx) {
  const { kyc_id, image_url } = ctx.request.body;
  
  // Get KYC record
  const kyc = await ctx.db.get(
    'SELECT * FROM kyc_verifications WHERE id = ?',
    [kyc_id]
  );
  
  if (!kyc) {
    return ctx.json({ error: 'KYC record not found' }, 404);
  }
  
  // In production: Call Google Vision API or AWS Textract
  // For now, simulate OCR processing
  const ocrData = {
    name: 'John Doe',
    id_number: '1234567890123456',
    birth_date: '1990-01-15',
    address: 'Jakarta',
    confidence: 0.95
  };
  
  // Update KYC with OCR data
  await ctx.db.run(
    `UPDATE kyc_verifications 
     SET ocr_data = ?, status = 'processing' 
     WHERE id = ?`,
    [JSON.stringify(ocrData), kyc_id]
  );
  
  return ctx.json({
    success: true,
    ocr_data: ocrData
  });
}

/**
 * Perform face match verification
 */
export async function verifyFaceMatch(ctx) {
  const { kyc_id, selfie_url } = ctx.request.body;
  
  const kyc = await ctx.db.get(
    'SELECT * FROM kyc_verifications WHERE id = ?',
    [kyc_id]
  );
  
  if (!kyc) {
    return ctx.json({ error: 'KYC record not found' }, 404);
  }
  
  // In production: Call AWS Rekognition or similar
  // For now, simulate face matching
  const faceMatchScore = 0.92;
  const livenessScore = 0.88;
  
  await ctx.db.run(
    `UPDATE kyc_verifications 
     SET face_match_score = ?, liveness_score = ?, status = 'verified'
     WHERE id = ?`,
    [faceMatchScore, livenessScore, kyc_id]
  );
  
  // Update user KYC status
  await ctx.db.run(
    `UPDATE users SET kyc_status = 'verified', status = 'active' WHERE id = ?`,
    [kyc.user_id]
  );
  
  // Create notification
  await ctx.db.run(
    `INSERT INTO notifications (user_id, type, channel, title, message)
     VALUES (?, 'kyc_update', 'push', 'KYC Verified', 'Your identity has been verified')`,
    [kyc.user_id]
  );
  
  return ctx.json({
    success: true,
    face_match_score: faceMatchScore,
    liveness_score: livenessScore,
    status: 'verified'
  });
}

/**
 * Get KYC status
 */
export async function getKYCStatus(ctx) {
  const userId = ctx.state.user.id;
  
  const kyc = await ctx.db.get(
    'SELECT * FROM kyc_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  
  return ctx.json({
    success: true,
    kyc: kyc || null
  });
}

export default {
  submitKYC,
  processOCR,
  verifyFaceMatch,
  getKYCStatus
};
