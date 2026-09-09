/**
 * AI-Assisted ETA and Arrival Predictor
 * Computes realistic travel time and overall task completion duration
 */

const CATEGORY_HANDLING_TIMES: Record<string, number> = {
  documents: 15,
  delivery: 20,
  shopping: 25,
  grocery: 25,
  errand: 25,
  repair: 45,
  home_help: 55,
  digital: 30,
  other: 25,
};

export function getTrafficFactor(): { factor: number; condition: string } {
  const hour = new Date().getHours();
  // Peak traffic morning 8-10 AM or evening 5-8 PM
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    return { factor: 1.35, condition: 'Moderate to Heavy Peak Traffic' };
  } else if (hour >= 22 || hour <= 6) {
    return { factor: 0.90, condition: 'Clear Night Conditions' };
  }
  return { factor: 1.10, condition: 'Normal City Traffic' };
}

export function predictArrivalAndCompletion(params: {
  distanceKm: number;
  category: string;
  activeTaskCount?: number;
  agentVehicle?: string;
}): {
  arrivalMinutes: number;
  completionMinutes: number;
  trafficCondition: string;
  explanation: string;
} {
  const { distanceKm, category, activeTaskCount = 0, agentVehicle = 'Motorcycle' } = params;
  const { factor: trafficFactor, condition: trafficCondition } = getTrafficFactor();

  // Baseline vehicle travel speed: 25 km/h for bike, 20 km/h for car/van
  const avgSpeedKmh = agentVehicle.toLowerCase().includes('motorcycle') ? 26 : 21;
  const rawTravelMinutes = (distanceKm / avgSpeedKmh) * 60;
  
  // Apply traffic & buffer
  const arrivalMinutes = Math.max(3, Math.round(rawTravelMinutes * trafficFactor + 2));

  // Category handling time + active task queuing delay
  const baseHandlingTime = CATEGORY_HANDLING_TIMES[category.toLowerCase()] || 25;
  const workloadDelay = activeTaskCount * 12; // 12 mins per queued task
  const completionMinutes = Math.max(arrivalMinutes + 10, Math.round(arrivalMinutes + baseHandlingTime + workloadDelay));

  const explanation = `Estimated arrival ~${arrivalMinutes} mins (${distanceKm} km via ${agentVehicle} in ${trafficCondition}). Estimated completion ~${completionMinutes} mins based on ${category} complexity${activeTaskCount > 0 ? ` and ${activeTaskCount} active mission(s)` : ''}.`;

  return {
    arrivalMinutes,
    completionMinutes,
    trafficCondition,
    explanation,
  };
}
