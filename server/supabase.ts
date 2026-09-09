import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isProduction = process.env.NODE_ENV === 'production';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (isProduction && (!supabaseUrl || !supabaseSecretKey)) {
  throw new Error('Production requires valid Supabase configuration: SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
}

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn('[Supabase] Missing server-side env vars. Falling back to the local SQLite backend only in local development.');
}

export const supabaseAdmin: SupabaseClient | null = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const hasSupabaseConfig = !!supabaseAdmin;

export function getSupabaseUserByEmail(email: string): any {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle() as any;
}

export function getSupabaseUserById(id: string): any {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle() as any;
}

export function upsertSupabaseUser(profile: any): any {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' }) as any;
}

export function listSupabaseAgents(): any {
  if (!supabaseAdmin) return null;
  return supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'AGENT')
    .order('rating', { ascending: false }) as any;
}

export function updateSupabaseProfile(id: string, payload: Record<string, any>): any {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('profiles').update(payload).eq('id', id).select('*').single() as any;
}

export function normalizeSupabaseProfile(user: any) {
  if (!user) return null;

  const { password_hash, passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    vehicle_type: safeUser.vehicle_type ?? 'Motorcycle',
    completion_rate: safeUser.completion_rate ?? 0.98,
    response_rate: safeUser.response_rate ?? 0.95,
  };
}

