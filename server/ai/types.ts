export interface MatchingWeights {
  distance: number;
  skill: number;
  availability: number;
  reliability: number;
  customerPriority: number;
  workload: number;
  compatibility: number;
}

export interface CompensationPolicy {
  fullRefundPercent: number;
  serviceCreditAmount: number;
  compensationPoints: number;
  autoRefundUnassigned: boolean;
  searchTimeoutSeconds: number;
  maxRadiusKm: number;
}

export interface CustomerTierThresholds {
  newCustomer: number;
  regularCustomer: number;
  priorityCustomer: number;
  trustedCustomer: number;
}

export interface ScoreBreakdown {
  distanceScore: number;
  skillScore: number;
  availabilityScore: number;
  reliabilityScore: number;
  customerPriorityScore: number;
  workloadScore: number;
  compatibilityScore: number;
  distanceKm: number;
  estimatedTravelMinutes: number;
}

export interface AIMatchingScore {
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string;
}

export interface AgentVerificationAssessment {
  score: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  recommendation: string;
  summary: string;
  breakdown: {
    profileCompleteness: number;
    identityVerified: boolean;
    phoneVerified: boolean;
    experienceScore: number;
    historicalRatingScore: number;
    historicalCompletionScore: number;
    fraudRiskScore: number;
  };
}

export interface MultiTaskBundle {
  primaryTaskId: string;
  suggestedTaskId: string;
  suggestedTaskTitle: string;
  suggestedTaskCategory: string;
  pickupLocation: string;
  additionalReward: number;
  additionalDistanceKm: number;
  estimatedExtraMinutes: number;
  routeOrder: string[];
  explanation: string;
}
