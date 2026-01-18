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
  ],

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
      // Fanbar 結帳 URL
      // 測試機: https://test.cmoney.tw/cashflow/checkout
      // 正式機: https://www.cmoney.tw/cashflow/checkout
      fanbarCheckoutUrl: process.env.NUXT_PUBLIC_FANBAR_CHECKOUT_URL || 'https://test.cmoney.tw/cashflow/checkout',
      // Fanbar functionId
      // 測試機: 12137
      // 正式機: 12521
      fanbarFunctionId: process.env.NUXT_PUBLIC_FANBAR_FUNCTION_ID || '12137',
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
    routeRules: {
      '/api/**': { cors: true },
    },
  },

  typescript: {
    strict: true,
  },
})
