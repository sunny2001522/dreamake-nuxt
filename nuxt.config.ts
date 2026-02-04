// https://nuxt.com/docs/api/configuration/nuxt-config
import fs from 'fs'
import path from 'path'

// Check if local SSL certificates exist
const certsPath = path.resolve(__dirname, 'certs')
const hasLocalCerts = fs.existsSync(path.join(certsPath, 'localhost.pem')) &&
                      fs.existsSync(path.join(certsPath, 'localhost-key.pem'))

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  devServer: {
    port: 3000,
    https: hasLocalCerts
      ? {
          key: fs.readFileSync(path.join(certsPath, 'localhost-key.pem'), 'utf-8'),
          cert: fs.readFileSync(path.join(certsPath, 'localhost.pem'), 'utf-8'),
        }
      : true,
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    '@vueuse/nuxt',
    'nuxt-api-shield',
  ],

  // Rate Limiting 設定
  nuxtApiShield: {
    // 全域預設限制
    limit: {
      max: 60,        // 每 60 秒最多 60 次請求
      duration: 60,   // 時間窗口（秒）
      ban: 300,       // 超過限制後封鎖 5 分鐘
    },
    delayOnBan: true,
    errorMessage: '請求過於頻繁，請稍後再試',
    retryAfterHeader: true,

    // 各路由的個別限制
    routes: [
      // AI 生成 - 嚴格限制（高成本操作）
      { path: '/api/generate', max: 3, duration: 60 },
      { path: '/api/transcript/generate', max: 10, duration: 60 },
      { path: '/api/voice/clone', max: 5, duration: 300 },
      { path: '/api/voice/tts', max: 20, duration: 60 },
      { path: '/api/media/analyze', max: 10, duration: 60 },
      { path: '/api/title', max: 20, duration: 60 },
      { path: '/api/subtitle', max: 20, duration: 60 },

      // 上傳端點 - 中等限制
      { path: '/api/upload', max: 30, duration: 60 },
      { path: '/api/images', max: 30, duration: 60 },
      { path: '/api/video/upload', max: 10, duration: 60 },

      // Token 操作 - 中等限制
      { path: '/api/tokens/consume', max: 30, duration: 60 },
      { path: '/api/tokens/check', max: 60, duration: 60 },

      // 狀態查詢 - 較寬鬆
      { path: '/api/tokens/balance', max: 120, duration: 60 },
      { path: '/api/subscription/current', max: 120, duration: 60 },
      { path: '/api/video', max: 120, duration: 60 },
      { path: '/api/media/status', max: 120, duration: 60 },

      // 管理員端點
      { path: '/api/admin', max: 30, duration: 60 },
    ],
  },

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
    },
  },

  css: ['~/assets/css/main.css'],

  supabase: {
    redirect: false,
  },

  runtimeConfig: {
    // Server-side only
    adminEmails: process.env.ADMIN_EMAILS || '',
    topMediaiApiKey: process.env.TOPMEDIAI_API_KEY || '',
    // Inworld AI TTS
    inworldApiKey: process.env.INWORLD_API_KEY || '',
    inworldWorkspaceId: process.env.INWORLD_WORKSPACE_ID || '',
    vidnozApiKey: process.env.VIDNOZ_API_KEY || '',
    wavespeedApiKey: process.env.WAVESPEED_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    renderApiKey: process.env.RENDER_API_KEY || '',
    renderFfmpegUrl: process.env.RENDER_FFMPEG_URL || '',
    youtubeAnalysisApiUrl: process.env.YOUTUBE_ANALYSIS_API_URL || 'https://development-agentgenerator.cmoney.tw',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    // Fanbar API
    fanbarApiUrl: process.env.FANBAR_API_URL || 'https://fanbar.cmoney.internal/FanBar',

    // Client-side (public)
    // Note: These are automatically overridden at runtime with NUXT_PUBLIC_* environment variables
    // e.g., NUXT_PUBLIC_BASE_DOMAIN will override baseDomain
    public: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      // CMoney OIDC
      // 使用空字串，讓 Nuxt 3 自動使用 NUXT_PUBLIC_* 環境變數覆蓋
      baseDomain: '',
      oidcDomain: '',
      identityServiceDomain: '',
      profileServiceDomain: '',
      fanbarCheckoutUrl: process.env.NUXT_PUBLIC_FANBAR_CHECKOUT_URL || 'https://test.cmoney.tw/cashflow/checkout',
      fanbarFunctionId: process.env.NUXT_PUBLIC_FANBAR_FUNCTION_ID || '12137',
      googleSheetsWebhook: process.env.NUXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK || '',
    },
  },

  routeRules: {
    '/create': { ssr: false }, // Client-only for MediaRecorder, Camera APIs
    '/auth': { ssr: false },   // OIDC login page needs client-side only
    '/login': { ssr: false },  // OIDC callback needs client-side only
    '/logout': { ssr: false }, // OIDC callback needs client-side only
    '/refresh': { ssr: false }, // OIDC callback needs client-side only
    '/admin': { ssr: false },  // Admin dashboard needs client-side only
    '/account': { ssr: false }, // Account page needs client-side only
    '/pricing': { ssr: false }, // Pricing page with dynamic plans
    '/payment/callback': { ssr: false }, // Payment callback page
  },

  nitro: {
    // Rate limiting storage (Vercel 相容)
    storage: {
      shield: {
        driver: 'memory',
      },
    },
    // 注意：CORS 現在由 server/middleware/01.cors.ts 處理
    // 不再使用 { cors: true }
  },

  vite: {
    server: {
      watch: {
        ignored: ['**/my-video/**'],
      },
    },
  },

  typescript: {
    strict: true,
  },
})
