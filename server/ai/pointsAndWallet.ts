import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomerTierThresholds, CompensationPolicy } from './types.js';

/**
 * Retrieves or initializes customer wallet
 */
export function getOrCreateCustomerWallet(customerId: string) {
  let wallet = db.prepare('SELECT * FROM customer_wallets WHERE customer_id = ?').get(customerId) as any;
  if (!wallet) {
    db.prepare(`
      INSERT INTO customer_wallets (
        customer_id, refund_balance, service_credits, compensation_points, reward_points, priority_tier
      ) VALUES (?, 0.0, 0.0, 0, 50, 'New Customer')
    `).run(customerId);

    wallet = db.prepare('SELECT * FROM customer_wallets WHERE customer_id = ?').get(customerId);
  }
  return wallet;
}

/**
 * Computes customer tier based on reward points
 */
export function calculateCustomerTier(points: number): string {
  try {
    const setting = db.prepare("SELECT value FROM platform_settings WHERE key = 'customer_tier_thresholds'").get() as any;
    const thresholds: CustomerTierThresholds = setting ? JSON.parse(setting.value) : {
      newCustomer: 0,
      regularCustomer: 100,
      priorityCustomer: 300,
      trustedCustomer: 600,
    };

    if (points >= thresholds.trustedCustomer) return 'Trusted Customer';
    if (points >= thresholds.priorityCustomer) return 'Priority Customer';
    if (points >= thresholds.regularCustomer) return 'Regular Customer';
    return 'New Customer';
  } catch {
    if (points >= 600) return 'Trusted Customer';
    if (points >= 300) return 'Priority Customer';
    if (points >= 100) return 'Regular Customer';
    return 'New Customer';
  }
}

/**
 * Awards reward points for a successfully confirmed task
 */
