import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { AgentVerificationAssessment } from './types.js';

/**
 * AI-Assisted Agent Verification Engine
 * Analyzes multi-dimensional reliability, credentials, and behavioral history.
 */
export function evaluateAgentVerification(agent: {
  id: string;
  name: string;
  phone?: string;
  is_identity_verified?: number | boolean;
  is_phone_verified?: number | boolean;
  experience_years?: number;
  skills?: string;
  rating?: number;
  completion_rate?: number;
  response_rate?: number;
  total_completed_tasks?: number;
  suspicious_flag?: number;
}): AgentVerificationAssessment {
  let profileCompleteness = 0;
  if (agent.phone && agent.phone.length > 8) profileCompleteness += 25;
  if (agent.is_identity_verified) profileCompleteness += 35;
  if (agent.is_phone_verified) profileCompleteness += 20;
  if (agent.skills) profileCompleteness += 20;

  const identityVerified = Boolean(agent.is_identity_verified);
  const phoneVerified = Boolean(agent.is_phone_verified);

  // Experience & skills score (0-100)
  const experienceYears = agent.experience_years || 1;
  const experienceScore = Math.min(100, Math.round(experienceYears * 18 + 25));

  // Historical rating score (0-100)
  const rating = agent.rating || 5.0;
  const historicalRatingScore = Math.min(100, Math.round((rating / 5.0) * 100));

  // Completion reliability score (0-100)
  const completionRate = agent.completion_rate !== undefined ? agent.completion_rate : 0.98;
  const historicalCompletionScore = Math.min(100, Math.round(completionRate * 100));

  // Fraud / Safety Risk Score (100 = spotless, lower = suspicious)
  let fraudRiskScore = 98;
  if (agent.suspicious_flag) fraudRiskScore -= 40;

  // Weighted overall trust calculation
  // Identity/Phone: 30%, Rating: 25%, Completion: 25%, Experience: 10%, Fraud Cleanliness: 10%
  const weightedScore =
    (profileCompleteness * 0.30) +
    (historicalRatingScore * 0.25) +
    (historicalCompletionScore * 0.25) +
    (experienceScore * 0.10) +
    (fraudRiskScore * 0.10);

  const finalScore = Number(Math.min(100, Math.max(0, weightedScore)).toFixed(1));

  let status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' = 'VERIFIED';
  let recommendation = 'Approve for live task matching';
  let summary = `Agent ${agent.name} demonstrates a strong reliability score of ${finalScore}/100. Identity and phone verified with high satisfaction history.`;

  if (agent.suspicious_flag) {
    status = 'SUSPENDED';
    recommendation = 'Hold assignments. Suspicious activity flag logged.';
    summary = `Flagged for safety review. Suspicious activity signal detected in recent tasks.`;
  } else if (!identityVerified || !phoneVerified || profileCompleteness < 75) {
    status = 'PENDING';
    recommendation = 'Awaiting document or phone verification';
    summary = `Profile is incomplete (${profileCompleteness}%). Requires valid phone and government ID verification.`;
  } else if (finalScore < 60) {
    status = 'REJECTED';
    recommendation = 'Fails minimum quality threshold';
    summary = `Quality score (${finalScore}/100) falls below platform threshold. Low completion rate or past disputes.`;
  }

  return {
    score: finalScore,
    status,
    recommendation,
    summary,
    breakdown: {
      profileCompleteness,
      identityVerified,
      phoneVerified,
      experienceScore,
      historicalRatingScore,
      historicalCompletionScore,
      fraudRiskScore,
    },
  };
}

/**
 * Executes AI verification check for an agent and writes to audit history
 */
export function runAgentVerificationCheck(agentId: string): AgentVerificationAssessment {
  const agent = db.prepare('SELECT * FROM profiles WHERE id = ?').get(agentId) as any;
  if (!agent) {
    throw new Error('Agent not found');
  }

  const assessment = evaluateAgentVerification(agent);

  // Update profile
  db.prepare(`
    UPDATE profiles 
    SET verification_status = ?,
        verification_score = ?,
        verification_notes = ?
    WHERE id = ?
  `).run(assessment.status, assessment.score, assessment.summary, agentId);

  // Record verification history
  const recordId = uuidv4();
  db.prepare(`
    INSERT INTO agent_verifications (
      id, agent_id, status, ai_score, ai_summary, breakdown, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    recordId,
    agentId,
    assessment.status,
    assessment.score,
    assessment.summary,
    JSON.stringify(assessment.breakdown)
  );

  return assessment;
}

/**
 * Admin overrides or confirms agent verification decision
 */
export function adminReviewVerification(params: {
  agentId: string;
  status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'PENDING';
  adminId: string;
  adminNotes: string;
}): { success: boolean; message: string } {
  const { agentId, status, adminId, adminNotes } = params;

  db.prepare(`
    UPDATE profiles 
    SET verification_status = ?,
        verification_notes = ?
    WHERE id = ?
  `).run(status, adminNotes, agentId);

  const recordId = uuidv4();
  db.prepare(`
    INSERT INTO agent_verifications (
      id, agent_id, status, ai_score, ai_summary, reviewed_by, admin_notes, created_at, reviewed_at
    ) VALUES (?, ?, ?, 100.0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    recordId,
    agentId,
    status,
    `Admin manual review: ${adminNotes}`,
    adminId,
    adminNotes
  );

  return {
    success: true,
    message: `Agent verification updated to ${status}.`,
  };
}
