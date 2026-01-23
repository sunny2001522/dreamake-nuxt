export interface UserProfile {
  name: string
  avatarUrl?: string
  voiceSampleUrl?: string
  voiceId?: string
  isPremium: boolean
}

export type AspectRatio = 'portrait' | 'landscape'

export type VideoModel = 'vidnoz' | 'wavespeed'

export type WaveSpeedResolution = '480p' | '720p' | '1080p'

export type SubtitleFont = 'gothic' | 'ming'

export type SubtitleBackground = 'none' | 'black' | 'white'

export interface SubtitleConfig {
  font: SubtitleFont
  background: SubtitleBackground
}

export type SubtitleStyleType = 'none' | 'gothic' | 'ming' | 'rounded' | 'white' | 'black' | 'transparent' | 'outline'

export interface GenerationRecord {
  id: string
  thumbnailUrl?: string
  transcript: string
  aspectRatio: AspectRatio
  duration: number
  createdAt: Date
  status: 'processing' | 'completed' | 'failed'
  audioUrl?: string
  videoUrl?: string
  speakerId?: string
  title?: string
  subtitleStyle?: SubtitleStyleType
  avatarPreview?: string
  voicePreview?: string
}

export interface AppState {
  user: UserProfile | null
  history: GenerationRecord[]
}

export interface TimedSegment {
  text: string
  startTime: number
  endTime: number
}

export interface PendingAudioFile {
  id: string
  file: File
  processedFile?: File          // 處理後的 WAV 檔
  name: string
  duration: number
  originalDuration?: number     // 裁剪前的原始長度
  status: 'processing' | 'ready' | 'error'
  error?: string
  wasTrimmed: boolean
  isFromVideo: boolean
}

export interface SavedVoice {
  id?: number
  supabaseId?: string
  name: string
  speakerId: string
  originalFileName: string
  audioData?: string
  audioUrl?: string
  audioMimeType?: string
  createdAt: Date
  lastUsedAt: Date
  useCount: number
}

export type VoiceMode = 'saved' | 'upload'

export interface SavedImage {
  id?: number
  supabaseId?: string
  name: string
  imageData: string
  imageMimeType: string
  thumbnailData?: string
  createdAt: Date
  lastUsedAt: Date
  useCount: number
}

export type MediaPlatform =
  | 'youtube'
  | 'twitch'
  | 'bilibili'
  | 'tiktok'
  | 'podcast'
  | 'other'

export type MediaItemType =
  | 'channel'
  | 'video'
  | 'playlist'
  | 'vod'
  | 'clip'
  | 'feed'

export interface ParsedMediaUrl {
  platform: MediaPlatform
  type: MediaItemType
  url: string
  identifier?: string
  isValid: boolean
  error?: string
}

export interface MediaItem {
  url: string
  platform: MediaPlatform
  type: MediaItemType
  limit?: number
  isValid: boolean
  error?: string
}

export type MediaAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface MediaAnalysis {
  job_id: string
  status: MediaAnalysisStatus
  result?: string
  message?: string
  progress?: {
    total: number
    completed: number
    current_platform?: string
  }
}

export type PersonaSourceType = 'text' | 'voice' | 'media'

export interface SuggestedTopic {
  id: string
  title: string
  description: string
  estimatedDuration: string
}

export interface PersonaConfig {
  source: PersonaSourceType
  content: string
  youtubeUrl?: string
}

export interface DraftGeneration {
  id: string
  transcript: string
  title: string
  selectedImageId: number | null
  selectedVoiceId: number | null
  avatarPreview?: string
  voicePreview?: { name: string; speakerId?: string }
  aspectRatio: AspectRatio
  subtitleStyle: SubtitleStyleType
  createdAt: Date
  updatedAt: Date
  userId?: string
}

// ============================================
// Supabase Database Types
// ============================================

export interface DbImage {
  id: string
  user_id: string
  name: string
  image_url: string
  image_mime_type: string
  thumbnail_url: string | null
  created_at: string
  last_used_at: string
  use_count: number
}

export interface DbVoice {
  id: string
  user_id: string
  name: string
  speaker_id: string
  original_file_name: string
  audio_url: string | null
  audio_mime_type: string | null
  created_at: string
  last_used_at: string
  use_count: number
}

