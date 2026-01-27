/**
 * CORS Middleware
 *
 * 限制跨來源請求，只允許特定網域
 * 取代 nuxt.config.ts 中的 { cors: true }
 */
export default defineEventHandler((event) => {
  // 只處理 API 路由
  if (!event.path.startsWith('/api/')) {
    return
  }

  const origin = getHeader(event, 'origin')
  const config = useRuntimeConfig()

  // 定義允許的來源
  const allowedOrigins = getAllowedOrigins(config)

  // 檢查來源是否允許
  const isAllowed = !origin || allowedOrigins.some((allowed) => {
    if (allowed instanceof RegExp) {
      return allowed.test(origin)
    }
    return origin === allowed
  })

  if (!isAllowed) {
    // 來源不允許 - 不設定 CORS headers
    console.warn(`CORS: Blocked request from origin: ${origin}`)
    return
  }

  const headers = event.node.res

  // 設定 CORS headers
  if (origin) {
    headers.setHeader('Access-Control-Allow-Origin', origin)
    headers.setHeader('Vary', 'Origin')
  }

  headers.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )

  headers.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, x-user-email'
  )

  headers.setHeader('Access-Control-Allow-Credentials', 'true')
  headers.setHeader('Access-Control-Max-Age', '86400') // 24 小時

  // 處理 preflight 請求
  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
  }
})

function getAllowedOrigins(config: ReturnType<typeof useRuntimeConfig>): (string | RegExp)[] {
  const baseDomain = config.public.baseDomain as string

  return [
    // 應用程式網域
    baseDomain,

    // 本地開發
    'https://localhost:3000',
    'https://127.0.0.1:3000',

    // Vercel 預覽部署
    /^https:\/\/.*\.vercel\.app$/,

    // CMoney 相關網域
    /^https:\/\/.*\.cmoney\.tw$/,
  ].filter(Boolean)
}
