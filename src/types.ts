export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  rating: number;
  reliability_score: number;
  is_available: boolean;
  latitude: number;
  longitude: number;
  address?: string;
  active_task_count: number;
  total_completed_tasks: number;
  is_identity_verified?: boolean;
  is_phone_verified?: boolean;
  vehicle_type?: string;
  completion_rate?: number;
  response_rate?: number;
  verification_status?: VerificationStatus;
  verification_score?: number;
  verification_notes?: string;
  skills?: string[];
  experience_years?: number;
  max_concurrent_tasks?: number;
  suspicious_flag?: number;
  created_at: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskCategory = 
  | 'delivery'
  | 'shopping'
  | 'documents'
  | 'errand'
  | 'repair'
  | 'cleaning'
  | 'home_help'
  | 'digital'
  | 'grocery'
  | 'other';

export type TaskStatus =
  | 'POSTED'
  | 'MATCHING'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REASSIGNING'
  | 'NO_AGENT_AVAILABLE'
  | 'UNSUCCESSFUL_REQUEST';

export interface Task {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  title: string;
  description: string;
  category: TaskCategory;
  pickup_location: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_location?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  budget: number;
  priority: TaskPriority;
  preferred_time?: string;
  status: TaskStatus;
  assigned_agent_id?: string;
  assigned_agent?: Profile;
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  agent_rating?: number;
  agent_avatar?: string;
  agent_lat?: number;
  agent_lng?: number;
  agent_live_lat?: number;
  agent_live_lng?: number;
  agent_location_at?: string;
  proof_of_completion_url?: string;
  completion_notes?: string;
  special_instructions?: string;
  photos?: string[];
  payment_status?: 'UNPAID' | 'PAID_ESCROW' | 'RELEASED' | 'REFUNDED';
  estimated_arrival_minutes?: number;
  estimated_completion_minutes?: number;
  ai_matching_explanation?: string;
  compensation_status?: 'NONE' | 'PENDING' | 'COMPENSATED';
  batch_id?: string;
  search_radius_km?: number;
  created_at: string;
  updated_at: string;
}

export type AssignmentStatus = 
  | 'OFFERED' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'CANCELLED' 
  | 'CANCELLED_BY_AGENT';

export interface ScoreBreakdown {
  distanceScore: number;
  ratingScore: number;
  reliabilityScore: number;
  workloadScore: number;
  responseScore: number;
  distanceKm: number;
  skillScore?: number;
  availabilityScore?: number;
  customerPriorityScore?: number;
  compatibilityScore?: number;
  estimatedTravelMinutes?: number;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  agent_id: string;
  agent_name?: string;
  agent_email?: string;
  agent_rating?: number;
  agent_phone?: string;
  agent_avatar?: string;
  status: AssignmentStatus;
  distance_km: number;
  suitability_score: number;
  score_breakdown?: ScoreBreakdown;
  explanation?: string;
  offered_at: string;
  responded_at?: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  event_type: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id?: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  task_id: string;
  customer_id: string;
  customer_name?: string;
  agent_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface AdminStats {
  totalCustomers: number;
  totalAgents: number;
  activeAgents: number;
  activeTasks: number;
  matchingTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  totalTaskValue: number;
  avgCompletionTimeMinutes: number;
}

export interface Report {
  id: string;
  task_id: string;
  reporter_id: string;
  reporter_role: string;
  category: string;
  description: string;
  status: 'PENDING' | 'RESOLVED';
  created_at: string;
}

export interface LiveLocationUpdate {
  agentId: string;
  latitude: number;
  longitude: number;
  taskId?: string;
  address?: string;
  timestamp: number;
}

export interface CustomerWallet {
  customer_id: string;
  refund_balance: number;
  service_credits: number;
  compensation_points: number;
  reward_points: number;
  priority_tier: 'New Customer' | 'Regular Customer' | 'Priority Customer' | 'Trusted Customer';
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  customer_id: string;
  type: 'REFUND' | 'SERVICE_CREDIT' | 'COMPENSATION_POINTS' | 'REWARD_POINTS';
  amount: number;
  description: string;
  task_id?: string;
  created_at: string;
}

export interface AgentVerification {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_email?: string;
  agent_phone?: string;
  agent_rating?: number;
  agent_avatar?: string;
  experience_years?: number;
  skills?: string[];
  status: VerificationStatus;
  ai_score: number;
  ai_summary?: string;
  breakdown?: Record<string, any>;
  reviewed_by?: string;
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
}

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

export interface FraudAlert {
  id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  user_email?: string;
  task_id?: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: string;
  status: 'PENDING_REVIEW' | 'DISMISSED' | 'ACTION_TAKEN';
  created_at: string;
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

export interface OptimizedRoute {
  tasks: Task[];
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  stops: {
    order: number;
    label: string;
    type: 'PICKUP' | 'DESTINATION';
    lat: number;
    lng: number;
    taskId: string;
  }[];
}

export interface CustomerRecommendation {
  recommendedCategories: { id: string; name: string; reason: string; count: number }[];
  suggestedBookingTimes: string[];
  topNearbyAgents: {
    id: string;
    name: string;
    rating: number;
    skills: string[];
    distanceKm: number;
    avatar_url?: string;
  }[];
}