export interface DbVideo {
  id: string
  user_id: string
  title: string | null
  transcript: string
  video_url: string | null
  original_video_url: string | null // Original CDN URL (expires after ~3 days)
  audio_url: string | null
  thumbnail_url: string | null
  aspect_ratio: AspectRatio
  duration: number | null
  status: 'processing' | 'completed' | 'failed'
  subtitle_style: SubtitleStyleType
  speaker_id: string | null
  avatar_preview: string | null
  voice_preview: string | null
  created_at: string
}

export type DbImageInsert = Omit<DbImage, 'id' | 'created_at' | 'last_used_at' | 'use_count'>
export type DbVoiceInsert = Omit<DbVoice, 'id' | 'created_at' | 'last_used_at' | 'use_count'>
export type DbVideoInsert = Omit<DbVideo, 'id' | 'created_at'>

export type DbImageUpdate = Partial<Omit<DbImage, 'id' | 'user_id' | 'created_at'>>
export type DbVoiceUpdate = Partial<Omit<DbVoice, 'id' | 'user_id' | 'created_at'>>
export type DbVideoUpdate = Partial<Omit<DbVideo, 'id' | 'user_id' | 'created_at'>>

export interface DbUserPreferences {
  user_id: string
  persona_id: string | null
  voice_id: string | null
  image_id: string | null
  subtitle_style: SubtitleStyleType
  updated_at: string
}

export type DbUserPreferencesUpsert = Omit<DbUserPreferences, 'updated_at'>

export interface DbPersona {
  id: string
  user_id: string
  name: string
  content: string
  source: PersonaSourceType
  source_urls: string[]
  platforms: string[]
  job_id: string | null
  created_at: string
  last_used_at: string
  use_count: number
}

export type DbPersonaInsert = Omit<DbPersona, 'id' | 'created_at' | 'last_used_at' | 'use_count'>
export type DbPersonaUpdate = Partial<Omit<DbPersona, 'id' | 'user_id' | 'created_at'>>

// ============================================
// Generation Types
// ============================================

export type GenerationStage = 'idle' | 'cloning' | 'voice' | 'subtitle' | 'video' | 'complete' | 'error'

export interface GenerationState {
  id: string
  transcript: string
  title: string
  selectedImageId: number | null
  selectedVoiceId: number | null
  avatarPreview?: string
  voicePreview?: { name: string; speakerId?: string }
  aspectRatio: AspectRatio
  subtitleEnabled: boolean
  subtitleFont: SubtitleFont
  subtitleBackground: SubtitleBackground
  videoModel: VideoModel
}

// ============================================
// API Response Types
// ============================================

export interface VideoGenerationResponse {
  id: string
  taskId: string
  videoModel: VideoModel
  pollEndpoint: 'vidnoz' | 'wavespeed'
  transcript: string
  aspectRatio: AspectRatio
  audioUrl: string
  createdAt: string
  status: 'generating'
}

export interface VideoStatusResponse {
  success: boolean
  status: 'pending' | 'generating' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}

export interface VoiceCloneResponse {
  success: boolean
  speakerId: string
}

export interface VoiceTTSResponse {
  success: boolean
  speakerId: string
  audioUrl: string
  transcript: string
}

export interface SubtitleResponse {
  segments: TimedSegment[]
  hasTimestamps: boolean
  source: 'whisper' | 'gemini' | 'gemini-text' | 'fallback'
  duration?: number
}

// ============================================
// Pending Analysis Types (Background Polling)
// ============================================

export type PendingAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DbPendingAnalysis {
  id: string
  user_id: string
  job_id: string
  source_urls: string[]
  platforms: string[]
  status: PendingAnalysisStatus
  result: string | null
  persona_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  last_polled_at: string | null
  poll_count: number
}

export type DbPendingAnalysisInsert = Omit<DbPendingAnalysis, 'id' | 'created_at' | 'updated_at' | 'last_polled_at' | 'poll_count' | 'result' | 'persona_id' | 'error_message'>

export interface PendingAnalysis {
  id: string
  jobId: string
  sourceUrls: string[]
  platforms: MediaPlatform[]
  status: PendingAnalysisStatus
  result?: string
  personaId?: string
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  lastPolledAt?: Date
  pollCount: number
}

export interface PollPendingResponse {
  analyses: PendingAnalysis[]
  completed: Array<{
    id: string
    jobId: string
    result: string
    personaId: string
  }>
  failed: Array<{
    id: string
    jobId: string
    errorMessage: string
  }>
}

