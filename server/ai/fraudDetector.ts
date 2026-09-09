import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from '../websocket.js';

export interface FraudAlertRecord {
  id: string;
  user_id: string;
  userName?: string;
  userRole?: string;
  task_id?: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: string;
  status: string;
  created_at: string;
}

/**
 * AI Fraud Radar: Checks for suspicious booking, cancellation, or fulfillment patterns
 */
export function detectSuspiciousActivity(params: {
  userId: string;
  role: 'CUSTOMER' | 'AGENT';
  eventType: 'CANCELLATION' | 'COMPLETION' | 'REVIEW' | 'REFUND_REQUEST';
  taskId?: string;
  metadata?: any;
}): FraudAlertRecord | null {
  const { userId, role, eventType, taskId, metadata } = params;

  let alertType = '';
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let details = '';

  // 1. Rapid cancellation check (>2 cancellations in last 1 hour)
  if (eventType === 'CANCELLATION') {
    const recentCancels = db.prepare(`
      SELECT COUNT(*) as count 
      FROM task_events 
      WHERE actor_id = ? AND event_type IN ('CANCELLED', 'REJECTED')
        AND created_at >= datetime('now', '-1 hour')
    `).get(userId) as any;

    if (recentCancels && recentCancels.count >= 3) {
      alertType = 'REPEAT_CANCELLATION_ANOMALY';
      severity = 'HIGH';
      details = `User logged ${recentCancels.count} cancellations within the past 60 minutes. Flagged for admin pattern review.`;
    } else if (recentCancels && recentCancels.count === 2) {
      alertType = 'ELEVATED_CANCELLATION_FREQUENCY';
      severity = 'MEDIUM';
      details = `User cancelled 2 tasks within 60 minutes. Elevated cancellation activity.`;
    }
  }

  // 2. Suspicious fast completion (< 2 mins from acceptance)
  if (eventType === 'COMPLETION' && taskId) {
    const acceptEvent = db.prepare(`
      SELECT created_at FROM task_events 
      WHERE task_id = ? AND event_type = 'ACCEPTED' 
      ORDER BY created_at DESC LIMIT 1
    `).get(taskId) as any;

    if (acceptEvent) {
      const acceptedTime = new Date(acceptEvent.created_at).getTime();
      const now = Date.now();
      const durationSeconds = (now - acceptedTime) / 1000;

      if (durationSeconds < 120) {
        alertType = 'UNREALISTICALLY_FAST_COMPLETION';
        severity = 'HIGH';
        details = `Task completed in only ${Math.round(durationSeconds)} seconds from acceptance. Proof photo and fulfillment authenticity requires verification.`;
      }
    }
  }

  // 3. Low rating flood or dispute pattern
  if (eventType === 'REVIEW' && metadata?.rating === 1) {
    const recentBadRatings = db.prepare(`
      SELECT COUNT(*) as count 
      FROM reviews 
      WHERE customer_id = ? AND rating = 1 
        AND created_at >= datetime('now', '-24 hours')
    `).get(userId) as any;

    if (recentBadRatings && recentBadRatings.count >= 3) {
      alertType = 'ABNORMAL_RATING_PATTERN';
      severity = 'MEDIUM';
      details = `Customer submitted ${recentBadRatings.count} consecutive 1-star reviews in 24 hours. Possible targeted review manipulation.`;
    }
  }

  if (alertType) {
    const alertId = uuidv4();
    db.prepare(`
      INSERT INTO fraud_alerts (id, user_id, task_id, alert_type, severity, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', CURRENT_TIMESTAMP)
    `).run(alertId, userId, taskId || null, alertType, severity, details);

    // Flag on user profile without blocking automatically
    db.prepare('UPDATE profiles SET suspicious_flag = 1 WHERE id = ?').run(userId);

    const record: FraudAlertRecord = {
      id: alertId,
      user_id: userId,
      task_id: taskId,
      alert_type: alertType,
      severity,
      details,
      status: 'PENDING_REVIEW',
      created_at: new Date().toISOString(),
    };

    broadcastEvent({
      type: 'FRAUD_ALERT',
      payload: record,
    });

    return record;
  }

  return null;
}

/**
 * Admin resolves or dismisses fraud alert
 */
export function resolveFraudAlert(alertId: string, action: 'DISMISS' | 'CONFIRM_SUSPEND', notes?: string) {
  const alert = db.prepare('SELECT * FROM fraud_alerts WHERE id = ?').get(alertId) as any;
  if (!alert) return { success: false, message: 'Alert not found' };

  if (action === 'DISMISS') {
    db.prepare("UPDATE fraud_alerts SET status = 'DISMISSED' WHERE id = ?").run(alertId);
    db.prepare("UPDATE profiles SET suspicious_flag = 0 WHERE id = ?").run(alert.user_id);
  } else {
    db.prepare("UPDATE fraud_alerts SET status = 'ACTION_TAKEN' WHERE id = ?").run(alertId);
    db.prepare("UPDATE profiles SET verification_status = 'SUSPENDED' WHERE id = ?").run(alert.user_id);
  }

  return { success: true, message: `Alert updated to ${action === 'DISMISS' ? 'DISMISSED' : 'SUSPENDED'}` };
}
