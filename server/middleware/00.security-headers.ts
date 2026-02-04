/**
 * Security Headers Middleware
 *
 * 為所有回應添加安全標頭
 * 檔名前綴 00. 確保此 middleware 最先執行
 */
export default defineEventHandler((event) => {
  const headers = event.node.res

  // 1. Strict-Transport-Security (HSTS)
  // 強制使用 HTTPS 一年，包含子網域
  headers.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )

  // 2. X-Content-Type-Options
  // 防止瀏覽器 MIME type sniffing
  headers.setHeader('X-Content-Type-Options', 'nosniff')

  // 3. X-Frame-Options
  // 防止 Clickjacking - SAMEORIGIN 允許同網域內嵌
  headers.setHeader('X-Frame-Options', 'SAMEORIGIN')

  // 4. X-XSS-Protection
  // 舊版 XSS 保護（現代瀏覽器使用 CSP）
  headers.setHeader('X-XSS-Protection', '1; mode=block')

  // 5. Referrer-Policy
  // 控制 referrer 資訊洩漏
  headers.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 6. Permissions-Policy
  // 限制瀏覽器功能存取
  headers.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=()'
  )

  // 7. Content-Security-Policy
  // 控制資源載入來源
  const csp = buildContentSecurityPolicy()
  headers.setHeader('Content-Security-Policy', csp)
})

function buildContentSecurityPolicy(): string {
  const directives = [
    // 預設只允許同源
    "default-src 'self'",

    // JavaScript - 允許同源和 inline（Vue 需要）
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",

    // CSS - 允許同源和 inline（Tailwind 需要）
    "style-src 'self' 'unsafe-inline'",

    // 圖片 - 允許各種來源
    [
      "img-src 'self'",
      'data:',
      'blob:',
      'https://*.supabase.co',
      'https://*.cmoney.tw',
      'https://i.ytimg.com',
      'https://img.youtube.com',
      'https://api.wavespeed.ai',
      'https://devapi.vidnoz.com',
    ].join(' '),

    // 媒體 - 影片和音訊來源
    [
      "media-src 'self'",
      'blob:',
      'data:',
      'https://*.supabase.co',
      'https://api.wavespeed.ai',
      'https://devapi.vidnoz.com',
    ].join(' '),

    // 字體
    "font-src 'self' data:",

    // API 連線 - 允許所有需要的後端服務
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://*.cmoney.tw',
      'https://api.wavespeed.ai',
      'https://devapi.vidnoz.com',
      'https://api.inworld.ai',
      'https://api.openai.com',
      'https://api.topmediai.com',
      'https://generativelanguage.googleapis.com',
    ].join(' '),

    // iframe - 允許 OIDC 靜默更新
    "frame-src 'self' https://auth.cmoney.tw",

    // 禁止被其他網站嵌入（除了同源）
    "frame-ancestors 'self'",

    // 表單提交目標
    "form-action 'self' https://auth.cmoney.tw",

    // 基礎 URI 限制
    "base-uri 'self'",

    // Web Worker - 允許 blob:（Vite HMR 需要）
    "worker-src 'self' blob:",

    // 禁止 object/embed
    "object-src 'none'",
  ]

  return directives.join('; ')
}
