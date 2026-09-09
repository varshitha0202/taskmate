import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'taskmate.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CUSTOMER', 'AGENT', 'ADMIN')),
      phone TEXT,
      avatar_url TEXT,
      rating REAL DEFAULT 5.0,
      reliability_score REAL DEFAULT 1.0,
      is_available INTEGER DEFAULT 1,
      latitude REAL DEFAULT 17.4435,
      longitude REAL DEFAULT 78.3772,
      address TEXT,
      active_task_count INTEGER DEFAULT 0,
      total_completed_tasks INTEGER DEFAULT 0,
      is_identity_verified INTEGER DEFAULT 1,
      is_phone_verified INTEGER DEFAULT 1,
      vehicle_type TEXT DEFAULT 'Motorcycle',
      completion_rate REAL DEFAULT 0.98,
      response_rate REAL DEFAULT 0.95,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      pickup_location TEXT NOT NULL,
      pickup_latitude REAL NOT NULL,
      pickup_longitude REAL NOT NULL,
      destination_location TEXT,
      destination_latitude REAL,
      destination_longitude REAL,
      budget REAL NOT NULL,
      priority TEXT DEFAULT 'MEDIUM',
      preferred_time TEXT,
      status TEXT NOT NULL DEFAULT 'POSTED',
      assigned_agent_id TEXT,
      proof_of_completion_url TEXT,
      completion_notes TEXT,
      special_instructions TEXT,
      photos TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_agent_id) REFERENCES profiles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      distance_km REAL NOT NULL,
      suitability_score REAL NOT NULL,
      score_breakdown TEXT,
      offered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      reporter_id TEXT NOT NULL,
      reporter_role TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_locations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_wallets (
      customer_id TEXT PRIMARY KEY,
      refund_balance REAL DEFAULT 0.0,
      service_credits REAL DEFAULT 0.0,
      compensation_points INTEGER DEFAULT 0,
      reward_points INTEGER DEFAULT 150,
      priority_tier TEXT DEFAULT 'Regular Customer',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      task_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_verifications (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      ai_score REAL DEFAULT 90.0,
      ai_summary TEXT,
      breakdown TEXT,
      reviewed_by TEXT,
      admin_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      FOREIGN KEY (agent_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_id TEXT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING_REVIEW',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_verif_agent ON agent_verifications(agent_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_alerts(user_id);
  `);

  // Safe migrations for newly added columns if table already existed
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as any[];
  const taskColNames = taskCols.map((c) => c.name);
  if (!taskColNames.includes('special_instructions')) {
    db.exec("ALTER TABLE tasks ADD COLUMN special_instructions TEXT");
  }
  if (!taskColNames.includes('photos')) {
    db.exec("ALTER TABLE tasks ADD COLUMN photos TEXT");
  }
  if (!taskColNames.includes('payment_status')) {
    db.exec("ALTER TABLE tasks ADD COLUMN payment_status TEXT DEFAULT 'PAID_ESCROW'");
  }
  if (!taskColNames.includes('estimated_arrival_minutes')) {
    db.exec("ALTER TABLE tasks ADD COLUMN estimated_arrival_minutes INTEGER DEFAULT 20");
  }
  if (!taskColNames.includes('estimated_completion_minutes')) {
    db.exec("ALTER TABLE tasks ADD COLUMN estimated_completion_minutes INTEGER DEFAULT 45");
  }
  if (!taskColNames.includes('ai_matching_explanation')) {
    db.exec("ALTER TABLE tasks ADD COLUMN ai_matching_explanation TEXT");
  }
  if (!taskColNames.includes('compensation_status')) {
    db.exec("ALTER TABLE tasks ADD COLUMN compensation_status TEXT DEFAULT 'NONE'");
  }
  if (!taskColNames.includes('batch_id')) {
    db.exec("ALTER TABLE tasks ADD COLUMN batch_id TEXT");
  }
  if (!taskColNames.includes('search_radius_km')) {
    db.exec("ALTER TABLE tasks ADD COLUMN search_radius_km REAL DEFAULT 15.0");
  }
  if (!taskColNames.includes('search_attempts')) {
    db.exec("ALTER TABLE tasks ADD COLUMN search_attempts INTEGER DEFAULT 1");
  }

  const profileCols = db.prepare("PRAGMA table_info(profiles)").all() as any[];
  const profileColNames = profileCols.map((c) => c.name);
  if (!profileColNames.includes('is_identity_verified')) {
    db.exec("ALTER TABLE profiles ADD COLUMN is_identity_verified INTEGER DEFAULT 1");
  }
  if (!profileColNames.includes('is_phone_verified')) {
    db.exec("ALTER TABLE profiles ADD COLUMN is_phone_verified INTEGER DEFAULT 1");
  }
  if (!profileColNames.includes('vehicle_type')) {
    db.exec("ALTER TABLE profiles ADD COLUMN vehicle_type TEXT DEFAULT 'Motorcycle'");
  }
  if (!profileColNames.includes('completion_rate')) {
    db.exec("ALTER TABLE profiles ADD COLUMN completion_rate REAL DEFAULT 0.98");
  }
  if (!profileColNames.includes('response_rate')) {
    db.exec("ALTER TABLE profiles ADD COLUMN response_rate REAL DEFAULT 0.95");
  }
  if (!profileColNames.includes('verification_status')) {
    db.exec("ALTER TABLE profiles ADD COLUMN verification_status TEXT DEFAULT 'VERIFIED'");
  }
  if (!profileColNames.includes('verification_score')) {
    db.exec("ALTER TABLE profiles ADD COLUMN verification_score REAL DEFAULT 95.0");
  }
  if (!profileColNames.includes('verification_notes')) {
    db.exec("ALTER TABLE profiles ADD COLUMN verification_notes TEXT");
  }
  if (!profileColNames.includes('skills')) {
    db.exec("ALTER TABLE profiles ADD COLUMN skills TEXT DEFAULT '[\"delivery\",\"documents\",\"shopping\",\"errand\"]'");
  }
  if (!profileColNames.includes('experience_years')) {
    db.exec("ALTER TABLE profiles ADD COLUMN experience_years INTEGER DEFAULT 3");
  }
  if (!profileColNames.includes('max_concurrent_tasks')) {
    db.exec("ALTER TABLE profiles ADD COLUMN max_concurrent_tasks INTEGER DEFAULT 3");
  }
  if (!profileColNames.includes('suspicious_flag')) {
    db.exec("ALTER TABLE profiles ADD COLUMN suspicious_flag INTEGER DEFAULT 0");
  }

  // Seed default platform settings if not present
  const defaultSettings = [
    { key: 'ai_matching_weights', value: JSON.stringify({ distance: 25, skill: 20, availability: 15, reliability: 15, customerPriority: 10, workload: 10, compatibility: 5 }) },
    { key: 'compensation_policy', value: JSON.stringify({ fullRefundPercent: 100, serviceCreditAmount: 50, compensationPoints: 100, autoRefundUnassigned: true, searchTimeoutSeconds: 60, maxRadiusKm: 25 }) },
    { key: 'customer_tier_thresholds', value: JSON.stringify({ newCustomer: 0, regularCustomer: 100, priorityCustomer: 300, trustedCustomer: 600 }) },
  ];

  const insertSetting = db.prepare("INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)");
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }

  // Ensure task_assignments supports CANCELLED_BY_AGENT
  try {
    const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_assignments'").get() as any;
    if (tableSql && tableSql.sql && !tableSql.sql.includes('CANCELLED_BY_AGENT')) {
      db.exec(`
        CREATE TABLE task_assignments_temp (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          status TEXT NOT NULL,
          distance_km REAL NOT NULL,
          suitability_score REAL NOT NULL,
          score_breakdown TEXT,
          offered_at TEXT DEFAULT CURRENT_TIMESTAMP,
          responded_at TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
        INSERT INTO task_assignments_temp SELECT * FROM task_assignments;
        DROP TABLE task_assignments;
        ALTER TABLE task_assignments_temp RENAME TO task_assignments;
        CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
        CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id);
      `);
    }
  } catch (err) {
    console.error('Migration notice:', err);
  }

  console.log('Database tables verified and initialized.');
}