export async function createSupabaseTask(taskData: Record<string, any>): Promise<any> {
  if (!supabaseAdmin) return null;

  const payload = {
    id: taskData.id,
    customer_id: taskData.customer_id,
    title: taskData.title,
    description: taskData.description || '',
    category: taskData.category,
    pickup_location: taskData.pickup_location,
    pickup_latitude: taskData.pickup_latitude,
    pickup_longitude: taskData.pickup_longitude,
    destination_location: taskData.destination_location || null,
    destination_latitude: taskData.destination_latitude ?? null,
    destination_longitude: taskData.destination_longitude ?? null,
    budget: taskData.budget,
    priority: taskData.priority || 'MEDIUM',
    preferred_time: taskData.preferred_time || null,
    status: 'MATCHING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return supabaseAdmin.from('tasks').insert(payload).select('*').single();
}

export async function fetchSupabaseTasksForUser(userId: string, role: string, category?: string, status?: string): Promise<any> {
  if (!supabaseAdmin) return { data: [] as any[], error: null };

  let query: any = supabaseAdmin
    .from('tasks')
    .select(`*, customer:profiles!tasks_customer_id_fkey(name, phone), agent:profiles!tasks_assigned_agent_id_fkey(name, phone, rating, avatar_url, latitude, longitude)`) 
    .order('created_at', { ascending: false });

  if (role === 'CUSTOMER') {
    query = query.eq('customer_id', userId);
  } else if (role === 'AGENT') {
    query = query.or(`assigned_agent_id.eq.${userId},status.in.(POSTED,MATCHING,REASSIGNING)`);
  }

  if (category && category !== 'ALL') query = query.eq('category', category);
  if (status && status !== 'ALL') query = query.eq('status', status);

  return query;
}

export async function fetchSupabaseTaskById(taskId: string): Promise<any> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select(`*, customer:profiles!tasks_customer_id_fkey(name, phone, email), agent:profiles!tasks_assigned_agent_id_fkey(name, phone, rating, avatar_url, latitude, longitude)`) 
    .eq('id', taskId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function fetchSupabaseTaskRelations(taskId: string): Promise<any> {
  if (!supabaseAdmin) return { assignments: [], events: [], review: null };

  const [assignmentsRes, eventsRes, reviewRes] = await Promise.all([
    supabaseAdmin
      .from('task_assignments')
      .select(`*, agent:profiles!task_assignments_agent_id_fkey(name, email, rating, phone, avatar_url)`) 
      .eq('task_id', taskId)
      .order('offered_at', { ascending: true }),
    supabaseAdmin
      .from('task_events')
      .select(`*, actor:profiles!task_events_actor_id_fkey(name, role)`) 
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('reviews').select('*').eq('task_id', taskId).maybeSingle(),
  ]);

  return {
    assignments: assignmentsRes.data || [],
    events: eventsRes.data || [],
    review: reviewRes.data || null,
  };
}

export async function getSupabaseActiveOffer(agentId: string): Promise<any> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('task_assignments')
    .select(`*, task:tasks!task_assignments_task_id_fkey(title, description, category, pickup_location, pickup_latitude, pickup_longitude, destination_location, budget, priority, preferred_time, customer:profiles!tasks_customer_id_fkey(name, rating))`) 
    .eq('agent_id', agentId)
    .eq('status', 'OFFERED')
    .order('offered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function insertSupabaseTaskEvent(taskId: string, actorId: string | null, eventType: string, description: string, metadata?: Record<string, any>): Promise<any> {
  if (!supabaseAdmin) return null;
  const payload: any = {
    task_id: taskId,
    actor_id: actorId,
    event_type: eventType,
    description,
    created_at: new Date().toISOString(),
  };
  if (metadata) payload.metadata = metadata;
  return supabaseAdmin.from('task_events').insert(payload).select('*').single();
}

export async function insertSupabaseNotification(userId: string, taskId: string | null, type: string, title: string, message: string): Promise<any> {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('notifications').insert({
    user_id: userId,
    task_id: taskId,
    type,
    title,
    message,
    created_at: new Date().toISOString(),
  }).select('*').single();
}

export async function upsertSupabaseReview(taskId: string, customerId: string, agentId: string, rating: number, comment: string): Promise<any> {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('reviews').upsert({
    task_id: taskId,
    customer_id: customerId,
    agent_id: agentId,
    rating,
    comment: comment || '',
    created_at: new Date().toISOString(),
  }, { onConflict: 'task_id' }).select('*').single();
}

export async function getSupabaseAgentAverageRating(agentId: string): Promise<any> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from('reviews').select('rating').eq('agent_id', agentId);
  if (error || !data || !data.length) return null;
  const avg = data.reduce((sum, item) => sum + Number(item.rating), 0) / data.length;
  return Number(avg.toFixed(2));
}

export async function updateSupabaseTaskStatus(taskId: string, update: Record<string, any>): Promise<any> {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('tasks').update({ ...update, updated_at: new Date().toISOString() }).eq('id', taskId).select('*').single();
}

export async function createSupabaseAssignment(taskId: string, agentId: string, distanceKm: number, suitabilityScore: number, breakdown: Record<string, any>, explanation?: string, etaArrival?: number, etaCompletion?: number): Promise<any> {
  if (!supabaseAdmin) return null;

  const payload: any = {
    task_id: taskId,
    agent_id: agentId,
    status: 'OFFERED',
    distance_km: distanceKm,
    suitability_score: suitabilityScore,
    score_breakdown: breakdown,
    offered_at: new Date().toISOString(),
  };

  const { data: assignment, error } = await supabaseAdmin.from('task_assignments').insert(payload).select('*').single();
  if (error) throw error;

  const taskUpdate: Record<string, any> = {
    status: 'OFFERED',
  };
  if (typeof explanation !== 'undefined') taskUpdate.ai_matching_explanation = explanation;
  if (typeof etaArrival !== 'undefined') taskUpdate.estimated_arrival_minutes = etaArrival;
  if (typeof etaCompletion !== 'undefined') taskUpdate.estimated_completion_minutes = etaCompletion;

  const { data: task } = await supabaseAdmin.from('tasks').update(taskUpdate).eq('id', taskId).select('*').single();
  return { assignment, task };
}

export async function updateSupabaseAssignmentStatus(taskId: string, agentId: string, status: string): Promise<any> {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('task_assignments').update({ status, responded_at: new Date().toISOString() }).eq('task_id', taskId).eq('agent_id', agentId).select('*');
}

export async function setSupabaseTaskAssignment(taskId: string, agentId: string): Promise<any> {
  if (!supabaseAdmin) return null;
  return supabaseAdmin.from('tasks').update({ status: 'ACCEPTED', assigned_agent_id: agentId, updated_at: new Date().toISOString() }).eq('id', taskId).select('*').single();
}

export async function fetchSupabaseTaskStatus(taskId: string): Promise<any> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from('tasks').select('status, assigned_agent_id, customer_id, title').eq('id', taskId).maybeSingle();
  if (error) return null;
  return data;
}
