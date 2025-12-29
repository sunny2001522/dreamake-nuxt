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
  name: string
  duration: number
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
