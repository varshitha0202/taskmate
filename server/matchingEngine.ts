import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from './websocket.js';
import { hasSupabaseConfig, supabaseAdmin } from './supabase.js';
import { calculateAIMatchingScore, calculateHaversineDistance } from './ai/smartMatching.js';
import { handleTaskFailureRecovery } from './ai/failureRecovery.js';
import { predictArrivalAndCompletion } from './ai/etaPredictor.js';

export { calculateHaversineDistance };

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

/**
 * Calculates suitability score based on weighted factors
 */
export function calculateSuitabilityScore(
  agent: {
    id?: string;
    name?: string;
    rating: number;
    reliability_score: number;
    active_task_count: number;
    latitude: number;
    longitude: number;
    skills?: string;
    vehicle_type?: string;
    verification_status?: string;
    verification_score?: number;
  },
  taskLat: number,
  taskLng: number,
  category: string = 'documents'
): { score: number; breakdown: ScoreBreakdown; explanation?: string } {
  const aiScore = calculateAIMatchingScore({
    agent: {
      id: agent.id || 'agent',
      name: agent.name || 'Agent',
      rating: agent.rating,
      reliability_score: agent.reliability_score,
      active_task_count: agent.active_task_count,
      latitude: agent.latitude,
      longitude: agent.longitude,
      skills: agent.skills,
      vehicle_type: agent.vehicle_type,
      verification_status: agent.verification_status,
      verification_score: agent.verification_score,
    },
    taskLat,
    taskLng,
    taskCategory: category,
  });

  return {
    score: aiScore.score,
    breakdown: {
      distanceScore: aiScore.breakdown.distanceScore,
      ratingScore: Number((((agent.rating || 5) / 5) * 20).toFixed(1)),
      reliabilityScore: Number(((agent.reliability_score || 1.0) * 15).toFixed(1)),
      workloadScore: aiScore.breakdown.workloadScore,
      responseScore: 10.0,
      distanceKm: aiScore.breakdown.distanceKm,
      skillScore: aiScore.breakdown.skillScore,
      availabilityScore: aiScore.breakdown.availabilityScore,
      customerPriorityScore: aiScore.breakdown.customerPriorityScore,
      compatibilityScore: aiScore.breakdown.compatibilityScore,
      estimatedTravelMinutes: aiScore.breakdown.estimatedTravelMinutes,
    },
    explanation: aiScore.explanation,
  };
}

/**
 * Executes the Intelligent Task Allocation Engine for a given task:
 * 1. Queries all verified, available agents.
 * 2. Excludes agents who have already declined, rejected, or cancelled this task.
 * 3. Calculates 7-factor AI matching scores with natural language explanation.
 * 4. Ranks and selects the highest scoring agent.
 * 5. Creates a task assignment offer.
 * 6. If no eligible agents are found, executes AI failure recovery & radius expansion.
 * 7. Emits realtime WebSocket events.
 */
