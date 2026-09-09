-- TaskMate Supabase PostgreSQL Schema & Migrations
-- Complete Production Database Setup with Row Level Security & Realtime

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
      'POSTED',
      'MATCHING',
      'OFFERED',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
      'CONFIRMED',
      'CANCELLED',
      'NO_AGENT_AVAILABLE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE assignment_status AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    phone TEXT,
    avatar_url TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    reliability_score NUMERIC(3, 2) DEFAULT 1.00,
    is_available BOOLEAN DEFAULT TRUE,
    latitude NUMERIC(10, 7) DEFAULT 17.4435000,
    longitude NUMERIC(10, 7) DEFAULT 78.3772000,
    address TEXT,
    active_task_count INTEGER DEFAULT 0,
    total_completed_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    pickup_location TEXT NOT NULL,
    pickup_latitude NUMERIC(10, 7) NOT NULL,
    pickup_longitude NUMERIC(10, 7) NOT NULL,
    destination_location TEXT,
    destination_latitude NUMERIC(10, 7),
    destination_longitude NUMERIC(10, 7),
    budget NUMERIC(10, 2) NOT NULL,
    priority task_priority DEFAULT 'MEDIUM',
    preferred_time TEXT,
    status task_status DEFAULT 'POSTED',
    assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    proof_of_completion_url TEXT,
    completion_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. TASK ASSIGNMENTS (Maintains full assignment history)
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status assignment_status NOT NULL DEFAULT 'OFFERED',
    distance_km NUMERIC(8, 2) NOT NULL,
    suitability_score NUMERIC(6, 2) NOT NULL,
    score_breakdown JSONB,
    offered_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    responded_at TIMESTAMPTZ
);

-- 6. TASK EVENTS (Lifecycle audit log)
CREATE TABLE IF NOT EXISTS public.task_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 7. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 8. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON public.tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON public.tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON public.task_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_events_task ON public.task_events(task_id);

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can read basic profile info; user or admin can update
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Tasks: Customer can view their tasks; Agents can view offered/assigned/matching tasks; Admin can view all
CREATE POLICY "Tasks readable by customers, assigned agents, and admins" 
ON public.tasks FOR SELECT TO authenticated USING (
    customer_id = auth.uid() OR 
    assigned_agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'AGENT'))
);

CREATE POLICY "Customers can create tasks" 
ON public.tasks FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers and assigned agents can update tasks" 
ON public.tasks FOR UPDATE TO authenticated USING (
    customer_id = auth.uid() OR 
    assigned_agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Task Assignments:
CREATE POLICY "Assignments viewable by involved agent, task customer, or admin" 
ON public.task_assignments FOR SELECT TO authenticated USING (
    agent_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_assignments.task_id AND tasks.customer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Notifications:
CREATE POLICY "Users can view and update own notifications" 
ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid());

-- Reviews:
CREATE POLICY "Reviews viewable by authenticated users" 
ON public.reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers can create reviews" 
ON public.reviews FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

-- Enable Realtime Replication for Supabase Realtime
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_events;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
    WHEN others THEN null;
END $$;
