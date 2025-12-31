-- DreaMake 訂閱方案資料表
-- 執行此 SQL 於 Supabase SQL Editor

-- 1. 訂閱方案表
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  tokens_monthly INTEGER NOT NULL,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用戶訂閱表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  plan_code VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(20) DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  fanbar_subscription_id VARCHAR(255),
  fanbar_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Token 餘額表
CREATE TABLE IF NOT EXISTS token_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  tokens_used_this_period INTEGER DEFAULT 0,
  tokens_granted_this_period INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Token 交易記錄表
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  operation_type VARCHAR(50),
  operation_id VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Token 消耗配置表
CREATE TABLE IF NOT EXISTS token_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  base_cost INTEGER NOT NULL,
  per_second_cost DECIMAL(10,2) DEFAULT 0,
  per_minute_cost INTEGER DEFAULT 0,
  max_minutes INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at DESC);

-- 插入初始方案資料
-- 免費方案：30 Token 永久額度（不會每月重置）
INSERT INTO subscription_plans (code, name, price, tokens_monthly, features, sort_order) VALUES
('free', '免費方案', 0, 30, '["AI 語音生成", "AI 頭像說話", "基礎字幕", "720p 輸出"]', 0),
('creator', '創作者方案', 899, 1000, '["所有免費功能", "語音克隆", "進階字幕樣式", "1080p HD 輸出", "優先處理"]', 10)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  tokens_monthly = EXCLUDED.tokens_monthly,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- 插入 Token 消耗配置
-- 影片生成：按秒計費，WaveSpeed 3.8 Token/秒，Vidnoz 0.5 Token/秒
INSERT INTO token_costs (operation_type, name, base_cost, per_second_cost, per_minute_cost, max_minutes) VALUES
('video_generation_wavespeed', '高品質影片生成 (WaveSpeed)', 0, 3.8, 231, 10),
('video_generation_vidnoz', '一般品質影片生成 (Vidnoz)', 0, 0.5, 30, 10),
('voice_tts', '語音合成', 3, 0, 2, 10),
('voice_clone', '語音克隆', 15, 0, 0, 0),
('transcript_generate', '腳本生成', 3, 0, 0, 0),
('subtitle_generate', '字幕生成', 2, 0, 0, 0)
ON CONFLICT (operation_type) DO UPDATE SET
  name = EXCLUDED.name,
  base_cost = EXCLUDED.base_cost,
  per_second_cost = EXCLUDED.per_second_cost,
  per_minute_cost = EXCLUDED.per_minute_cost,
  max_minutes = EXCLUDED.max_minutes;

-- 啟用 RLS (Row Level Security)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- subscription_plans: 所有人可讀取（公開資料）
CREATE POLICY "subscription_plans_select_all" ON subscription_plans
  FOR SELECT USING (true);

-- token_costs: 所有人可讀取（公開配置）
CREATE POLICY "token_costs_select_all" ON token_costs
  FOR SELECT USING (true);

-- user_subscriptions: Service Role 完全存取（後端 API 使用）
-- 注意：使用 Service Role Key 的請求會繞過 RLS，此處僅為文件說明

-- token_balances: Service Role 完全存取
-- token_transactions: Service Role 完全存取
