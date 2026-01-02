-- 將免費方案 Token 從 30 改回 100
UPDATE subscription_plans
SET tokens_monthly = 100
WHERE code = 'free';
