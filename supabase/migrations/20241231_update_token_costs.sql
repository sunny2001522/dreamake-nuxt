-- 更新 Token 消耗配置
-- 新增 per_second_cost 欄位並更新影片生成費率

-- 1. 新增 per_second_cost 欄位（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'token_costs' AND column_name = 'per_second_cost'
  ) THEN
    ALTER TABLE token_costs ADD COLUMN per_second_cost DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- 2. 刪除舊的 video_generation 配置
DELETE FROM token_costs WHERE operation_type = 'video_generation';

-- 3. 插入新的按模型計費配置
-- WaveSpeed (高品質): 3.8 Token/秒 ≈ 231 Token/分鐘
-- Vidnoz (一般品質): 0.5 Token/秒 ≈ 30 Token/分鐘
INSERT INTO token_costs (operation_type, name, base_cost, per_second_cost, per_minute_cost, max_minutes) VALUES
('video_generation_wavespeed', '高品質影片生成 (WaveSpeed)', 0, 3.8, 231, 10),
('video_generation_vidnoz', '一般品質影片生成 (Vidnoz)', 0, 0.5, 30, 10)
ON CONFLICT (operation_type) DO UPDATE SET
  name = EXCLUDED.name,
  base_cost = EXCLUDED.base_cost,
  per_second_cost = EXCLUDED.per_second_cost,
  per_minute_cost = EXCLUDED.per_minute_cost,
  max_minutes = EXCLUDED.max_minutes;

-- 4. 更新其他操作的 per_second_cost 為 0（明確設定）
UPDATE token_costs
SET per_second_cost = 0
WHERE operation_type IN ('voice_tts', 'voice_clone', 'transcript_generate', 'subtitle_generate');
