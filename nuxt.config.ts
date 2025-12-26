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

  devServer: {
    port: 3003,
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
      // CMoney OIDC
      baseDomain: process.env.VITE_BASE_DOMAIN || '',
      oidcDomain: process.env.VITE_OIDC_DOMAIN || '',
      identityServiceDomain: process.env.VITE_IDENTITY_SERVICE_DOMAIN || '',
      profileServiceDomain: process.env.VITE_PROFILE_SERVICE_DOMAIN || '',
    },
  },

  routeRules: {
    '/create': { ssr: false }, // Client-only for MediaRecorder, Camera APIs
    '/auth': { ssr: false },   // OIDC login page needs client-side only
    '/login': { ssr: false },  // OIDC callback needs client-side only
    '/logout': { ssr: false }, // OIDC callback needs client-side only
    '/refresh': { ssr: false }, // OIDC callback needs client-side only
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
