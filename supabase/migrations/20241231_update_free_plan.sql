-- 更新免費方案配置
-- 1. Token 從 100 改為 30
-- 2. 免費方案 Token 永久有效（不會每月重置）

-- 更新免費方案的 Token 配額為 30
UPDATE subscription_plans
SET tokens_monthly = 30
WHERE code = 'free';
