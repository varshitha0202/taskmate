import { Task, Profile, TaskAssignment, TaskEvent, Notification, AdminStats } from '../types';

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const API_BASE = configuredApiBase ? `${configuredApiBase}/api` : (browserOrigin ? `${browserOrigin}/api` : '/api');

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('taskmate_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: Profile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(data: any): Promise<{ token: string; user: Profile }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<{ user: Profile }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async updateProfile(updates: Partial<Profile>): Promise<{ user: Profile }> {
    const res = await fetch(`${API_BASE}/profiles/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  async getAgents(): Promise<{ agents: Profile[] }> {
    const res = await fetch(`${API_BASE}/profiles/agents`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Live Location & Simulation
  async updateAgentLocation(
    latitude: number,
    longitude: number,
    address?: string,
    taskId?: string
  ): Promise<{ success: boolean; latitude: number; longitude: number }> {
    const res = await fetch(`${API_BASE}/agent/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ latitude, longitude, address, taskId }),
    });
    return handleResponse(res);
  },

  async simulateLocationStep(
    taskId: string,
    stepPercent: number = 0.20
  ): Promise<{ success: boolean; latitude: number; longitude: number; remainingDistanceKm: number }> {
    const res = await fetch(`${API_BASE}/agent/simulate-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ taskId, stepPercent }),
    });
    return handleResponse(res);
  },

  // Tasks
  async createTask(taskData: any): Promise<{ task: Task; allocation: any }> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(taskData),
    });
    return handleResponse(res);
  },

  async getTasks(filters?: { category?: string; status?: string }): Promise<{ tasks: Task[] }> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE}/tasks${query}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getTaskById(taskId: string): Promise<{
    task: Task;
    assignments: TaskAssignment[];
    events: TaskEvent[];
    review?: any;
  }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async cancelTask(taskId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Agent Actions
  async getActiveOffer(): Promise<{ offer: (TaskAssignment & { title: string; description: string; budget: number; category: string; pickup_location: string; customer_name: string; customer_rating?: number }) | null }> {
    const res = await fetch(`${API_BASE}/agent/active-offer`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async acceptTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/accept`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async rejectTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // MANDATORY: Agent cancels task AFTER acceptance -> Triggers immediate auto-reassignment
  async cancelAcceptedTask(taskId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/agent-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  async updateTaskStatus(
    taskId: string,
    status: 'IN_PROGRESS' | 'COMPLETED',
    data?: { proof_of_completion_url?: string; completion_notes?: string }
  ): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status, ...data }),
    });
    return handleResponse(res);
  },

  // Customer Actions
  async confirmTaskCompletion(taskId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/confirm`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async submitReview(taskId: string, rating: number, comment: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ rating, comment }),
    });
    return handleResponse(res);
  },

  // Trust & Safety: Dispute / Report
  async submitReport(taskId: string, category: string, description: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ category, description }),
    });
    return handleResponse(res);
  },

  // Admin
  async getAdminStats(): Promise<{ stats: AdminStats }> {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/reset`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: Notification[] }> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // ---------------------------------------------------------
  // AI PLATFORM EXTENSIONS
  // ---------------------------------------------------------

  // Customer Wallet & Compensation
  async getWallet(): Promise<{ wallet: any; transactions: any[] }> {
    const res = await fetch(`${API_BASE}/wallet/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Agent AI Verification
  async evaluateAgentVerification(): Promise<{ assessment: any }> {
    const res = await fetch(`${API_BASE}/agent/verification/evaluate`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAdminVerifications(): Promise<{ verifications: any[] }> {
    const res = await fetch(`${API_BASE}/admin/verifications`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async reviewAgentVerification(agentId: string, status: string, notes?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/verifications/${agentId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ agentId, status, notes }),
    });
    return handleResponse(res);
  },

  // AI Matching Configuration
  async getMatchingWeights(): Promise<{ weights: any }> {
    const res = await fetch(`${API_BASE}/admin/ai-weights`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async updateMatchingWeights(weights: any): Promise<{ success: boolean; weights: any }> {
    const res = await fetch(`${API_BASE}/admin/ai-weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(weights),
    });
    return handleResponse(res);
  },

  // Compensation Policy
  async getCompensationPolicy(): Promise<{ policy: any }> {
    const res = await fetch(`${API_BASE}/admin/compensation-policy`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async updateCompensationPolicy(policy: any): Promise<{ success: boolean; policy: any }> {
    const res = await fetch(`${API_BASE}/admin/compensation-policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(policy),
    });
    return handleResponse(res);
  },

  // AI Fraud Radar
  async getFraudAlerts(): Promise<{ alerts: any[] }> {
    const res = await fetch(`${API_BASE}/admin/fraud-alerts`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async resolveFraudAlert(alertId: string, action: 'DISMISS' | 'CONFIRM_SUSPEND', notes?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/fraud-alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ action, notes }),
    });
    return handleResponse(res);
  },

  // AI Chat Assistants
  async queryCustomerAssistant(query: string): Promise<{ reply: string; suggestedActions?: any[] }> {
    const res = await fetch(`${API_BASE}/ai/customer-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ query }),
    });
    return handleResponse(res);
  },

  async queryAgentAssistant(query: string): Promise<{ reply: string; suggestedActions?: any[] }> {
    const res = await fetch(`${API_BASE}/ai/agent-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ query }),
    });
    return handleResponse(res);
  },

  // AI Recommendations
  async getCustomerRecommendations(): Promise<{ recommendations: any }> {
    const res = await fetch(`${API_BASE}/ai/recommendations`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Multi-Task & Route Optimization
  async getMultiTaskOpportunities(): Promise<{ bundles: any[] }> {
    const res = await fetch(`${API_BASE}/agent/multi-task-opportunities`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getOptimizedRoute(): Promise<{ route: any }> {
    const res = await fetch(`${API_BASE}/agent/optimized-route`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async acceptBundledTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/bundle-accept`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // 1-Click AI Smart Rebooking
  async smartRebookTask(taskId: string, preferredTime?: string, category?: string): Promise<{ newTaskId: string; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/rebook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ preferredTime, category }),
    });
    return handleResponse(res);
  },
};
