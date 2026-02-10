-- ==========================================
-- 1. DROP EXISTING TABLES (Reset)
-- ==========================================
DROP TABLE IF EXISTS reward_redemptions;
DROP TABLE IF EXISTS user_points;
DROP TABLE IF EXISTS task_logs;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS video_calls;
DROP TABLE IF EXISTS rewards;
DROP TABLE IF EXISTS users;

-- ==========================================
-- 2. CREATE CORE TABLES
-- ==========================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255), -- Added column
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'client', 'admin')),
    profile_image_url TEXT,
    accessibility_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards Table
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    cost_points INTEGER NOT NULL,
    stock INTEGER,
    fulfilment_type VARCHAR(20) NOT NULL DEFAULT 'pickup',
    pickup_location VARCHAR(255),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT rewards_cost_points_check CHECK (cost_points > 0),
    CONSTRAINT rewards_stock_check CHECK (stock >= 0)
);

-- ==========================================
-- 3. CREATE DEPENDENT TABLES
-- ==========================================

-- Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    created_by VARCHAR(20) DEFAULT 'user',
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    day_of_week INTEGER NOT NULL,
    time_slot TIME,
    category VARCHAR(50) DEFAULT 'general',
    is_routine BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reward Redemptions Table
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    points_spent INTEGER NOT NULL,
    fulfilment_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    recipient_name VARCHAR(120),
    recipient_phone VARCHAR(30),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    postal_code VARCHAR(20),
    recipient_email VARCHAR(255),
    voucher_code VARCHAR(50),
    redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT reward_redemptions_points_spent_check CHECK (points_spent > 0),
    CONSTRAINT reward_redemptions_quantity_check CHECK (quantity > 0)
);

-- Task Logs Table
CREATE TABLE IF NOT EXISTS task_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'done',
    notes TEXT
);

-- User Points Table
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason VARCHAR(255),
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Video Calls Table
CREATE TABLE IF NOT EXISTS video_calls (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id),
    client_id INTEGER REFERENCES users(id) NOT NULL,
    room_url TEXT,
    host_url TEXT,
    call_type VARCHAR(20) CHECK (call_type IN ('checkin', 'emergency')),
    scheduled_time TIMESTAMP,
    emergency_reason TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'urgent', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- ==========================================
-- 4. INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);

---

-- Insert Test Users
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('staff_admin', 'admin@example.com', 'staff123', 'Staff Admin', 'staff'),
('alex_client', 'alex@example.com', 'client123', 'Alex Chen', 'client')
ON CONFLICT (username) DO NOTHING;