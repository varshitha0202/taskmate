import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import {
  hasSupabaseConfig,
  supabaseAdmin,
  getSupabaseUserByEmail,
  getSupabaseUserById,
  listSupabaseAgents,
  normalizeSupabaseProfile,
  updateSupabaseProfile,
  createSupabaseTask,
  fetchSupabaseTasksForUser,
  fetchSupabaseTaskById,
  fetchSupabaseTaskRelations,
  getSupabaseActiveOffer,
  insertSupabaseTaskEvent,
  insertSupabaseNotification,
  upsertSupabaseReview,
  getSupabaseAgentAverageRating,
  updateSupabaseTaskStatus,
} from './supabase.js';
import { db, initDatabase } from './db.js';
import { initWebSocketServer, broadcastEvent } from './websocket.js';
import {
  runTaskAssignmentEngine,
  handleAgentAccept,
  handleAgentReject,
  handleAgentCancelAfterAccept,
  retryPendingTasks,
  calculateHaversineDistance,
} from './matchingEngine.js';
import { seedDemoData } from './seed.js';
import { getOrCreateCustomerWallet, awardCustomerTaskCompletionPoints } from './ai/pointsAndWallet.js';
import { runAgentVerificationCheck, adminReviewVerification } from './ai/verificationEngine.js';
import { findMultiTaskOpportunities, getOptimizedAgentRoute } from './ai/multiTaskEngine.js';
import { handleCustomerAssistantQuery, handleAgentAssistantQuery } from './ai/assistants.js';
import { getCustomerRecommendations } from './ai/recommendationEngine.js';
import { detectSuspiciousActivity, resolveFraudAlert } from './ai/fraudDetector.js';
import { executeSmartRebooking } from './ai/failureRecovery.js';
import { getMatchingWeights } from './ai/smartMatching.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const app = express();
const server = http.createServer(app);
const HOST = process.env.HOST || '0.0.0.0';
app.get('/api/health', (_req,res) =>{
res.json({ status:'ok' });
});
const PORT = Number(process.env.PORT || 3001);

const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? undefined : 'taskmate-super-secret-jwt-key-2026');
if (isProduction && !JWT_SECRET) {
  throw new Error('Production requires a valid JWT_SECRET environment variable. Set it before starting the backend.');
}