// ============================================
// Segmented Video Generation Types
// ============================================

/** 語意分段後的逐字稿段落 */
export interface TranscriptSegment {
  id: string
  index: number
  text: string
}

/** 分段生成狀態 */
export type SegmentStatus = 'pending' | 'tts' | 'whisper' | 'video' | 'completed' | 'failed'

/** 單一分段的生成結果 */
export interface GeneratedSegment {
  id: string
  index: number
  text: string
  status: SegmentStatus
  error?: string
  retryCount?: number

  // TTS 結果
  audioUrl?: string
  audioDuration?: number

  // Whisper 結果
  subtitles?: TimedSegment[]

  // 影片結果
  videoTaskId?: string
  videoUrl?: string

  // 時間軸位置 (用於串接播放)
  globalStartTime?: number
  globalEndTime?: number
}

/** 分段生成任務的整體狀態 */
export type SegmentedJobStatus = 'segmenting' | 'generating' | 'completed' | 'failed'

/** 分段生成任務 */
export interface SegmentedJob {
  id: string
  userId: string
  status: SegmentedJobStatus

  // 原始輸入
  transcript: string
  speakerId: string
  avatarUrl: string
  aspectRatio: AspectRatio
  videoModel: VideoModel
  waveSpeedPrompt?: string
  waveSpeedResolution?: WaveSpeedResolution

  // 分段資料
  segments: GeneratedSegment[]

  // 統計
  totalSegments: number
  completedSegments: number
  failedSegments: number

  // 最終結果
  totalDuration?: number

  // 時間戳
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

/** 時間軸軌道類型 */
export type TimelineTrackType = 'video' | 'audio' | 'subtitle'

/** 時間軸軌道項目 */
export interface TimelineTrackItem {
  segmentId: string
  segmentIndex: number
  startTime: number
  endTime: number
  content: string // URL 或字幕文字
}

/** 時間軸軌道資料 */
export interface TimelineTracks {
  video: TimelineTrackItem[]
  audio: TimelineTrackItem[]
  subtitle: TimelineTrackItem[]
}

/** 重新生成類型 */
export type RegenerateType = 'audio' | 'video' | 'both'

// ============================================
// Segmented Generation Database Types
// ============================================

export interface DbSegmentedJob {
  id: string
  user_id: string
  status: SegmentedJobStatus
  transcript: string
  speaker_id: string
  avatar_url: string
  aspect_ratio: AspectRatio
  video_model: VideoModel
  wavespeed_prompt: string | null
  wavespeed_resolution: WaveSpeedResolution | null
  total_segments: number
  completed_segments: number
  failed_segments: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface DbJobSegment {
  id: string
  job_id: string
  index: number
  text: string
  status: SegmentStatus
  audio_url: string | null
  audio_duration: number | null
  subtitles: TimedSegment[] | null
  video_task_id: string | null
  video_url: string | null
  error: string | null
  retry_count: number
  created_at: string
  updated_at: string
}

export type DbSegmentedJobInsert = Omit<DbSegmentedJob, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'completed_segments' | 'failed_segments'>
export type DbJobSegmentInsert = Omit<DbJobSegment, 'id' | 'created_at' | 'updated_at' | 'retry_count' | 'audio_url' | 'audio_duration' | 'subtitles' | 'video_task_id' | 'video_url' | 'error'>

// ============================================
// Segmented Generation API Types
// ============================================

export interface SegmentedGenerationRequest {
  transcript: string
  speakerId: string
  avatarUrl: string
  aspectRatio: AspectRatio
  videoModel?: VideoModel
  waveSpeedPrompt?: string
  waveSpeedResolution?: WaveSpeedResolution
  userId?: string
  avatarRotation?: number
  avatarPanX?: number
  avatarPanY?: number
}

export interface SegmentedGenerationResponse {
  jobId: string
  status: SegmentedJobStatus
  segments: GeneratedSegment[]
  totalSegments: number
}

export interface SegmentedJobProgressResponse {
  jobId: string
  status: SegmentedJobStatus
  progress: {
    total: number
    completed: number
    failed: number
    processing: number
  }
  segments: GeneratedSegment[]
  totalDuration?: number
}

export interface RegenerateSegmentRequest {
  segmentIndex: number
  type: RegenerateType
}

export interface RegenerateSegmentResponse {
  success: boolean
  segment: GeneratedSegment
}
