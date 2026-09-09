import bcrypt from 'bcryptjs';
import { db } from './db.js';

export function seedDemoData() {
  const passwordHash = bcrypt.hashSync('TaskMate@123', 10);

  const demoUsers = [
    {
      id: 'usr_cust_1',
      name: 'Rahul Sharma',
      email: 'customer@taskmate.com',
      password_hash: passwordHash,
      role: 'CUSTOMER',
      phone: '+91 98765 43210',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      reliability_score: 1.0,
      is_available: 1,
      latitude: 17.4435,
      longitude: 78.3772,
      address: 'Hitech City, Hyderabad, Telangana',
      active_task_count: 0,
      total_completed_tasks: 12,
    },
    {
      id: 'usr_agent_a',
      name: 'Vikram Singh (Agent A)',
      email: 'agent.a@taskmate.com',
      password_hash: passwordHash,
      role: 'AGENT',
      phone: '+91 98765 11111',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      reliability_score: 0.98,
      is_available: 1,
      latitude: 17.4485,
      longitude: 78.3908, // ~1.8 km from Hitech City
      address: 'Madhapur Main Rd, Hyderabad',
      active_task_count: 0,
      total_completed_tasks: 45,
      verification_status: 'VERIFIED',
      verification_score: 96.5,
      verification_notes: 'AI verified: Government ID verified, 100% phone match, 45 completed tasks, zero safety flags.',
      skills: JSON.stringify(['documents', 'delivery', 'shopping', 'errand']),
      experience_years: 4,
      max_concurrent_tasks: 3,
    },
    {
      id: 'usr_agent_b',
      name: 'Priya Patel (Agent B)',
      email: 'agent.b@taskmate.com',
      password_hash: passwordHash,
      role: 'AGENT',
      phone: '+91 98765 22222',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      rating: 4.7,
      reliability_score: 0.95,
      is_available: 1,
      latitude: 17.4612,
      longitude: 78.3582, // ~3.5 km from Hitech City
      address: 'Kondapur Near Botanical Garden, Hyderabad',
      active_task_count: 0,
      total_completed_tasks: 38,
      verification_status: 'VERIFIED',
      verification_score: 93.0,
      verification_notes: 'AI verified: High customer satisfaction, express grocery & document skills, verified driving license.',
      skills: JSON.stringify(['delivery', 'shopping', 'grocery', 'errand', 'home_help']),
      experience_years: 3,
      max_concurrent_tasks: 3,
    },
    {
      id: 'usr_agent_c',
      name: 'Arjun Reddy (Agent C)',
      email: 'agent.c@taskmate.com',
      password_hash: passwordHash,
      role: 'AGENT',
      phone: '+91 98765 33333',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      rating: 4.8,
      reliability_score: 0.92,
      is_available: 1,
      latitude: 17.4399,
      longitude: 78.3489, // ~6.2 km from Hitech City
      address: 'Gachibowli Stadium Rd, Hyderabad',
      active_task_count: 0,
      total_completed_tasks: 29,
      verification_status: 'VERIFIED',
      verification_score: 91.5,
      verification_notes: 'AI verified: Technical hardware & repairs specialist, verified criminal background clearance.',
      skills: JSON.stringify(['repair', 'digital', 'delivery', 'home_help']),
      experience_years: 5,
      max_concurrent_tasks: 2,
    },
    {
      id: 'usr_agent_pending',
      name: 'Deepak Varma (Applicant)',
      email: 'deepak.applicant@taskmate.com',
      password_hash: passwordHash,
      role: 'AGENT',
      phone: '+91 98765 44444',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      rating: 5.0,
      reliability_score: 1.0,
      is_available: 1,
      latitude: 17.4250,
      longitude: 78.4100,
      address: 'Jubilee Hills Rd 36, Hyderabad',
      active_task_count: 0,
      total_completed_tasks: 0,
      verification_status: 'PENDING',
      verification_score: 78.0,
      verification_notes: 'AI assessment: Profile complete, Aadhar submitted, phone verified. Pending admin credential check.',
      skills: JSON.stringify(['delivery', 'errand']),
      experience_years: 1,
      max_concurrent_tasks: 2,
    },
    {
      id: 'usr_admin_1',
      name: 'Suresh Kumar (Admin)',
      email: 'admin@taskmate.com',
      password_hash: passwordHash,
      role: 'ADMIN',
      phone: '+91 98765 99999',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      rating: 5.0,
      reliability_score: 1.0,
      is_available: 1,
      latitude: 17.4435,
      longitude: 78.3772,
      address: 'TaskMate Operations HQ, Cyber Towers, Hyderabad',
      active_task_count: 0,
      total_completed_tasks: 0,
      verification_status: 'VERIFIED',
      verification_score: 100.0,
      verification_notes: 'System Root Administrator',
      skills: JSON.stringify(['all']),
      experience_years: 10,
      max_concurrent_tasks: 10,
    },
  ];

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO profiles (
      id, name, email, password_hash, role, phone, avatar_url, rating,
      reliability_score, is_available, latitude, longitude, address,
      active_task_count, total_completed_tasks, verification_status,
      verification_score, verification_notes, skills, experience_years,
      max_concurrent_tasks
    ) VALUES (
      @id, @name, @email, @password_hash, @role, @phone, @avatar_url, @rating,
      @reliability_score, @is_available, @latitude, @longitude, @address,
      @active_task_count, @total_completed_tasks, @verification_status,
      @verification_score, @verification_notes, @skills, @experience_years,
      @max_concurrent_tasks
    )
  `);

  const seedTx = db.transaction(() => {
    for (const u of demoUsers) {
      insertUser.run({
        ...u,
        verification_status: u.verification_status || 'VERIFIED',
        verification_score: u.verification_score || 95.0,
        verification_notes: u.verification_notes || 'Verified',
        skills: u.skills || JSON.stringify(['delivery', 'documents']),
        experience_years: u.experience_years || 2,
        max_concurrent_tasks: u.max_concurrent_tasks || 3,
      });
    }

    // Seed customer wallet for Rahul
    db.prepare(`
      INSERT OR REPLACE INTO customer_wallets (
        customer_id, refund_balance, service_credits, compensation_points, reward_points, priority_tier
      ) VALUES (?, 0.0, 50.0, 0, 175, 'Regular Customer')
    `).run('usr_cust_1');

    // Seed initial transaction for reward history
    db.prepare(`
      INSERT OR IGNORE INTO wallet_transactions (id, customer_id, type, amount, description, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run('tx_init_1', 'usr_cust_1', 'REWARD_POINTS', 175, 'Welcome & past task completion rewards');

    // Seed agent verification request for pending applicant
    db.prepare(`
      INSERT OR REPLACE INTO agent_verifications (
        id, agent_id, status, ai_score, ai_summary, breakdown, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      'verif_req_1',
      'usr_agent_pending',
      'PENDING',
      78.0,
      'Profile 95% complete. Phone verified. Identity document matched. New applicant requiring Admin review.',
      JSON.stringify({
        profileCompleteness: 95,
        identityVerified: true,
        phoneVerified: true,
        experienceScore: 70,
        historicalRatingScore: 80,
        fraudRiskScore: 92,
      })
    );
  });

  seedTx();
  console.log('Seed demo data populated successfully: Accounts, Wallets & AI verification ready.');
}
