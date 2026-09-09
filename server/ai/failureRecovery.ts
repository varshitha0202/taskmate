import { db } from '../db.js';
import { handleUnsuccessfulServiceRequest } from './pointsAndWallet.js';
import { broadcastEvent } from '../websocket.js';
import { v4 as uuidv4 } from 'uuid';

export interface RecoverySuggestion {
  expandedRadiusKm?: number;
  alternativeTimes: string[];
  alternativeCategories: string[];
  availableNearbyAgentsCount: number;
}

/**
 * Handles AI failure recovery when an initial dispatch attempt fails
 * Step 1: Expand search radius from 15km to 25km
 * Step 2: If still no agent or attempt >= 2, transition to UNSUCCESSFUL_REQUEST and issue compensation
 */
export function handleTaskFailureRecovery(taskId: string): {
  action: 'EXPAND_RADIUS' | 'UNSUCCESSFUL_COMPENSATION';
  message: string;
  suggestions?: RecoverySuggestion;
} {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    throw new Error('Task not found');
  }

  const currentRadius = task.search_radius_km || 15.0;
  const attempts = task.search_attempts || 1;

  // Step 1: Expand search radius if not yet expanded
  if (currentRadius < 25.0 && attempts < 2) {
    const newRadius = 25.0;
    db.prepare(`
      UPDATE tasks 
      SET search_radius_km = ?, search_attempts = search_attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newRadius, taskId);

    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, metadata, created_at)
      VALUES (?, ?, ?, 'STATUS_CHANGED', 'AI expanded search radius to 25 km to locate available verified agents.', ?, CURRENT_TIMESTAMP)
    `).run(eventId, taskId, null, JSON.stringify({ expandedRadiusKm: newRadius }));

    broadcastEvent({
      type: 'TASK_UPDATED',
      payload: { taskId, status: task.status, search_radius_km: newRadius },
    });

    return {
      action: 'EXPAND_RADIUS',
      message: `Search radius automatically expanded to ${newRadius} km. Scanning extended area...`,
    };
  }

  // Step 2: Final failure -> Trigger Unsuccessful Service Request & Compensation
  const compResult = handleUnsuccessfulServiceRequest({
    taskId,
    reason: `Exhausted ${attempts} matching passes within 25 km radius with all agents occupied.`,
  });

  broadcastEvent({
    type: 'TASK_UPDATED',
    payload: {
      taskId,
      status: 'UNSUCCESSFUL_REQUEST',
      compensation: compResult,
    },
  });

  const suggestions: RecoverySuggestion = {
    alternativeTimes: [
      'In 30 mins (peak travel dip)',
      'In 1 hour (after active agent completions)',
      'Tomorrow morning 9:00 AM',
    ],
    alternativeCategories: [
      task.category === 'documents' ? 'delivery' : 'errand',
      'shopping',
    ],
    availableNearbyAgentsCount: 0,
  };

  return {
    action: 'UNSUCCESSFUL_COMPENSATION',
    message: compResult.explanation,
    suggestions,
  };
}

/**
 * 1-Click AI Smart Rebooking
 * Takes an unsuccessful task and creates a renewed request with AI recommended timing / category
 */
export function executeSmartRebooking(params: {
  originalTaskId: string;
  customerId: string;
  preferredTime?: string;
  category?: string;
}): { newTaskId: string; message: string } {
  const { originalTaskId, customerId, preferredTime, category } = params;
  const original = db.prepare('SELECT * FROM tasks WHERE id = ?').get(originalTaskId) as any;

  if (!original) {
    throw new Error('Original task not found');
  }

  const newTaskId = uuidv4();
  const eventId = uuidv4();

  db.prepare(`
    INSERT INTO tasks (
      id, customer_id, title, description, category, pickup_location,
      pickup_latitude, pickup_longitude, destination_location, destination_latitude,
      destination_longitude, budget, priority, preferred_time, status, payment_status,
      search_radius_km, search_attempts
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HIGH', ?, 'MATCHING', 'PAID_ESCROW', 15.0, 1
    )
  `).run(
    newTaskId,
    customerId,
    `${original.title} (Rebooked)`,
    original.description,
    category || original.category,
    original.pickup_location,
    original.pickup_latitude,
    original.pickup_longitude,
    original.destination_location,
    original.destination_latitude,
    original.destination_longitude,
    original.budget,
    preferredTime || 'Immediate AI Priority Rebooking'
  );

  db.prepare(`
    INSERT INTO task_events (id, task_id, actor_id, event_type, description, metadata, created_at)
    VALUES (?, ?, ?, 'CREATED', 'AI Smart Rebooking initiated from previous unassigned task.', ?, CURRENT_TIMESTAMP)
  `).run(eventId, newTaskId, customerId, JSON.stringify({ rebookedFrom: originalTaskId }));

  return {
    newTaskId,
    message: 'Task rebooked with High Priority queue status.',
  };
}