if (isProduction && !hasSupabaseConfig) {
  throw new Error('Production requires valid Supabase configuration: SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
}

const allowedFrontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedFrontendOrigins.length === 0 || allowedFrontendOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite only for local development. Production uses Supabase as the shared data source.
if (!isProduction) {
  initDatabase();
  seedDemoData();
}

initWebSocketServer(server);

// Auth Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ----------------------------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, latitude, longitude, vehicle_type } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: existing } = await getSupabaseUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const id = uuidv4();
      const password_hash = bcrypt.hashSync(password, 10);
      const userLat = latitude || 17.4435;
      const userLng = longitude || 78.3772;

      const { data: createdUser, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id,
          name,
          email: String(email).trim().toLowerCase(),
          password_hash,
          role,
          phone: phone || '',
          address: address || '',
          latitude: userLat,
          longitude: userLng,
          vehicle_type: vehicle_type || 'Motorcycle',
          is_identity_verified: true,
          is_phone_verified: true,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      const token = jwt.sign({ id, email: createdUser.email, role: createdUser.role }, JWT_SECRET, { expiresIn: '7d' });
      if (role === 'AGENT') retryPendingTasks();
      return res.status(201).json({ token, user: normalizeSupabaseProfile(createdUser) });
    }

    const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);
    const userLat = latitude || 17.4435;
    const userLng = longitude || 78.3772;

    db.prepare(`
      INSERT INTO profiles (
        id, name, email, password_hash, role, phone, address, latitude, longitude, vehicle_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, password_hash, role, phone || '', address || '', userLat, userLng, vehicle_type || 'Motorcycle');

    const user = db.prepare('SELECT id, name, email, role, phone, rating, reliability_score, is_available, latitude, longitude, address, vehicle_type, is_identity_verified, is_phone_verified FROM profiles WHERE id = ?').get(id);
    const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' });

    if (role === 'AGENT') {
      retryPendingTasks();
    }

    res.status(201).json({ token, user });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: user, error: userError } = await getSupabaseUserByEmail(email);
      if (userError || !user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isValid = bcrypt.compareSync(password, user.password_hash || '');
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      const { password_hash, ...profileSafe } = user;
      return res.json({ token, user: normalizeSupabaseProfile(profileSafe) });
    }

    const user = db.prepare('SELECT * FROM profiles WHERE email = ?').get(email) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    const { password_hash, ...profileSafe } = user;
    res.json({ token, user: profileSafe });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req: any, res) => {
  try {
    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: user, error } = await getSupabaseUserById(req.user.id);
      if (error || !user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: normalizeSupabaseProfile(user) });
    }

    const user = db.prepare(`
      SELECT id, name, email, role, phone, avatar_url, rating, reliability_score, 
             is_available, latitude, longitude, address, active_task_count, 
             total_completed_tasks, is_identity_verified, is_phone_verified, 
             vehicle_type, completion_rate, response_rate, created_at 
      FROM profiles WHERE id = ?
    `).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// PROFILE ROUTES
// ----------------------------------------------------------------------

app.patch('/api/profiles/me', authenticateToken, async (req: any, res) => {
  try {
    const { is_available, latitude, longitude, address, phone, name, email, avatar_url } = req.body;

    if (hasSupabaseConfig && supabaseAdmin) {
      const updates: Record<string, any> = {};

      if (is_available !== undefined) updates.is_available = Boolean(is_available);
      if (latitude !== undefined && longitude !== undefined) {
        updates.latitude = latitude;
        updates.longitude = longitude;
      }
      if (address !== undefined) updates.address = address;
      if (phone !== undefined) updates.phone = phone;
      if (name !== undefined) updates.name = name.trim();
      if (email !== undefined) updates.email = String(email).trim().toLowerCase();
      if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;

      if (Object.keys(updates).length > 0) {
        const { data: updated, error } = await updateSupabaseProfile(req.user.id, updates);
        if (error) throw error;
        broadcastEvent({ type: 'AGENT_PROFILE_UPDATED', payload: normalizeSupabaseProfile(updated) });
        return res.json({ user: normalizeSupabaseProfile(updated) });
      }

      const { data: existing } = await getSupabaseUserById(req.user.id);
      return res.json({ user: normalizeSupabaseProfile(existing) });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ error: 'Name must contain at least 2 characters' });
    }
    if (email !== undefined && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (email !== undefined) {
      const existing = db.prepare('SELECT id FROM profiles WHERE email = ? AND id != ?').get(String(email).trim().toLowerCase(), req.user.id);
      if (existing) return res.status(409).json({ error: 'That email address is already in use' });
    }

    if (is_available !== undefined) {
      updates.push('is_available = ?');
      params.push(is_available ? 1 : 0);
    }
    if (latitude !== undefined && longitude !== undefined) {
      updates.push('latitude = ?', 'longitude = ?');
      params.push(latitude, longitude);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(String(email).trim().toLowerCase());
    }
    if (avatar_url !== undefined) {
      if (avatar_url !== null && (typeof avatar_url !== 'string' || avatar_url.length > 2000)) {
        return res.status(400).json({ error: 'Profile photo URL is too long' });
      }
      updates.push('avatar_url = ?');
      params.push(avatar_url || null);
    }

    if (updates.length > 0) {
      params.push(req.user.id);
      db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare(`
      SELECT id, name, email, role, phone, avatar_url, rating, reliability_score, 
             is_available, latitude, longitude, address, active_task_count, 
             total_completed_tasks, is_identity_verified, is_phone_verified, 
             vehicle_type, completion_rate, response_rate 
      FROM profiles WHERE id = ?
    `).get(req.user.id) as any;

    broadcastEvent({
      type: 'AGENT_PROFILE_UPDATED',
      payload: updated,
    });

    if (is_available) {
      retryPendingTasks();
    }

    res.json({ user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profiles/agents', async (req, res) => {
  try {
    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: agents, error } = await listSupabaseAgents();
      if (error) throw error;
      return res.json({ agents: (agents || []).map(normalizeSupabaseProfile) });
    }

    const agents = db.prepare(`
      SELECT id, name, email, role, phone, avatar_url, rating, reliability_score, 
             is_available, latitude, longitude, address, active_task_count, 
             total_completed_tasks, is_identity_verified, is_phone_verified, 
             vehicle_type, completion_rate, response_rate 
      FROM profiles 
      WHERE role = 'AGENT'
      ORDER BY rating DESC
    `).all();
    res.json({ agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// LIVE LOCATION & SIMULATION ROUTES
// ----------------------------------------------------------------------

// Agent sends real GPS or manual location update
app.post('/api/agent/location', authenticateToken, (req: any, res) => {
  try {
    const { latitude, longitude, address, taskId } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const agentId = req.user.id;

    // Update profile coordinates
    db.prepare(`
      UPDATE profiles 
      SET latitude = ?, longitude = ?, address = COALESCE(?, address) 
      WHERE id = ?
    `).run(latitude, longitude, address || null, agentId);

    // Save to location history
    const locId = uuidv4();
    db.prepare(`
      INSERT INTO agent_locations (id, agent_id, latitude, longitude, address)
      VALUES (?, ?, ?, ?, ?)
    `).run(locId, agentId, latitude, longitude, address || null);

    // Broadcast live location to customer & admin
    broadcastEvent({
      type: 'AGENT_LOCATION_UPDATED',
      payload: {
        agentId,
        latitude,
        longitude,
        address,
        taskId: taskId || null,
        timestamp: Date.now(),
      },
    });

    res.json({ success: true, latitude, longitude });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent triggers simulation step (moves closer to task destination/pickup)
app.post('/api/agent/simulate-step', authenticateToken, (req: any, res) => {
  try {
    const { taskId, stepPercent = 0.20 } = req.body;
    const agentId = req.user.id;

    const agent = db.prepare('SELECT latitude, longitude FROM profiles WHERE id = ?').get(agentId) as any;
    const task = db.prepare('SELECT pickup_latitude, pickup_longitude, destination_latitude, destination_longitude FROM tasks WHERE id = ?').get(taskId) as any;

    if (!agent || !task) {
      return res.status(400).json({ error: 'Invalid agent or task' });
    }

    const targetLat = task.destination_latitude || task.pickup_latitude;
    const targetLng = task.destination_longitude || task.pickup_longitude;

    // Step calculation with slight realism jitter
    const dLat = (targetLat - agent.latitude) * stepPercent;
    const dLng = (targetLng - agent.longitude) * stepPercent;
    const jitter = (Math.random() - 0.5) * 0.0002;

    const newLat = Number((agent.latitude + dLat + jitter).toFixed(6));
    const newLng = Number((agent.longitude + dLng + jitter).toFixed(6));

    const remainingDistance = calculateHaversineDistance(newLat, newLng, targetLat, targetLng);

    // Update DB
    db.prepare('UPDATE profiles SET latitude = ?, longitude = ? WHERE id = ?').run(newLat, newLng, agentId);

    const locId = uuidv4();
    db.prepare(`
      INSERT INTO agent_locations (id, agent_id, latitude, longitude, address)
      VALUES (?, ?, ?, ?, 'Demo Simulating Route')
    `).run(locId, agentId, newLat, newLng);

    // Broadcast live coordinate update
    broadcastEvent({
      type: 'AGENT_LOCATION_UPDATED',
      payload: {
        agentId,
        latitude: newLat,
        longitude: newLng,
        taskId,
        remainingDistanceKm: remainingDistance,
        timestamp: Date.now(),
      },
    });

    res.json({
      success: true,
      latitude: newLat,
      longitude: newLng,
      remainingDistanceKm: remainingDistance,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// TASK ROUTES
// ----------------------------------------------------------------------

app.post('/api/tasks', authenticateToken, async (req: any, res) => {
  try {
    const {
      title,
      description,
      category,
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_location,
      destination_latitude,
      destination_longitude,
      budget,
      priority,
      preferred_time,
      special_instructions,
      photos,
    } = req.body;

    if (!title || !category || !pickup_location || !pickup_latitude || !pickup_longitude || !budget) {
      return res.status(400).json({ error: 'Missing required task details' });
    }

    const taskId = uuidv4();
    const eventId = uuidv4();

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: createdTask, error: taskError } = await createSupabaseTask({
        id: taskId,
        customer_id: req.user.id,
        title,
        description,
        category,
        pickup_location,
        pickup_latitude,
        pickup_longitude,
        destination_location,
        destination_latitude,
        destination_longitude,
        budget,
        priority: priority || 'MEDIUM',
        preferred_time,
        special_instructions,
        photos,
      });

      if (taskError || !createdTask) {
        throw taskError || new Error('Failed to create task');
      }

      await insertSupabaseTaskEvent(taskId, req.user.id, 'CREATED', 'Task posted by customer. Matching engine initiated.');
      broadcastEvent({ type: 'TASK_CREATED', payload: { taskId, title, budget, category } });
      const allocationResult = await runTaskAssignmentEngine(taskId);
      const { data: taskWithCustomer } = await supabaseAdmin.from('tasks').select('*, customer:profiles!tasks_customer_id_fkey(name, phone)').eq('id', taskId).maybeSingle();
      return res.status(201).json({ task: taskWithCustomer, allocation: allocationResult });
    }

    const insertTask = db.transaction(() => {
      db.prepare(`
        INSERT INTO tasks (
          id, customer_id, title, description, category, pickup_location,
          pickup_latitude, pickup_longitude, destination_location,
          destination_latitude, destination_longitude, budget, priority,
          preferred_time, special_instructions, photos, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MATCHING'
        )
      `).run(
        taskId,
        req.user.id,
        title,
        description || '',
        category,
        pickup_location,
        pickup_latitude,
        pickup_longitude,
        destination_location || null,
        destination_latitude || null,
        destination_longitude || null,
        budget,
        priority || 'MEDIUM',
        preferred_time || null,
        special_instructions || null,
        photos ? JSON.stringify(photos) : null
      );

      db.prepare(`
        INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
        VALUES (?, ?, ?, 'CREATED', 'Task posted by customer. Matching engine initiated.', CURRENT_TIMESTAMP)
      `).run(eventId, taskId, req.user.id);
    });

    insertTask();

    broadcastEvent({
      type: 'TASK_CREATED',
      payload: { taskId, title, budget, category },
    });

    const allocationResult = await runTaskAssignmentEngine(taskId);
    const createdTask = db.prepare(`
      SELECT t.*, p.name as customer_name, p.phone as customer_phone
      FROM tasks t
      JOIN profiles p ON t.customer_id = p.id
      WHERE t.id = ?
    `).get(taskId);

    res.status(201).json({
      task: createdTask,
      allocation: allocationResult,
    });
  } catch (err: any) {
    console.error('Task creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks', authenticateToken, async (req: any, res) => {
  try {
    const { role, id: userId } = req.user;
    const { category, status } = req.query;

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: tasks, error } = await fetchSupabaseTasksForUser(userId, role, String(category || ''), String(status || ''));
      if (error) throw error;
      return res.json({
        tasks: (tasks || []).map((t: any) => ({
          ...t,
          customer_name: t.customer?.[0]?.name || t.customer?.name || null,
          customer_phone: t.customer?.[0]?.phone || t.customer?.phone || null,
          agent_name: t.agent?.[0]?.name || t.agent?.name || null,
          agent_phone: t.agent?.[0]?.phone || t.agent?.phone || null,
          agent_rating: t.agent?.[0]?.rating || t.agent?.rating || null,
          agent_avatar: t.agent?.[0]?.avatar_url || t.agent?.avatar_url || null,
          agent_lat: t.agent?.[0]?.latitude || t.agent?.latitude || null,
          agent_lng: t.agent?.[0]?.longitude || t.agent?.longitude || null,
          photos: Array.isArray(t.photos) ? t.photos : (t.photos ? JSON.parse(t.photos) : []),
        })),
      });
    }

    let query = `
      SELECT t.*, 
             c.name as customer_name, c.phone as customer_phone,
             a.name as agent_name, a.phone as agent_phone, a.rating as agent_rating, a.avatar_url as agent_avatar,
                  a.latitude as agent_lat, a.longitude as agent_lng,
                  al.latitude as agent_live_lat, al.longitude as agent_live_lng, al.created_at as agent_location_at
      FROM tasks t
      JOIN profiles c ON t.customer_id = c.id
      LEFT JOIN profiles a ON t.assigned_agent_id = a.id
                LEFT JOIN agent_locations al ON al.id = (
             SELECT latest.id FROM agent_locations latest
             WHERE latest.agent_id = t.assigned_agent_id
             ORDER BY latest.created_at DESC LIMIT 1
                )
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (role === 'CUSTOMER') {
      conditions.push('t.customer_id = ?');
      params.push(userId);
    } else if (role === 'AGENT') {
      conditions.push(`(
        t.assigned_agent_id = ? 
        OR t.id IN (SELECT task_id FROM task_assignments WHERE agent_id = ? AND status = 'OFFERED')
        OR t.status IN ('POSTED', 'MATCHING', 'REASSIGNING')
      )`);
      params.push(userId, userId);
    }

    if (category && category !== 'ALL') {
      conditions.push('t.category = ?');
      params.push(category);
    }

    if (status && status !== 'ALL') {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const tasks = db.prepare(query).all(...params) as any[];
    res.json({
      tasks: tasks.map((t) => ({
        ...t,
        photos: t.photos ? JSON.parse(t.photos) : [],
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id', authenticateToken, async (req: any, res) => {
  try {
    const taskId = req.params.id;

    if (hasSupabaseConfig && supabaseAdmin) {
      const task = await fetchSupabaseTaskById(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      const { assignments, events, review } = await fetchSupabaseTaskRelations(taskId);
      return res.json({
        task: {
          ...task,
          customer_name: task.customer?.name || null,
          customer_phone: task.customer?.phone || null,
          customer_email: task.customer?.email || null,
          agent_name: task.agent?.name || null,
          agent_phone: task.agent?.phone || null,
          agent_rating: task.agent?.rating || null,
          agent_avatar: task.agent?.avatar_url || null,
          agent_lat: task.agent?.latitude || null,
          agent_lng: task.agent?.longitude || null,
          photos: Array.isArray(task.photos) ? task.photos : (task.photos ? JSON.parse(task.photos) : []),
        },
        assignments: (assignments || []).map((a: any) => ({
          ...a,
          agent_name: a.agent?.name || null,
          agent_email: a.agent?.email || null,
          agent_rating: a.agent?.rating || null,
          agent_phone: a.agent?.phone || null,
          agent_avatar: a.agent?.avatar_url || null,
          score_breakdown: a.score_breakdown || null,
        })),
        events: (events || []).map((e: any) => ({
          ...e,
          actor_name: e.actor?.name || null,
          actor_role: e.actor?.role || null,
          metadata: e.metadata || null,
        })),
        review,
      });
    }

    const task = db.prepare(`
      SELECT t.*, 
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             a.name as agent_name, a.phone as agent_phone, a.rating as agent_rating, a.avatar_url as agent_avatar,
                  a.latitude as agent_lat, a.longitude as agent_lng,
                  al.latitude as agent_live_lat, al.longitude as agent_live_lng, al.created_at as agent_location_at
      FROM tasks t
      JOIN profiles c ON t.customer_id = c.id
      LEFT JOIN profiles a ON t.assigned_agent_id = a.id
                LEFT JOIN agent_locations al ON al.id = (
             SELECT latest.id FROM agent_locations latest
             WHERE latest.agent_id = t.assigned_agent_id
             ORDER BY latest.created_at DESC LIMIT 1
                )
      WHERE t.id = ?
    `).get(taskId) as any;

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const assignments = db.prepare(`
      SELECT ta.*, p.name as agent_name, p.email as agent_email, p.rating as agent_rating, 
             p.phone as agent_phone, p.avatar_url as agent_avatar
      FROM task_assignments ta
      JOIN profiles p ON ta.agent_id = p.id
      WHERE ta.task_id = ?
      ORDER BY ta.offered_at ASC
    `).all(taskId);

    const events = db.prepare(`
      SELECT te.*, p.name as actor_name, p.role as actor_role
      FROM task_events te
      LEFT JOIN profiles p ON te.actor_id = p.id
      WHERE te.task_id = ?
      ORDER BY te.created_at ASC
    `).all(taskId);

    const review = db.prepare(`
      SELECT r.*, c.name as customer_name 
      FROM reviews r
      JOIN profiles c ON r.customer_id = c.id
      WHERE r.task_id = ?
    `).get(taskId);

    res.json({
      task: {
        ...task,
        photos: task.photos ? JSON.parse(task.photos) : [],
      },
      assignments: assignments.map((a: any) => ({
        ...a,
        score_breakdown: a.score_breakdown ? JSON.parse(a.score_breakdown) : null,
      })),
      events: events.map((e: any) => ({
        ...e,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
      })),
      review,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// TASK ALLOCATION / AGENT ACTIONS
// ----------------------------------------------------------------------

// Get current active offer for logged-in agent
app.get('/api/agent/active-offer', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only agents have task offers' });
    }

    if (hasSupabaseConfig && supabaseAdmin) {
      const offer = await getSupabaseActiveOffer(req.user.id);
      if (!offer) return res.json({ offer: null });
      return res.json({
        offer: {
          ...offer,
          score_breakdown: offer.score_breakdown || null,
          title: offer.task?.title,
          description: offer.task?.description,
          category: offer.task?.category,
          pickup_location: offer.task?.pickup_location,
          pickup_latitude: offer.task?.pickup_latitude,
          pickup_longitude: offer.task?.pickup_longitude,
          destination_location: offer.task?.destination_location,
          budget: offer.task?.budget,
          priority: offer.task?.priority,
          preferred_time: offer.task?.preferred_time,
          customer_name: offer.task?.customer?.name,
          customer_rating: offer.task?.customer?.rating,
        },
      });
    }

    const offer = db.prepare(`
      SELECT ta.*, t.title, t.description, t.category, t.pickup_location,
             t.pickup_latitude, t.pickup_longitude, t.destination_location,
             t.budget, t.priority, t.preferred_time, c.name as customer_name,
             c.rating as customer_rating
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN profiles c ON t.customer_id = c.id
      WHERE ta.agent_id = ? AND ta.status = 'OFFERED' AND t.status = 'OFFERED'
      ORDER BY ta.offered_at DESC
      LIMIT 1
    `).get(req.user.id) as any;

    if (!offer) return res.json({ offer: null });

    res.json({
      offer: {
        ...offer,
        score_breakdown: offer.score_breakdown ? JSON.parse(offer.score_breakdown) : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent accepts task
app.post('/api/tasks/:id/accept', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only agents can accept tasks' });
    }

    const result = await handleAgentAccept(req.params.id, req.user.id);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent rejects task offer -> Trigger auto-reassignment!
app.post('/api/tasks/:id/reject', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only agents can reject task offers' });
    }

    const result = await handleAgentReject(req.params.id, req.user.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MANDATORY: Agent cancels task AFTER acceptance -> Triggers auto-reassignment!
app.post('/api/tasks/:id/agent-cancel', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only assigned agents can cancel accepted tasks' });
    }

    const { reason } = req.body;
    const result = await handleAgentCancelAfterAccept(req.params.id, req.user.id, reason);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent updates task status: IN_PROGRESS -> COMPLETED
app.post('/api/tasks/:id/status', authenticateToken, async (req: any, res) => {
  try {
    const taskId = req.params.id;
    const { status, proof_of_completion_url, completion_notes } = req.body;
    const agentId = req.user.id;

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.assigned_agent_id !== agentId && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'You are not assigned to this task' });
      }

      const validStatuses = ['IN_PROGRESS', 'COMPLETED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status transition' });
      }

      await updateSupabaseTaskStatus(taskId, {
        status,
        proof_of_completion_url: proof_of_completion_url || task.proof_of_completion_url,
        completion_notes: completion_notes || task.completion_notes,
      });
      const desc = status === 'IN_PROGRESS'
        ? 'Agent started working on the task and is en route.'
        : 'Agent marked the task as completed. Proof submitted.';
      await insertSupabaseTaskEvent(taskId, agentId, 'STATUS_CHANGED', desc);
      const notifTitle = status === 'IN_PROGRESS' ? 'Task in Progress' : 'Task Completed!';
      const notifMsg = status === 'IN_PROGRESS'
        ? 'Your agent is actively fulfilling your task.'
        : 'Your agent has completed your task! Please verify and confirm.';
      await insertSupabaseNotification(task.customer_id, taskId, 'STATUS_UPDATE', notifTitle, notifMsg);
      if (status === 'COMPLETED') {
        detectSuspiciousActivity({ userId: agentId, role: 'AGENT', eventType: 'COMPLETION', taskId });
      }
      broadcastEvent({ type: 'TASK_UPDATED', payload: { taskId, status } });
      return res.json({ success: true, status });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.assigned_agent_id !== agentId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const validStatuses = ['IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const eventId = uuidv4();
    const notifId = uuidv4();

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks 
        SET status = ?, 
            proof_of_completion_url = COALESCE(?, proof_of_completion_url),
            completion_notes = COALESCE(?, completion_notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, proof_of_completion_url || null, completion_notes || null, taskId);

      const desc = status === 'IN_PROGRESS' 
        ? 'Agent started working on the task and is en route.' 
        : 'Agent marked the task as completed. Proof submitted.';

      db.prepare(`
        INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
        VALUES (?, ?, ?, 'STATUS_CHANGED', ?, CURRENT_TIMESTAMP)
      `).run(eventId, taskId, agentId, desc);

      const notifTitle = status === 'IN_PROGRESS' ? 'Task in Progress' : 'Task Completed!';
      const notifMsg = status === 'IN_PROGRESS' 
        ? 'Your agent is actively fulfilling your task.' 
        : 'Your agent has completed your task! Please verify and confirm.';

      db.prepare(`
        INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
        VALUES (?, ?, ?, 'STATUS_UPDATE', ?, ?, CURRENT_TIMESTAMP)
      `).run(notifId, task.customer_id, taskId, notifTitle, notifMsg);
    });

    updateTx();

    if (status === 'COMPLETED') {
      detectSuspiciousActivity({
        userId: agentId,
        role: 'AGENT',
        eventType: 'COMPLETION',
        taskId,
      });
    }

    broadcastEvent({
      type: 'TASK_UPDATED',
      payload: { taskId, status },
    });

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer confirms completion
app.post('/api/tasks/:id/confirm', authenticateToken, async (req: any, res) => {
  try {
    const taskId = req.params.id;

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only the task owner can confirm completion' });
      }

      await supabaseAdmin.from('tasks').update({ status: 'CONFIRMED', updated_at: new Date().toISOString() }).eq('id', taskId);
      if (task.assigned_agent_id) {
        const { data: agentProfile } = await supabaseAdmin.from('profiles').select('active_task_count, total_completed_tasks').eq('id', task.assigned_agent_id).maybeSingle();
        await supabaseAdmin.from('profiles').update({
          active_task_count: Math.max(0, Number(agentProfile?.active_task_count || 0) - 1),
          total_completed_tasks: Number(agentProfile?.total_completed_tasks || 0) + 1,
        }).eq('id', task.assigned_agent_id);
        await insertSupabaseNotification(task.assigned_agent_id, taskId, 'COMPLETED', 'Completion Confirmed', 'Customer confirmed task completion. Payment released to your earnings!');
      }
      await insertSupabaseTaskEvent(taskId, req.user.id, 'CONFIRMED', 'Customer confirmed completion. Task finalized successfully.');
      const pointsResult = awardCustomerTaskCompletionPoints({ customerId: task.customer_id, taskId, completedOnTime: true });
      broadcastEvent({ type: 'TASK_UPDATED', payload: { taskId, status: 'CONFIRMED', pointsAwarded: pointsResult.pointsAwarded, newTier: pointsResult.newTier } });
      return res.json({ success: true, status: 'CONFIRMED', pointsAwarded: pointsResult.pointsAwarded, newTier: pointsResult.newTier, totalPoints: pointsResult.totalPoints });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only the task owner can confirm completion' });
    }

    const eventId = uuidv4();
    const notifId = uuidv4();

    const confirmTx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks 
        SET status = 'CONFIRMED', payment_status = 'RELEASED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(taskId);

      if (task.assigned_agent_id) {
        db.prepare(`
          UPDATE profiles 
          SET active_task_count = MAX(0, active_task_count - 1),
              total_completed_tasks = total_completed_tasks + 1
          WHERE id = ?
        `).run(task.assigned_agent_id);

        db.prepare(`
          INSERT INTO notifications (id, user_id, task_id, type, title, message, created_at)
          VALUES (?, ?, ?, 'COMPLETED', 'Completion Confirmed', 'Customer confirmed task completion. Payment released to your earnings!', CURRENT_TIMESTAMP)
        `).run(notifId, task.assigned_agent_id, taskId);
      }

      db.prepare(`
        INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
        VALUES (?, ?, ?, 'CONFIRMED', 'Customer confirmed completion. Task finalized successfully.', CURRENT_TIMESTAMP)
      `).run(eventId, taskId, req.user.id);
    });

    confirmTx();

    const pointsResult = awardCustomerTaskCompletionPoints({
      customerId: task.customer_id,
      taskId,
      completedOnTime: true,
    });

    broadcastEvent({
      type: 'TASK_UPDATED',
      payload: { taskId, status: 'CONFIRMED', pointsAwarded: pointsResult.pointsAwarded, newTier: pointsResult.newTier },
    });

    res.json({
      success: true,
      status: 'CONFIRMED',
      pointsAwarded: pointsResult.pointsAwarded,
      newTier: pointsResult.newTier,
      totalPoints: pointsResult.totalPoints,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer reviews agent
app.post('/api/tasks/:id/review', authenticateToken, async (req: any, res) => {
  try {
    const taskId = req.params.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (!task.assigned_agent_id) return res.status(400).json({ error: 'No agent assigned to review' });

      const reviewResult = await upsertSupabaseReview(taskId, req.user.id, task.assigned_agent_id, Number(rating), comment || '');
      if (!reviewResult) throw new Error('Review write failed');

      const avgRating = await getSupabaseAgentAverageRating(task.assigned_agent_id);
      if (avgRating !== null) {
        await supabaseAdmin.from('profiles').update({ rating: avgRating }).eq('id', task.assigned_agent_id);
      }

      broadcastEvent({ type: 'REVIEW_SUBMITTED', payload: { taskId, agentId: task.assigned_agent_id, rating } });
      return res.status(201).json({ success: true, message: 'Review recorded' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.assigned_agent_id) {
      return res.status(400).json({ error: 'No agent assigned to review' });
    }

    const reviewId = uuidv4();

    const reviewTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO reviews (id, task_id, customer_id, agent_id, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(reviewId, taskId, req.user.id, task.assigned_agent_id, rating, comment || '');

      const avg = db.prepare(`
        SELECT AVG(rating) as avg_rating, COUNT(id) as total_reviews
        FROM reviews 
        WHERE agent_id = ?
      `).get(task.assigned_agent_id) as any;

      if (avg && avg.avg_rating) {
        db.prepare('UPDATE profiles SET rating = ? WHERE id = ?')
          .run(Number(avg.avg_rating.toFixed(2)), task.assigned_agent_id);
      }
    });

    reviewTx();

    broadcastEvent({
      type: 'REVIEW_SUBMITTED',
      payload: { taskId, agentId: task.assigned_agent_id, rating },
    });

    res.status(201).json({ success: true, message: 'Review recorded' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer cancels task
app.post('/api/tasks/:id/cancel', authenticateToken, async (req: any, res) => {
  try {
    const taskId = req.params.id;

    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (task.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Not authorized to cancel this task' });
      }
      if (['COMPLETED', 'CONFIRMED', 'CANCELLED'].includes(task.status)) {
        return res.status(400).json({ error: `Cannot cancel a task in ${task.status} status` });
      }

      await supabaseAdmin.from('tasks').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', taskId);
      if (task.assigned_agent_id) {
        await supabaseAdmin.from('profiles').update({ active_task_count: Math.max(0, Number(task.active_task_count || 0) - 1) }).eq('id', task.assigned_agent_id);
      }
      await supabaseAdmin.from('task_assignments').update({ status: 'CANCELLED', responded_at: new Date().toISOString() }).eq('task_id', taskId).eq('status', 'OFFERED');
      await insertSupabaseTaskEvent(taskId, req.user.id, 'CANCELLED', 'Task cancelled by customer.');
      broadcastEvent({ type: 'TASK_UPDATED', payload: { taskId, status: 'CANCELLED' } });
      return res.json({ success: true, status: 'CANCELLED' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to cancel this task' });
    }

    if (['COMPLETED', 'CONFIRMED', 'CANCELLED'].includes(task.status)) {
      return res.status(400).json({ error: `Cannot cancel a task in ${task.status} status` });
    }

    const cancelTx = db.transaction(() => {
      db.prepare(`UPDATE tasks SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(taskId);

      if (task.assigned_agent_id) {
        db.prepare(`UPDATE profiles SET active_task_count = MAX(0, active_task_count - 1) WHERE id = ?`).run(task.assigned_agent_id);
      }

      db.prepare(`UPDATE task_assignments SET status = 'CANCELLED' WHERE task_id = ? AND status = 'OFFERED'`).run(taskId);

      const eventId = uuidv4();
      db.prepare(`
        INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
        VALUES (?, ?, ?, 'CANCELLED', 'Task cancelled by customer.', CURRENT_TIMESTAMP)
      `).run(eventId, taskId, req.user.id);
    });

    cancelTx();

    broadcastEvent({
      type: 'TASK_UPDATED',
      payload: { taskId, status: 'CANCELLED' },
    });

    res.json({ success: true, status: 'CANCELLED' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trust & Safety: Dispute / Report Issue
app.post('/api/tasks/:id/report', authenticateToken, (req: any, res) => {
  try {
    const taskId = req.params.id;
    const { category, description } = req.body;
    if (!category || !description) {
      return res.status(400).json({ error: 'Category and description are required' });
    }

    const reportId = uuidv4();
    db.prepare(`
      INSERT INTO reports (id, task_id, reporter_id, reporter_role, category, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reportId, taskId, req.user.id, req.user.role, category, description);

    // Event log
    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO task_events (id, task_id, actor_id, event_type, description, created_at)
      VALUES (?, ?, ?, 'STATUS_CHANGED', ?, CURRENT_TIMESTAMP)
    `).run(eventId, taskId, req.user.id, `Report filed: [${category}] ${description}`);

    broadcastEvent({
      type: 'REPORT_FILED',
      payload: { reportId, taskId, reporterRole: req.user.role, category },
    });

    res.status(201).json({ success: true, reportId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// ADMIN ROUTES
// ----------------------------------------------------------------------

app.get('/api/admin/stats', authenticateToken, (req: any, res) => {
  try {
    const totalCustomers = db.prepare("SELECT COUNT(id) as count FROM profiles WHERE role = 'CUSTOMER'").get() as any;
    const totalAgents = db.prepare("SELECT COUNT(id) as count FROM profiles WHERE role = 'AGENT'").get() as any;
    const activeAgents = db.prepare("SELECT COUNT(id) as count FROM profiles WHERE role = 'AGENT' AND is_available = 1").get() as any;
    const activeTasks = db.prepare("SELECT COUNT(id) as count FROM tasks WHERE status IN ('ACCEPTED', 'IN_PROGRESS')").get() as any;
    const matchingTasks = db.prepare("SELECT COUNT(id) as count FROM tasks WHERE status IN ('POSTED', 'MATCHING', 'OFFERED', 'REASSIGNING')").get() as any;
    const completedTasks = db.prepare("SELECT COUNT(id) as count FROM tasks WHERE status IN ('COMPLETED', 'CONFIRMED')").get() as any;
    const cancelledTasks = db.prepare("SELECT COUNT(id) as count FROM tasks WHERE status = 'CANCELLED'").get() as any;
    const totalValue = db.prepare("SELECT SUM(budget) as total FROM tasks WHERE status IN ('COMPLETED', 'CONFIRMED')").get() as any;

    res.json({
      stats: {
        totalCustomers: totalCustomers.count,
        totalAgents: totalAgents.count,
        activeAgents: activeAgents.count,
        activeTasks: activeTasks.count,
        matchingTasks: matchingTasks.count,
        completedTasks: completedTasks.count,
        cancelledTasks: cancelledTasks.count,
        totalTaskValue: totalValue.total || 0,
        avgCompletionTimeMinutes: 24,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset demo environment
app.post('/api/admin/reset', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can reset demo data' });
    }

    const resetTx = db.transaction(() => {
      db.exec(`
        DELETE FROM reports;
        DELETE FROM agent_locations;
        DELETE FROM reviews;
        DELETE FROM notifications;
        DELETE FROM task_events;
        DELETE FROM task_assignments;
        DELETE FROM tasks;
        DELETE FROM fraud_alerts;
        DELETE FROM agent_verifications;
        DELETE FROM wallet_transactions;
        DELETE FROM customer_wallets;
      `);
      db.prepare("UPDATE profiles SET active_task_count = 0, is_available = 1, suspicious_flag = 0 WHERE role = 'AGENT'").run();
      seedDemoData();
    });

    resetTx();

    broadcastEvent({ type: 'DEMO_RESET', payload: {} });

    res.json({ success: true, message: 'Demo environment reset to pristine state with AI features restored.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// CUSTOMER WALLET & REWARDS ROUTES
// ----------------------------------------------------------------------

app.get('/api/wallet/me', authenticateToken, (req: any, res) => {
  try {
    const wallet = getOrCreateCustomerWallet(req.user.id);
    const transactions = db.prepare(`
      SELECT * FROM wallet_transactions 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT 30
    `).all(req.user.id);

    res.json({ wallet, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AGENT AI VERIFICATION ROUTES
// ----------------------------------------------------------------------

app.post('/api/agent/verification/evaluate', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only agents can evaluate verification' });
    }
    const assessment = runAgentVerificationCheck(req.user.id);
    res.json({ assessment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/verifications', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const verifications = db.prepare(`
      SELECT v.*, p.name as agent_name, p.email as agent_email, p.phone as agent_phone,
             p.rating as agent_rating, p.avatar_url as agent_avatar, p.experience_years, 
             p.skills, p.verification_status as current_status
      FROM agent_verifications v
      JOIN profiles p ON v.agent_id = p.id
      ORDER BY v.created_at DESC
    `).all();

    res.json({
      verifications: verifications.map((v: any) => ({
        ...v,
        breakdown: v.breakdown ? JSON.parse(v.breakdown) : null,
        skills: v.skills ? JSON.parse(v.skills) : [],
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/verifications/:id/review', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { agentId, status, notes } = req.body;
    const result = adminReviewVerification({
      agentId,
      status,
      adminId: req.user.id,
      adminNotes: notes || 'Admin verified',
    });

    broadcastEvent({
      type: 'AGENT_PROFILE_UPDATED',
      payload: { agentId, verification_status: status },
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AI MATCHING CONFIG & COMPENSATION POLICY
// ----------------------------------------------------------------------

app.get('/api/admin/ai-weights', authenticateToken, (req: any, res) => {
  try {
    const weights = getMatchingWeights();
    res.json({ weights });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/ai-weights', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const weights = req.body;
    db.prepare("INSERT OR REPLACE INTO platform_settings (key, value, updated_at) VALUES ('ai_matching_weights', ?, CURRENT_TIMESTAMP)")
      .run(JSON.stringify(weights));

    res.json({ success: true, weights });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/compensation-policy', authenticateToken, (req: any, res) => {
  try {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'compensation_policy'").get() as any;
    const policy = row ? JSON.parse(row.value) : {
      fullRefundPercent: 100,
      serviceCreditAmount: 50,
      compensationPoints: 100,
      autoRefundUnassigned: true,
      searchTimeoutSeconds: 60,
      maxRadiusKm: 25,
    };
    res.json({ policy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/compensation-policy', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const policy = req.body;
    db.prepare("INSERT OR REPLACE INTO platform_settings (key, value, updated_at) VALUES ('compensation_policy', ?, CURRENT_TIMESTAMP)")
      .run(JSON.stringify(policy));

    res.json({ success: true, policy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AI FRAUD RADAR ROUTES
// ----------------------------------------------------------------------

app.get('/api/admin/fraud-alerts', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const alerts = db.prepare(`
      SELECT f.*, p.name as user_name, p.role as user_role, p.email as user_email
      FROM fraud_alerts f
      JOIN profiles p ON f.user_id = p.id
      ORDER BY f.created_at DESC
      LIMIT 50
    `).all();

    res.json({ alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fraud-alerts/:id/resolve', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { action, notes } = req.body;
    const result = resolveFraudAlert(req.params.id, action, notes);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// DUAL AI ASSISTANTS (CUSTOMER & AGENT)
// ----------------------------------------------------------------------

app.post('/api/ai/customer-assistant', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Customer assistant is only available to customers' });
    }
    const { query } = req.body;
    if (typeof query !== 'string' || !query.trim()) return res.status(400).json({ error: 'Query is required' });
    const result = handleCustomerAssistantQuery({ customerId: req.user.id, query });
    res.json(result);
  } catch (err: any) {
    console.error('Customer assistant error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/agent-assistant', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Agent assistant is only available to agents' });
    }
    const { query } = req.body;
    if (typeof query !== 'string' || !query.trim()) return res.status(400).json({ error: 'Query is required' });
    const result = handleAgentAssistantQuery({ agentId: req.user.id, query });
    res.json(result);
  } catch (err: any) {
    console.error('Agent assistant error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AI RECOMMENDATIONS & MULTI-TASK OPTIMIZATION
// ----------------------------------------------------------------------

app.get('/api/ai/recommendations', authenticateToken, (req: any, res) => {
  try {
    const recommendations = getCustomerRecommendations(req.user.id);
    res.json({ recommendations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agent/multi-task-opportunities', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Agents only' });
    }
    const bundles = findMultiTaskOpportunities(req.user.id);
    res.json({ bundles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agent/optimized-route', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Agents only' });
    }
    const route = getOptimizedAgentRoute(req.user.id);
    res.json({ route });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/bundle-accept', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'AGENT') {
      return res.status(403).json({ error: 'Only agents can accept bundled tasks' });
    }
    const result = handleAgentAccept(req.params.id, req.user.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AI SMART REBOOKING
// ----------------------------------------------------------------------

app.post('/api/tasks/:id/rebook', authenticateToken, (req: any, res) => {
  try {
    const { preferredTime, category } = req.body;
    const result = executeSmartRebooking({
      originalTaskId: req.params.id,
      customerId: req.user.id,
      preferredTime,
      category,
    });

    // Run allocation on rebooked task immediately
    runTaskAssignmentEngine(result.newTaskId);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req: any, res) => {
  try {
    if (hasSupabaseConfig && supabaseAdmin) {
      const { data: notifs } = await supabaseAdmin.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(25);
      return res.json({ notifications: notifs || [] });
    }

    const notifs = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 25
    `).all(req.user.id);
    res.json({ notifications: notifs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    if (hasSupabaseConfig && supabaseAdmin) {
      await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
      return res.json({ success: true });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`TaskMate Live Backend Server running on ${HOST}:${PORT}`);
  console.log(`Accessible locally: http://localhost:${PORT}`);
  console.log(`Accessible on LAN:   http://<YOUR_IP>:${PORT}`);
  console.log(`====================================================`);
});
