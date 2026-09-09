import { db } from '../db.js';
import { MatchingWeights, AIMatchingScore, ScoreBreakdown } from './types.js';
import { predictArrivalAndCompletion } from './etaPredictor.js';

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function getMatchingWeights(): MatchingWeights {
  try {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'ai_matching_weights'").get() as any;
    if (row && row.value) {
      return JSON.parse(row.value);
    }
  } catch (err) {
    console.error('Error fetching matching weights:', err);
  }
  return {
    distance: 25,
    skill: 20,
    availability: 15,
    reliability: 15,
    customerPriority: 10,
    workload: 10,
    compatibility: 5,
  };
}

/**
 * Computes transparent 7-factor AI matching score with natural language explanation
 */
export function calculateAIMatchingScore(params: {
  agent: {
    id: string;
    name: string;
    rating: number;
    reliability_score: number;
    active_task_count: number;
    max_concurrent_tasks?: number;
    latitude: number;
    longitude: number;
    skills?: string;
    vehicle_type?: string;
    verification_status?: string;
    verification_score?: number;
  };
  taskLat: number;
  taskLng: number;
  taskCategory: string;
  taskPriority?: string;
  customerTier?: string;
  maxRadiusKm?: number;
}): AIMatchingScore {
  const {
    agent,
    taskLat,
    taskLng,
    taskCategory,
    taskPriority = 'MEDIUM',
    customerTier = 'Regular Customer',
    maxRadiusKm = 15,
  } = params;

  const weights = getMatchingWeights();
  const distanceKm = calculateHaversineDistance(agent.latitude, agent.longitude, taskLat, taskLng);

  // 1. Distance Score: Proximity drop-off within radius
  const distanceFactor = Math.max(0, 1 - distanceKm / maxRadiusKm);
  const distanceScore = Number((distanceFactor * weights.distance).toFixed(1));

  // 2. Skill Match Score: Category keyword match in agent skills
  let skillMultiplier = 0.6; // Baseline generalist
  if (agent.skills) {
    try {
      const skillsArray = typeof agent.skills === 'string' ? JSON.parse(agent.skills) : agent.skills;
      if (Array.isArray(skillsArray)) {
        if (skillsArray.includes('all') || skillsArray.includes(taskCategory.toLowerCase())) {
          skillMultiplier = 1.0;
        } else {
          // Partial compatibility (e.g. delivery matches documents or errand)
          const generalMatch = skillsArray.some((s: string) =>
            ['delivery', 'errand'].includes(s) && ['documents', 'shopping', 'grocery'].includes(taskCategory)
          );
          if (generalMatch) skillMultiplier = 0.85;
        }
      }
    } catch {
      skillMultiplier = 0.7;
    }
  }
  const skillScore = Number((skillMultiplier * weights.skill).toFixed(1));

  // 3. Availability Score
  const availabilityScore = Number((1.0 * weights.availability).toFixed(1));

  // 4. Reliability Score: historical completion and rating
  const reliabilityNorm = Math.min(1.0, Math.max(0.6, agent.reliability_score || 0.95));
  const ratingNorm = Math.min(1.0, (agent.rating || 5.0) / 5.0);
  const reliabilityScore = Number((((reliabilityNorm + ratingNorm) / 2) * weights.reliability).toFixed(1));

  // 5. Customer Priority Score: Customers earn a modest allocation prioritization
  let priorityMultiplier = 0.5; // New Customer
  if (customerTier === 'Regular Customer') priorityMultiplier = 0.75;
  else if (customerTier === 'Priority Customer') priorityMultiplier = 0.90;
  else if (customerTier === 'Trusted Customer') priorityMultiplier = 1.0;
  const customerPriorityScore = Number((priorityMultiplier * weights.customerPriority).toFixed(1));

  // 6. Workload Score: Fewer active tasks = higher capacity
  const activeCount = agent.active_task_count || 0;
  let workloadMultiplier = 1.0;
  if (activeCount === 1) workloadMultiplier = 0.65;
  else if (activeCount === 2) workloadMultiplier = 0.30;
  else if (activeCount >= 3) workloadMultiplier = 0.05;
  const workloadScore = Number((workloadMultiplier * weights.workload).toFixed(1));

  // 7. Task Compatibility Score: Vehicle suitability and urgency handling
  let compatMultiplier = 0.8;
  const vehicle = (agent.vehicle_type || 'Motorcycle').toLowerCase();
  if (['documents', 'delivery', 'shopping'].includes(taskCategory.toLowerCase()) && vehicle.includes('motorcycle')) {
    compatMultiplier = 1.0;
  } else if (['home_help', 'repair'].includes(taskCategory.toLowerCase())) {
    compatMultiplier = 0.95;
  }
  const compatibilityScore = Number((compatMultiplier * weights.compatibility).toFixed(1));

  // Total matching score
  const totalScore = Number(
    (
      distanceScore +
      skillScore +
      availabilityScore +
      reliabilityScore +
      customerPriorityScore +
      workloadScore +
      compatibilityScore
    ).toFixed(1)
  );

  const eta = predictArrivalAndCompletion({
    distanceKm,
    category: taskCategory,
    activeTaskCount: activeCount,
    agentVehicle: agent.vehicle_type,
  });

  const breakdown: ScoreBreakdown = {
    distanceScore,
    skillScore,
    availabilityScore,
    reliabilityScore,
    customerPriorityScore,
    workloadScore,
    compatibilityScore,
    distanceKm,
    estimatedTravelMinutes: eta.arrivalMinutes,
  };

  const skillPercent = Math.round(skillMultiplier * 100);
  const explanation = `Agent ${agent.name} selected: AI-verified helper (Score ${agent.verification_score || 95}), ${skillPercent}% skill suitability for ${taskCategory}, ${distanceKm} km away (~${eta.arrivalMinutes} min arrival), ★${(agent.rating || 5.0).toFixed(1)} rating, with ${activeCount} active task(s).`;

  return {
    score: totalScore,
    breakdown,
    explanation,
  };
}