export async function runTaskAssignmentEngine(taskId: string): Promise<{
  success: boolean;
  assignedAgentId?: string;
  message: string;
  explanation?: string;
}> {
  if (hasSupabaseConfig && supabaseAdmin) {
    try {
      const { data: task, error: taskError } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (taskError || !task) {
        return { success: false, message: 'Task not found' };
      }

      if (['COMPLETED', 'CONFIRMED', 'CANCELLED', 'UNSUCCESSFUL_REQUEST'].includes(task.status)) {
        return { success: false, message: `Task is already in ${task.status} state` };
      }

      const { data: attempted } = await supabaseAdmin.from('task_assignments').select('agent_id,status').eq('task_id', taskId);
      const excludedAgentIds = (attempted || [])
        .filter((a: any) => ['REJECTED', 'CANCELLED_BY_AGENT', 'CANCELLED', 'EXPIRED'].includes(a.status))
        .map((a: any) => a.agent_id);

      const { data: customerWallet } = await supabaseAdmin.from('customer_wallets').select('priority_tier').eq('customer_id', task.customer_id).maybeSingle();
      const customerTier = customerWallet?.priority_tier || 'Regular Customer';
      const searchRadius = task.search_radius_km || 15.0;

      const { data: agents } = await supabaseAdmin.from('profiles').select('*').eq('role', 'AGENT').eq('is_available', true);
      const eligibleAgents = (agents || []).filter((agent: any) => {
        const maxCapacity = agent.max_concurrent_tasks || 3;
        return !excludedAgentIds.includes(agent.id) && (agent.active_task_count || 0) < maxCapacity;
      });

      if (eligibleAgents.length === 0) {
        return { success: false, message: 'No eligible verified agents available for task.' };
      }

      const scoredCandidates = eligibleAgents.map((agent: any) => {
        const aiResult = calculateAIMatchingScore({
          agent,
          taskLat: task.pickup_latitude,
          taskLng: task.pickup_longitude,
          taskCategory: task.category,
          taskPriority: task.priority,
          customerTier,
          maxRadiusKm: searchRadius,
        });
        return { agent, score: aiResult.score, breakdown: aiResult.breakdown, explanation: aiResult.explanation };
      });

      scoredCandidates.sort((a, b) => b.score - a.score);
      const bestCandidate = scoredCandidates[0];
      const eta = predictArrivalAndCompletion({
        distanceKm: bestCandidate.breakdown.distanceKm,
        category: task.category,
        activeTaskCount: bestCandidate.agent.active_task_count || 0,
        agentVehicle: bestCandidate.agent.vehicle_type,
      });

      const { data: assignment } = await supabaseAdmin
        .from('task_assignments')
        .insert({
          task_id: taskId,
          agent_id: bestCandidate.agent.id,
          status: 'OFFERED',
          distance_km: bestCandidate.breakdown.distanceKm,
          suitability_score: bestCandidate.score,
          score_breakdown: bestCandidate.breakdown,
          offered_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      await supabaseAdmin.from('tasks').update({
        status: 'OFFERED',
        ai_matching_explanation: bestCandidate.explanation,
        estimated_arrival_minutes: eta.arrivalMinutes,
        estimated_completion_minutes: eta.completionMinutes,
        updated_at: new Date().toISOString(),
      }).eq('id', taskId);

      await supabaseAdmin.from('task_events').insert({
        task_id: taskId,
        actor_id: bestCandidate.agent.id,
        event_type: 'OFFERED',
        description: `Task offered to Agent ${bestCandidate.agent.name} (${bestCandidate.breakdown.distanceKm} km away, Score: ${bestCandidate.score})`,
        metadata: {
          agentId: bestCandidate.agent.id,
          agentName: bestCandidate.agent.name,
          suitabilityScore: bestCandidate.score,
          breakdown: bestCandidate.breakdown,
          explanation: bestCandidate.explanation,
          estimatedArrivalMinutes: eta.arrivalMinutes,
        },
        created_at: new Date().toISOString(),
      });

      await supabaseAdmin.from('notifications').insert({
        user_id: bestCandidate.agent.id,
        task_id: taskId,
        type: 'NEW_OFFER',
        title: 'New Task Offer Nearby!',
        message: `New task: "${task.title}" (${bestCandidate.breakdown.distanceKm} km away) - Reward: ₹${task.budget}`,
        created_at: new Date().toISOString(),
      });

      broadcastEvent({
        type: 'TASK_OFFERED',
        payload: {
          taskId,
          assignmentId: assignment?.id,
          agentId: bestCandidate.agent.id,
          agentName: bestCandidate.agent.name,
          distanceKm: bestCandidate.breakdown.distanceKm,
          score: bestCandidate.score,
          taskTitle: task.title,
          budget: task.budget,
          explanation: bestCandidate.explanation,
          arrivalMinutes: eta.arrivalMinutes,
        },
      });

      return {
        success: true,
        assignedAgentId: bestCandidate.agent.id,
        message: `Offer sent to ${bestCandidate.agent.name}`,
        explanation: bestCandidate.explanation,
      };
    } catch (err: any) {
      console.error('[AssignmentEngine][Supabase] allocation failed:', err);
      return { success: false, message: err?.message || 'Failed to allocate task with Supabase' };
    }
  }

  console.log(`[AssignmentEngine] Running AI allocation for task: ${taskId}`);

  // Fetch the task
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) {
    return { success: false, message: 'Task not found' };
  }

  // If task is already completed, confirmed, unsuccessful or customer-cancelled, do not allocate
  if (['COMPLETED', 'CONFIRMED', 'CANCELLED', 'UNSUCCESSFUL_REQUEST'].includes(task.status)) {
    return { success: false, message: `Task is already in ${task.status} state` };
  }

  // If task is already accepted and assigned to an active agent, do not re-allocate
  if (task.status === 'ACCEPTED' && task.assigned_agent_id) {
    return { success: false, message: `Task is already assigned to agent ${task.assigned_agent_id}` };
  }

  // Get list of agent IDs that have already responded or have active offer
  const attemptedAgents = db
    .prepare('SELECT agent_id, status FROM task_assignments WHERE task_id = ?')
    .all(taskId) as { agent_id: string; status: string }[];
  
  const excludedAgentIds = attemptedAgents
    .filter((a) => ['REJECTED', 'CANCELLED_BY_AGENT', 'CANCELLED', 'EXPIRED'].includes(a.status))
    .map((a) => a.agent_id);

  // Fetch customer priority tier
  const customerWallet = db.prepare('SELECT priority_tier FROM customer_wallets WHERE customer_id = ?').get(task.customer_id) as any;
  const customerTier = customerWallet?.priority_tier || 'Regular Customer';

  const searchRadius = task.search_radius_km || 15.0;

  // Fetch eligible active agents who are VERIFIED
  const allAgents = db
    .prepare(`
      SELECT * FROM profiles 
      WHERE role = 'AGENT' 
        AND is_available = 1 
        AND (verification_status IS NULL OR verification_status = 'VERIFIED')
        AND (suspicious_flag IS NULL OR suspicious_flag = 0)
    `)
    .all() as any[];

  // Filter out excluded agents and those with >= max_concurrent_tasks
  const eligibleAgents = allAgents.filter((agent) => {
    const maxCapacity = agent.max_concurrent_tasks || 3;
    return !excludedAgentIds.includes(agent.id) && (agent.active_task_count || 0) < maxCapacity;
  });

  if (eligibleAgents.length === 0) {
    console.log(`[AssignmentEngine] No eligible verified agents available for task ${taskId}. Invoking AI Failure Recovery...`);
    
    // AI Failure Recovery: Expands radius to 25 km or transitions to UNSUCCESSFUL_REQUEST with compensation
    const recovery = handleTaskFailureRecovery(taskId);

    if (recovery.action === 'EXPAND_RADIUS') {
      // Re-run matching immediately with expanded radius
      return runTaskAssignmentEngine(taskId);
    }

    return {
      success: false,
      message: recovery.message,
    };
  }

  // Calculate AI scores for all eligible candidates
  const scoredCandidates = eligibleAgents.map((agent) => {
    const aiResult = calculateAIMatchingScore({
      agent,
      taskLat: task.pickup_latitude,
      taskLng: task.pickup_longitude,
      taskCategory: task.category,
      taskPriority: task.priority,
      customerTier,
      maxRadiusKm: searchRadius,
    });

    return {
      agent,
      score: aiResult.score,
      breakdown: aiResult.breakdown,
      explanation: aiResult.explanation,
    };
  });

  // Rank agents: highest score first
  scoredCandidates.sort((a, b) => b.score - a.score);
  const bestCandidate = scoredCandidates[0];

  // Calculate dynamic ETA
  const eta = predictArrivalAndCompletion({
    distanceKm: bestCandidate.breakdown.distanceKm,
    category: task.category,
    activeTaskCount: bestCandidate.agent.active_task_count || 0,
    agentVehicle: bestCandidate.agent.vehicle_type,
  });

  console.log(
    `[AssignmentEngine] Best AI candidate for task ${taskId}: ${bestCandidate.agent.name} (Score: ${bestCandidate.score}, Dist: ${bestCandidate.breakdown.distanceKm} km)`
  );

  // Perform atomic assignment creation
  const assignmentId = uuidv4();
  const eventId = uuidv4();
  const notifId = uuidv4();

  const insertAssignment = db.transaction(() => {
    // 1. Insert new assignment offer
    db.prepare(`
      INSERT INTO task_assignments (id, task_id, agent_id, status, distance_km, suitability_score, score_breakdown, offered_at)
      VALUES (?, ?, ?, 'OFFERED', ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      assignmentId,
      taskId,
      bestCandidate.agent.id,
      bestCandidate.breakdown.distanceKm,
      bestCandidate.score,
      JSON.stringify(bestCandidate.breakdown)
    );

    // 2. Update task status to OFFERED and attach AI explanation & ETA
    db.prepare(`
      UPDATE tasks 
      SET status = 'OFFERED', 
          ai_matching_explanation = ?,
          estimated_arrival_minutes = ?,
          estimated_completion_minutes = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(bestCandidate.explanation, eta.arrivalMinutes, eta.completionMinutes, taskId);

    // 3. Log event
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, metadata, created_at)
      VALUES (?, ?, ?, 'OFFERED', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      eventId,
      taskId,
      bestCandidate.agent.id,
      `Task offered to Agent ${bestCandidate.agent.name} (${bestCandidate.breakdown.distanceKm} km away, Score: ${bestCandidate.score})`,
      JSON.stringify({
        agentId: bestCandidate.agent.id,
        agentName: bestCandidate.agent.name,
        suitabilityScore: bestCandidate.score,
        breakdown: bestCandidate.breakdown,
        explanation: bestCandidate.explanation,
        estimatedArrivalMinutes: eta.arrivalMinutes,
      })
    );

    // 4. Create in-app notification for agent
    db.prepare(`
      INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
      VALUES (?, ?, ?, 'NEW_OFFER', 'New Task Offer Nearby!', ?, CURRENT_TIMESTAMP)
    `).run(
      notifId,
      bestCandidate.agent.id,
      taskId,
      `New task: "${task.title}" (${bestCandidate.breakdown.distanceKm} km away) - Reward: ₹${task.budget}`
    );
  });

  insertAssignment();

  // Broadcast realtime updates to all connected devices
  broadcastEvent({
    type: 'TASK_OFFERED',
    payload: {
      taskId,
      assignmentId,
      agentId: bestCandidate.agent.id,
      agentName: bestCandidate.agent.name,
      distanceKm: bestCandidate.breakdown.distanceKm,
      score: bestCandidate.score,
      taskTitle: task.title,
      budget: task.budget,
      explanation: bestCandidate.explanation,
      arrivalMinutes: eta.arrivalMinutes,
    },
  });

  broadcastEvent({
    type: 'TASK_UPDATED',
    payload: {
      taskId,
      status: 'OFFERED',
      ai_matching_explanation: bestCandidate.explanation,
      estimated_arrival_minutes: eta.arrivalMinutes,
    },
  });

  return {
    success: true,
    assignedAgentId: bestCandidate.agent.id,
    message: `Offer sent to ${bestCandidate.agent.name}`,
    explanation: bestCandidate.explanation,
  };
}

/**
 * Handles Agent Task Rejection with Automatic Next-Best Reassignment
 */
export async function handleAgentReject(taskId: string, agentId: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (hasSupabaseConfig && supabaseAdmin) {
    try {
      const { data: agent } = await supabaseAdmin.from('profiles').select('name').eq('id', agentId).maybeSingle();
      const agentName = agent ? agent.name : 'Agent';

      await supabaseAdmin.from('task_assignments').update({ status: 'REJECTED', responded_at: new Date().toISOString() }).eq('task_id', taskId).eq('agent_id', agentId).eq('status', 'OFFERED');
      await supabaseAdmin.from('task_events').insert({
        task_id: taskId,
        actor_id: agentId,
        event_type: 'REJECTED',
        description: `Agent ${agentName} declined the task offer.`,
        created_at: new Date().toISOString(),
      });
      await supabaseAdmin.from('tasks').update({ status: 'MATCHING', updated_at: new Date().toISOString() }).eq('id', taskId);

      broadcastEvent({ type: 'AGENT_REJECTED', payload: { taskId, agentId, agentName } });
      const reassignmentResult = await runTaskAssignmentEngine(taskId);
      return { success: true, message: `Offer rejected. ${reassignmentResult.message}` };
    } catch (err: any) {
      console.error('[AssignmentEngine][Supabase] reject failed:', err);
      return { success: false, message: err?.message || 'Failed to reject task offer' };
    }
  }

  console.log(`[AssignmentEngine] Agent ${agentId} rejected task ${taskId}`);

  const agent = db.prepare('SELECT name FROM profiles WHERE id = ?').get(agentId) as any;
  const agentName = agent ? agent.name : 'Agent';

  const rejectTransaction = db.transaction(() => {
    // 1. Mark current assignment as REJECTED
    db.prepare(`
      UPDATE task_assignments 
      SET status = 'REJECTED', responded_at = CURRENT_TIMESTAMP 
      WHERE task_id = ? AND agent_id = ? AND status = 'OFFERED'
    `).run(taskId, agentId);

    // 2. Log event
    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
      VALUES (?, ?, ?, 'REJECTED', ?, CURRENT_TIMESTAMP)
    `).run(eventId, taskId, agentId, `Agent ${agentName} declined the task offer.`);

    // 3. Update task status back to MATCHING / REASSIGNING
    db.prepare(`
      UPDATE tasks 
      SET status = 'MATCHING', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(taskId);
  });

  rejectTransaction();

  // Notify admin and customer
  broadcastEvent({
    type: 'AGENT_REJECTED',
    payload: { taskId, agentId, agentName },
  });

  // IMMEDIATELY TRIGGER AUTOMATIC REASSIGNMENT ENGINE
  console.log(`[AssignmentEngine] Automatically re-running matching engine to find next candidate...`);
  const reassignmentResult = runTaskAssignmentEngine(taskId);

  return {
    success: true,
    message: `Offer rejected. ${reassignmentResult.message}`,
  };
}

/**
 * Handles Agent Task Acceptance with Concurrency Lock Protection
 */
export async function handleAgentAccept(taskId: string, agentId: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (hasSupabaseConfig && supabaseAdmin) {
    try {
      const { data: agent } = await supabaseAdmin.from('profiles').select('*').eq('id', agentId).maybeSingle();
      const { data: task } = await supabaseAdmin.from('tasks').select('customer_id, title').eq('id', taskId).maybeSingle();

      if (!agent || !task) {
        return { success: false, message: 'Invalid agent or task' };
      }

      const { data: currentTask } = await supabaseAdmin.from('tasks').select('status, assigned_agent_id').eq('id', taskId).maybeSingle();
      if (currentTask?.assigned_agent_id || !['OFFERED', 'MATCHING', 'REASSIGNING'].includes(currentTask?.status || '')) {
        return { success: false, message: 'Task is no longer available or was accepted by another agent.' };
      }

      const { data: assignment } = await supabaseAdmin.from('task_assignments').select('id').eq('task_id', taskId).eq('agent_id', agentId).eq('status', 'OFFERED').maybeSingle();
      if (!assignment) {
        return { success: false, message: 'Task is no longer available or was accepted by another agent.' };
      }

      await supabaseAdmin.from('task_assignments').update({ status: 'ACCEPTED', responded_at: new Date().toISOString() }).eq('id', assignment.id);
      await supabaseAdmin.from('tasks').update({ status: 'ACCEPTED', assigned_agent_id: agentId, updated_at: new Date().toISOString() }).eq('id', taskId);
      await supabaseAdmin.from('profiles').update({ active_task_count: (agent.active_task_count || 0) + 1 }).eq('id', agentId);
      await supabaseAdmin.from('task_events').insert({
        task_id: taskId,
        actor_id: agentId,
        event_type: 'ACCEPTED',
        description: `Agent ${agent.name} accepted the task.`,
        created_at: new Date().toISOString(),
      });
      await supabaseAdmin.from('notifications').insert({
        user_id: task.customer_id,
        task_id: taskId,
        type: 'TASK_ACCEPTED',
        title: 'Task Accepted!',
        message: `Agent ${agent.name} accepted your task "${task.title}". They are heading to your location.`,
        created_at: new Date().toISOString(),
      });

      broadcastEvent({
        type: 'TASK_ACCEPTED',
        payload: {
          taskId,
          agentId,
          agentName: agent.name,
          agentPhone: agent.phone,
          agentRating: agent.rating,
          agentAvatar: agent.avatar_url,
          agentLat: agent.latitude,
          agentLng: agent.longitude,
        },
      });
      broadcastEvent({ type: 'TASK_UPDATED', payload: { taskId, status: 'ACCEPTED', assigned_agent_id: agentId } });
      return { success: true, message: 'Task accepted successfully.' };
    } catch (err: any) {
      console.error('[AssignmentEngine][Supabase] accept failed:', err);
      return { success: false, message: err?.message || 'Failed to accept task' };
    }
  }

  const agent = db.prepare('SELECT * FROM profiles WHERE id = ?').get(agentId) as any;
  const task = db.prepare('SELECT customer_id, title FROM tasks WHERE id = ?').get(taskId) as any;

  if (!agent || !task) {
    return { success: false, message: 'Invalid agent or task' };
  }

  let accepted = false;

  const acceptTransaction = db.transaction(() => {
    // Concurrency check: Ensure task is still OFFERED or MATCHING or REASSIGNING and not already accepted
    const currentTask = db.prepare('SELECT status, assigned_agent_id FROM tasks WHERE id = ?').get(taskId) as any;
    if (currentTask.assigned_agent_id || !['OFFERED', 'MATCHING', 'REASSIGNING'].includes(currentTask.status)) {
      return; // Already taken or cancelled
    }

    // Check assignment offer
    const assignment = db.prepare(`
      SELECT id FROM task_assignments 
      WHERE task_id = ? AND agent_id = ? AND status = 'OFFERED'
    `).get(taskId, agentId) as any;

    if (!assignment) {
      return;
    }

    // 1. Mark assignment accepted
    db.prepare(`
      UPDATE task_assignments 
      SET status = 'ACCEPTED', responded_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(assignment.id);

    // 2. Assign agent to task and set status ACCEPTED
    db.prepare(`
      UPDATE tasks 
      SET status = 'ACCEPTED', assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(agentId, taskId);

    // 3. Increment agent's active task count
    db.prepare(`
      UPDATE profiles 
      SET active_task_count = COALESCE(active_task_count, 0) + 1 
      WHERE id = ?
    `).run(agentId);

    // 4. Log event
    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
      VALUES (?, ?, ?, 'ACCEPTED', ?, CURRENT_TIMESTAMP)
    `).run(eventId, taskId, agentId, `Agent ${agent.name} accepted the task.`);

    // 5. Notify Customer
    const notifId = uuidv4();
    db.prepare(`
      INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
      VALUES (?, ?, ?, 'TASK_ACCEPTED', 'Task Accepted!', ?, CURRENT_TIMESTAMP)
    `).run(
      notifId,
      task.customer_id,
      taskId,
      `Agent ${agent.name} accepted your task "${task.title}". They are heading to your location.`
    );

    accepted = true;
  });

  acceptTransaction();

  if (!accepted) {
    return {
      success: false,
      message: 'Task is no longer available or was accepted by another agent.',
    };
  }

  // Broadcast realtime event to all connected devices
  broadcastEvent({
    type: 'TASK_ACCEPTED',
    payload: {
      taskId,
      agentId,
      agentName: agent.name,
      agentPhone: agent.phone,
      agentRating: agent.rating,
      agentAvatar: agent.avatar_url,
      agentLat: agent.latitude,
      agentLng: agent.longitude,
    },
  });

  broadcastEvent({
    type: 'TASK_UPDATED',
    payload: { taskId, status: 'ACCEPTED', assigned_agent_id: agentId },
  });

  return {
    success: true,
    message: 'Task accepted successfully.',
  };
}

/**
 * Handles Agent Cancellation AFTER Acceptance (Mandatory Requirement)
 * - Changes assignment status to CANCELLED_BY_AGENT
 * - Sets task to REASSIGNING
 * - Excludes the cancelling agent
 * - Reruns the matching engine automatically to find and notify the next best agent!
 */
export async function handleAgentCancelAfterAccept(
  taskId: string,
  agentId: string,
  reason: string = 'Agent emergency / unable to fulfill'
): Promise<{
  success: boolean;
  message: string;
}> {
  if (hasSupabaseConfig && supabaseAdmin) {
    try {
      const { data: agent } = await supabaseAdmin.from('profiles').select('name').eq('id', agentId).maybeSingle();
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (!agent || !task) return { success: false, message: 'Invalid agent or task' };
      if (task.assigned_agent_id !== agentId && !['ACCEPTED', 'IN_PROGRESS'].includes(task.status)) {
        return { success: false, message: 'Agent is not currently assigned to this task' };
      }

      await supabaseAdmin.from('task_assignments').update({ status: 'CANCELLED_BY_AGENT', responded_at: new Date().toISOString() }).eq('task_id', taskId).eq('agent_id', agentId).in('status', ['ACCEPTED', 'OFFERED']);
      const { data: agentProfile } = await supabaseAdmin.from('profiles').select('active_task_count, reliability_score').eq('id', agentId).maybeSingle();
      await supabaseAdmin.from('profiles').update({
        active_task_count: Math.max(0, Number(agentProfile?.active_task_count || 0) - 1),
        reliability_score: Math.max(0.80, Number(agentProfile?.reliability_score || 0.95) - 0.02),
      }).eq('id', agentId);
      await supabaseAdmin.from('tasks').update({ status: 'REASSIGNING', assigned_agent_id: null, updated_at: new Date().toISOString() }).eq('id', taskId);
      await supabaseAdmin.from('task_events').insert({
        task_id: taskId,
        actor_id: agentId,
        event_type: 'STATUS_CHANGED',
        description: `Agent ${agent.name} cancelled after acceptance (${reason}). Automatic reassignment engine triggered.`,
        metadata: { reason, previousAgentId: agentId },
        created_at: new Date().toISOString(),
      });
      await supabaseAdmin.from('notifications').insert({
        user_id: task.customer_id,
        task_id: taskId,
        type: 'STATUS_UPDATE',
        title: 'Task Reassigning',
        message: `Agent ${agent.name} had to cancel. TaskMate is immediately assigning the next best nearby agent for you.`,
        created_at: new Date().toISOString(),
      });

      broadcastEvent({ type: 'AGENT_CANCELLED_TASK', payload: { taskId, agentId, agentName: agent.name, reason } });
      broadcastEvent({ type: 'TASK_UPDATED', payload: { taskId, status: 'REASSIGNING', assigned_agent_id: null } });
      const reassignmentResult = await runTaskAssignmentEngine(taskId);
      return { success: true, message: `Task cancelled. ${reassignmentResult.message}` };
    } catch (err: any) {
      console.error('[AssignmentEngine][Supabase] cancel failed:', err);
      return { success: false, message: err?.message || 'Failed to cancel task' };
    }
  }

  console.log(`[AssignmentEngine] Agent ${agentId} cancelling accepted task ${taskId}`);

  const agent = db.prepare('SELECT name FROM profiles WHERE id = ?').get(agentId) as any;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;

  if (!agent || !task) {
    return { success: false, message: 'Invalid agent or task' };
  }

  if (task.assigned_agent_id !== agentId && !['ACCEPTED', 'IN_PROGRESS'].includes(task.status)) {
    return { success: false, message: 'Agent is not currently assigned to this task' };
  }

  const cancelTransaction = db.transaction(() => {
    // 1. Mark current assignment as CANCELLED_BY_AGENT
    db.prepare(`
      UPDATE task_assignments 
      SET status = 'CANCELLED_BY_AGENT', responded_at = CURRENT_TIMESTAMP 
      WHERE task_id = ? AND agent_id = ? AND status IN ('ACCEPTED', 'OFFERED')
    `).run(taskId, agentId);

    // 2. Decrement agent's active task count & slightly penalize reliability
    db.prepare(`
      UPDATE profiles 
      SET active_task_count = MAX(0, active_task_count - 1),
          reliability_score = MAX(0.80, reliability_score - 0.02)
      WHERE id = ?
    `).run(agentId);

    // 3. Reset task assigned_agent_id and set status to REASSIGNING
    db.prepare(`
      UPDATE tasks 
      SET status = 'REASSIGNING', assigned_agent_id = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(taskId);

    // 4. Log event
    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, metadata, created_at)
      VALUES (?, ?, ?, 'STATUS_CHANGED', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      eventId,
      taskId,
      agentId,
      `Agent ${agent.name} cancelled after acceptance (${reason}). Automatic reassignment engine triggered.`,
      JSON.stringify({ reason, previousAgentId: agentId })
    );

    // 5. Notify customer
    const notifId = uuidv4();
    db.prepare(`
      INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
      VALUES (?, ?, ?, 'STATUS_UPDATE', 'Task Reassigning', ?, CURRENT_TIMESTAMP)
    `).run(
      notifId,
      task.customer_id,
      taskId,
      `Agent ${agent.name} had to cancel. TaskMate is immediately assigning the next best nearby agent for you.`
    );
  });

  cancelTransaction();

  // Broadcast cancellation
  broadcastEvent({
    type: 'AGENT_CANCELLED_TASK',
    payload: { taskId, agentId, agentName: agent.name, reason },
  });

  broadcastEvent({
    type: 'TASK_UPDATED',
    payload: { taskId, status: 'REASSIGNING', assigned_agent_id: null },
  });

  // IMMEDIATELY TRIGGER AUTOMATIC REASSIGNMENT ENGINE
  console.log(`[AssignmentEngine] Automatically re-running assignment engine after agent cancellation...`);
  const reassignmentResult = runTaskAssignmentEngine(taskId);

  return {
    success: true,
    message: `Task cancelled. ${reassignmentResult.message}`,
  };
}

/**
 * Checks for tasks waiting in MATCHING, REASSIGNING, or NO_AGENT_AVAILABLE and retries allocation
 */
export function retryPendingTasks(): void {
  const pendingTasks = db
    .prepare("SELECT id FROM tasks WHERE status IN ('POSTED', 'MATCHING', 'REASSIGNING', 'NO_AGENT_AVAILABLE')")
    .all() as { id: string }[];

  for (const t of pendingTasks) {
    runTaskAssignmentEngine(t.id);
  }
}
