import { db } from '../db.js';
import { calculateHaversineDistance } from './smartMatching.js';
import { MultiTaskBundle } from './types.js';

/**
 * Checks if two task categories are compatible for simultaneous fulfillment
 */
export function areCategoriesCompatible(cat1: string, cat2: string): boolean {
  const lightErrands = ['documents', 'delivery', 'errand', 'shopping', 'grocery'];
  if (lightErrands.includes(cat1.toLowerCase()) && lightErrands.includes(cat2.toLowerCase())) {
    return true;
  }
  // Dedicated repair or home help should not be overloaded
  return false;
}

/**
 * Scans available tasks in the pool for intelligent multi-task bundling
 */
export function findMultiTaskOpportunities(agentId: string): MultiTaskBundle[] {
  const agent = db.prepare('SELECT * FROM profiles WHERE id = ?').get(agentId) as any;
  if (!agent || !agent.is_available) return [];

  const maxCapacity = agent.max_concurrent_tasks || 3;
  const currentActive = agent.active_task_count || 0;
  if (currentActive >= maxCapacity) return [];

  // Find tasks assigned to this agent currently
  const currentTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE assigned_agent_id = ? AND status IN ('ACCEPTED', 'IN_PROGRESS')
  `).all(agentId) as any[];

  if (currentTasks.length === 0) return [];
  const primaryTask = currentTasks[0];

  // Find unassigned tasks in pool that are nearby and compatible
  const unassignedTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE status IN ('POSTED', 'MATCHING', 'REASSIGNING') AND id != ?
  `).all(primaryTask.id) as any[];

  const bundles: MultiTaskBundle[] = [];

  for (const candidate of unassignedTasks) {
    if (!areCategoriesCompatible(primaryTask.category, candidate.category)) {
      continue;
    }

    const distBetweenPickups = calculateHaversineDistance(
      primaryTask.pickup_latitude,
      primaryTask.pickup_longitude,
      candidate.pickup_latitude,
      candidate.pickup_longitude
    );

    // Only bundle if candidate pickup is within 3.5 km of primary pickup
    if (distBetweenPickups <= 3.5) {
      const extraMinutes = Math.max(10, Math.round(distBetweenPickups * 3.5 + 8));
      
      const routeOrder = [
        `1. Stop at ${primaryTask.pickup_location.split(',')[0]} (Primary Pickup)`,
        `2. Stop at ${candidate.pickup_location.split(',')[0]} (Adjacent Pickup - ${distBetweenPickups} km away)`,
        `3. Deliver ${primaryTask.title.slice(0, 20)}...`,
        `4. Deliver ${candidate.title.slice(0, 20)}...`,
      ];

      bundles.push({
        primaryTaskId: primaryTask.id,
        suggestedTaskId: candidate.id,
        suggestedTaskTitle: candidate.title,
        suggestedTaskCategory: candidate.category,
        pickupLocation: candidate.pickup_location,
        additionalReward: candidate.budget,
        additionalDistanceKm: distBetweenPickups,
        estimatedExtraMinutes: extraMinutes,
        routeOrder,
        explanation: `Combine with your active task: adds only ${distBetweenPickups} km and ~${extraMinutes} mins for an extra ₹${candidate.budget}.`,
      });
    }
  }

  return bundles;
}

/**
 * Optimizes ordered route for an agent's assigned tasks
 */
export function getOptimizedAgentRoute(agentId: string): {
  tasks: any[];
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  stops: { order: number; label: string; type: 'PICKUP' | 'DESTINATION'; lat: number; lng: number; taskId: string }[];
} {
  const agent = db.prepare('SELECT latitude, longitude FROM profiles WHERE id = ?').get(agentId) as any;
  const tasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE assigned_agent_id = ? AND status IN ('ACCEPTED', 'IN_PROGRESS')
    ORDER BY created_at ASC
  `).all(agentId) as any[];

  if (tasks.length === 0) {
    return {
      tasks: [],
      totalDistanceKm: 0,
      totalEstimatedMinutes: 0,
      stops: [],
    };
  }

  let currentLat = agent ? agent.latitude : tasks[0].pickup_latitude;
  let currentLng = agent ? agent.longitude : tasks[0].pickup_longitude;
  let totalDist = 0;
  const stops: { order: number; label: string; type: 'PICKUP' | 'DESTINATION'; lat: number; lng: number; taskId: string }[] = [];

  let stopOrder = 1;
  // Sequence all pickups first, then destinations
  for (const t of tasks) {
    const dist = calculateHaversineDistance(currentLat, currentLng, t.pickup_latitude, t.pickup_longitude);
    totalDist += dist;
    currentLat = t.pickup_latitude;
    currentLng = t.pickup_longitude;

    stops.push({
      order: stopOrder++,
      label: `Pickup: ${t.pickup_location}`,
      type: 'PICKUP',
      lat: t.pickup_latitude,
      lng: t.pickup_longitude,
      taskId: t.id,
    });
  }

  for (const t of tasks) {
    if (t.destination_latitude && t.destination_longitude) {
      const dist = calculateHaversineDistance(currentLat, currentLng, t.destination_latitude, t.destination_longitude);
      totalDist += dist;
      currentLat = t.destination_latitude;
      currentLng = t.destination_longitude;

      stops.push({
        order: stopOrder++,
        label: `Deliver: ${t.destination_location || 'Destination'}`,
        type: 'DESTINATION',
        lat: t.destination_latitude,
        lng: t.destination_longitude,
        taskId: t.id,
      });
    }
  }

  const roundedDistance = Number(totalDist.toFixed(2));
  const estimatedMinutes = Math.round((roundedDistance / 24) * 60 + stops.length * 10);

  return {
    tasks,
    totalDistanceKm: roundedDistance,
    totalEstimatedMinutes: estimatedMinutes,
    stops,
  };
}
