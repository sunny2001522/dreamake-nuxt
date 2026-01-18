/**
 * Fanbar 產品配置
 */
export const FANBAR_CONFIG = {
  productType: '888003',
  platform: '3',
  tokensPerSubscription: 1200,
  // functionId 已移至環境變數 NUXT_PUBLIC_FANBAR_FUNCTION_ID
} as const

/**
 * 儲存付款返回路徑的 localStorage key
 */
export const FANBAR_STORAGE_KEY = 'dreammake_fanbar_return_path'