export function awardCustomerTaskCompletionPoints(params: {
  customerId: string;
  taskId: string;
  ratingGiven?: number;
  completedOnTime?: boolean;
}): {
  pointsAwarded: number;
  totalPoints: number;
  newTier: string;
  breakdown: string[];
} {
  const { customerId, taskId, ratingGiven = 5, completedOnTime = true } = params;
  const wallet = getOrCreateCustomerWallet(customerId);

  let pointsEarned = 50; // Base completion reward
  const breakdown: string[] = ['+50 points for successful task completion'];

  if (completedOnTime) {
    pointsEarned += 20;
    breakdown.push('+20 points on-time completion bonus');
  }

  if (ratingGiven >= 4) {
    pointsEarned += 15;
    breakdown.push('+15 points helpful feedback bonus');
  }

  const newPointsTotal = (wallet.reward_points || 0) + pointsEarned;
  const newTier = calculateCustomerTier(newPointsTotal);

  const txId = uuidv4();
  const updateTx = db.transaction(() => {
    db.prepare(`
      UPDATE customer_wallets 
      SET reward_points = ?,
          priority_tier = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE customer_id = ?
    `).run(newPointsTotal, newTier, customerId);

    db.prepare(`
      INSERT INTO wallet_transactions (id, customer_id, type, amount, description, task_id, created_at)
      VALUES (?, ?, 'REWARD_POINTS', ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      txId,
      customerId,
      pointsEarned,
      `Task completed: ${breakdown.join(', ')}`,
      taskId
    );
  });

  updateTx();

  return {
    pointsAwarded: pointsEarned,
    totalPoints: newPointsTotal,
    newTier,
    breakdown,
  };
}

/**
 * Handles Unsuccessful Service Request Compensation Workflow
 * Strictly distinguishes compensation credits/points from customer reward points!
 */
export function handleUnsuccessfulServiceRequest(params: {
  taskId: string;
  reason?: string;
}): {
  success: boolean;
  refundIssued: number;
  serviceCreditIssued: number;
  compensationPointsIssued: number;
  explanation: string;
} {
  const { taskId, reason = 'No qualified nearby agent accepted within the required dispatch window' } = params;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status === 'COMPLETED' || task.status === 'CONFIRMED') {
    throw new Error('Cannot compensate a completed task');
  }

  // Load platform compensation policy
  let policy: CompensationPolicy = {
    fullRefundPercent: 100,
    serviceCreditAmount: 50,
    compensationPoints: 100,
    autoRefundUnassigned: true,
    searchTimeoutSeconds: 60,
    maxRadiusKm: 25,
  };

  try {
    const setting = db.prepare("SELECT value FROM platform_settings WHERE key = 'compensation_policy'").get() as any;
    if (setting && setting.value) {
      policy = JSON.parse(setting.value);
    }
  } catch (err) {
    console.error('Error loading compensation policy:', err);
  }

  const wallet = getOrCreateCustomerWallet(task.customer_id);

  const isPaid = task.payment_status === 'PAID_ESCROW';
  const refundAmount = isPaid ? Number((task.budget * (policy.fullRefundPercent / 100)).toFixed(2)) : 0;
  const serviceCreditAmount = policy.serviceCreditAmount;
  const compPoints = policy.compensationPoints;

  const txIdRefund = uuidv4();
  const txIdCredit = uuidv4();
  const txIdCompPoints = uuidv4();
  const eventId = uuidv4();
  const notifId = uuidv4();

  const compensationTx = db.transaction(() => {
    // 1. Mark task status as UNSUCCESSFUL_REQUEST and payment status
    db.prepare(`
      UPDATE tasks 
      SET status = 'UNSUCCESSFUL_REQUEST',
          payment_status = CASE WHEN payment_status = 'PAID_ESCROW' THEN 'REFUNDED' ELSE payment_status END,
          compensation_status = 'COMPENSATED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);

    // 2. Credit wallet balances (distinct columns: refund, credit, comp points)
    db.prepare(`
      UPDATE customer_wallets 
      SET refund_balance = refund_balance + ?,
          service_credits = service_credits + ?,
          compensation_points = compensation_points + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = ?
    `).run(refundAmount, serviceCreditAmount, compPoints, task.customer_id);

    // 3. Log distinct ledger records
    if (refundAmount > 0) {
      db.prepare(`
        INSERT INTO wallet_transactions (id, customer_id, type, amount, description, task_id, created_at)
        VALUES (?, ?, 'REFUND', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(txIdRefund, task.customer_id, refundAmount, `Full refund for unassigned task: "${task.title}"`, taskId);
    }

    if (serviceCreditAmount > 0) {
      db.prepare(`
        INSERT INTO wallet_transactions (id, customer_id, type, amount, description, task_id, created_at)
        VALUES (?, ?, 'SERVICE_CREDIT', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(txIdCredit, task.customer_id, serviceCreditAmount, `Inconvenience service credit for unassigned task: "${task.title}"`, taskId);
    }

    if (compPoints > 0) {
      db.prepare(`
        INSERT INTO wallet_transactions (id, customer_id, type, amount, description, task_id, created_at)
        VALUES (?, ?, 'COMPENSATION_POINTS', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(txIdCompPoints, task.customer_id, compPoints, `Platform compensation points for service delay: "${task.title}"`, taskId);
    }

    // 4. Log lifecycle event
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, metadata, created_at)
      VALUES (?, ?, ?, 'STATUS_CHANGED', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      eventId,
      taskId,
      null,
      `Task marked as Unsuccessful Service Request. Compensation package issued to customer wallet.`,
      JSON.stringify({
        refundAmount,
        serviceCreditAmount,
        compPoints,
        reason,
      })
    );

    // 5. In-app notification
    const msg = isPaid
      ? `We could not find an available agent for "${task.title}". ₹${refundAmount} has been refunded to your wallet, plus ₹${serviceCreditAmount} courtesy credit & ${compPoints} compensation points added.`
      : `We could not find an available agent for "${task.title}". ₹${serviceCreditAmount} courtesy service credit and ${compPoints} compensation points have been added to your wallet.`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
      VALUES (?, ?, ?, 'STATUS_UPDATE', 'Unsuccessful Service Request Compensation', ?, CURRENT_TIMESTAMP)
    `).run(notifId, task.customer_id, taskId, msg);
  });

  compensationTx();

  const explanation = isPaid
    ? `Task marked Unsuccessful Service Request. Full refund of ₹${refundAmount} credited, alongside ₹${serviceCreditAmount} service credit and ${compPoints} compensation points.`
    : `Task marked Unsuccessful Service Request. ₹${serviceCreditAmount} courtesy credit and ${compPoints} compensation points credited.`;

  return {
    success: true,
    refundIssued: refundAmount,
    serviceCreditIssued: serviceCreditAmount,
    compensationPointsIssued: compPoints,
    explanation,
  };
}
