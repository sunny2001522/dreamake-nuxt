// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

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
    topMediaiApiKey: process.env.TOPMEDIAI_API_KEY || '',
    vidnozApiKey: process.env.VIDNOZ_API_KEY || '',
    wavespeedApiKey: process.env.WAVESPEED_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    renderApiKey: process.env.RENDER_API_KEY || '',
    renderFfmpegUrl: process.env.RENDER_FFMPEG_URL || '',
    youtubeAnalysisApiUrl: process.env.YOUTUBE_ANALYSIS_API_URL || 'https://development-agentgenerator.cmoney.tw',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

    // Client-side (public)
    public: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  },

  routeRules: {
    '/create': { ssr: false }, // Client-only for MediaRecorder, Camera APIs
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
