-- ============================================
-- Segmented Video Generation Tables
-- ============================================

-- 分段生成任務主表
CREATE TABLE IF NOT EXISTS segmented_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- 使用 TEXT 以支援 CMoney email 或其他自訂 user_id
  status TEXT NOT NULL DEFAULT 'segmenting',
  -- status: 'segmenting' | 'generating' | 'completed' | 'failed'

  -- 原始輸入
  transcript TEXT NOT NULL,
  speaker_id TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  video_model TEXT NOT NULL DEFAULT 'wavespeed',
  wavespeed_prompt TEXT,
  wavespeed_resolution TEXT,

  -- 統計
  total_segments INTEGER DEFAULT 0,
  completed_segments INTEGER DEFAULT 0,
  failed_segments INTEGER DEFAULT 0,

  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 分段生成任務的各段落
CREATE TABLE IF NOT EXISTS job_segments (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES segmented_jobs(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'tts' | 'whisper' | 'video' | 'completed' | 'failed'

  -- TTS 結果
  audio_url TEXT,
  audio_duration REAL,

  -- Whisper 結果
  subtitles JSONB, -- TimedSegment[]

  -- Wavespeed 結果
  video_task_id TEXT,
  video_url TEXT,

  -- 錯誤
  error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_segmented_jobs_user_id ON segmented_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_segmented_jobs_status ON segmented_jobs(status);
CREATE INDEX IF NOT EXISTS idx_segmented_jobs_created_at ON segmented_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_segments_job_id ON job_segments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_segments_status ON job_segments(status);

-- 確保每個 job 的 index 唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_segments_job_index ON job_segments(job_id, index);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE segmented_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_segments ENABLE ROW LEVEL SECURITY;

-- 允許 Service Role 完全存取（後端 API 使用）
CREATE POLICY "Service role full access on segmented_jobs"
  ON segmented_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on job_segments"
  ON job_segments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Functions
-- ============================================

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_segmented_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_segmented_jobs_updated_at
  BEFORE UPDATE ON segmented_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_segmented_jobs_updated_at();

CREATE OR REPLACE FUNCTION update_job_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_segments_updated_at
  BEFORE UPDATE ON job_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_job_segments_updated_at();

-- 當 segment 狀態更新時，同步更新 job 的統計
CREATE OR REPLACE FUNCTION sync_job_segment_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE segmented_jobs
  SET
    completed_segments = (
      SELECT COUNT(*) FROM job_segments
      WHERE job_id = NEW.job_id AND status = 'completed'
    ),
    failed_segments = (
      SELECT COUNT(*) FROM job_segments
      WHERE job_id = NEW.job_id AND status = 'failed'
    )
  WHERE id = NEW.job_id;

  -- 檢查是否全部完成
  IF (
    SELECT completed_segments + failed_segments >= total_segments
    FROM segmented_jobs WHERE id = NEW.job_id
  ) THEN
    UPDATE segmented_jobs
    SET
      status = CASE
        WHEN failed_segments > 0 THEN 'failed'
        ELSE 'completed'
      END,
      completed_at = NOW()
    WHERE id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_job_segment_counts
  AFTER UPDATE OF status ON job_segments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_job_segment_counts();
