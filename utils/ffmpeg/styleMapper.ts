/**
 * 字幕樣式映射：字體 + 背景分離設計
 * Docker/Linux 環境使用 Noto 字體系列
 *
 * 字體對應：
 * - 黑體 (Gothic/Sans): Noto Sans CJK TC
 * - 明體 (Ming/Serif): Noto Serif CJK TC
 */

import type { SubtitleFont, SubtitleBackground } from '~/types'

export interface ASSStyleConfig {
  fontName: string
  fontSize: number
  primaryColor: string // &HAABBGGRR 格式（文字顏色）
  outlineColor: string // BorderStyle=3 時為背景色，BorderStyle=1 時為描邊色
  backColor: string // 陰影顏色
  bold: number // 0 或 -1 (ASS 用 -1 表示 bold)
  borderStyle: number // 1=邊框+陰影, 3=不透明背景盒
  outline: number // 邊框寬度 / 背景盒 padding
  shadow: number // 陰影距離
}

/**
 * ASS 顏色格式說明：
 * - 格式：&HAABBGGRR（Alpha, Blue, Green, Red）
 * - Alpha: 00=完全不透明, FF=完全透明
 * - 例如：&H00FFFFFF = 白色不透明
 *        &H4D000000 = 黑色 70% 不透明（30% 透明）
 */

// Docker 環境字體名稱（Bold 通過 ASS 的 bold=-1 設定）
const FONTS: Record<SubtitleFont, string> = {
  gothic: 'Noto Sans CJK TC', // 黑體（Bold 由 ASS 樣式控制）
  ming: 'Noto Serif CJK TC', // 明體（Bold 由 ASS 樣式控制）
}

/**
 * 根據字體和背景生成標題的 ASS 樣式配置
 * 標題可選擇：黑底、白底、無底
 */
export function getTitleASSStyle(
  font: SubtitleFont,
  background: SubtitleBackground
): ASSStyleConfig | null {
  const fontName = FONTS[font]

  switch (background) {
    case 'black':
      // 黑底白字（半透明黑底 70%）
      return {
        fontName,
        fontSize: 48,
        primaryColor: '&H00FFFFFF', // 白字
        outlineColor: '&H4D000000', // 黑底 70% 不透明（BorderStyle=3 時為背景色）
        backColor: '&H00000000', // 不使用陰影
        bold: -1, // 全部加粗
        borderStyle: 3, // 背景盒模式
        outline: 15, // 背景盒 padding
        shadow: 0,
      }

    case 'white':
      // 白底黑字（半透明白底 70%）
      return {
        fontName,
        fontSize: 48,
        primaryColor: '&H00000000', // 黑字
        outlineColor: '&H4DFFFFFF', // 白底 70% 不透明（BorderStyle=3 時為背景色）
        backColor: '&H00000000', // 不使用陰影
        bold: -1, // 全部加粗
        borderStyle: 3, // 背景盒模式
        outline: 15, // 背景盒 padding
        shadow: 0,
      }

    case 'none':
    default:
      // 無底色白字 + 重陰影
      return {
        fontName,
        fontSize: 48,
        primaryColor: '&H00FFFFFF', // 白字
        outlineColor: '&H00000000', // 黑色描邊（銳利邊緣）
        backColor: '&H00000000', // 黑色陰影（100% 不透明）
        bold: -1, // 全部加粗
        borderStyle: 1, // 描邊+陰影模式
        outline: 3, // 描邊寬度
        shadow: 4, // 陰影距離
      }
  }
}

/**
 * 獲取內文字幕的 ASS 樣式配置
 * 內文固定：白色 + 重陰影（銳利邊緣、不透明）
 */
export function getSubtitleASSStyle(font: SubtitleFont): ASSStyleConfig {
  const fontName = FONTS[font]

  // 白色文字 + 黑色描邊 + 重陰影（銳利邊緣）
  return {
    fontName,
    fontSize: 48,
    primaryColor: '&H00FFFFFF', // 白字
    outlineColor: '&H00000000', // 黑色描邊（完全不透明，銳利邊緣）
    backColor: '&H00000000', // 黑色陰影（100% 不透明）
    bold: -1, // 全部加粗
    borderStyle: 1, // 描邊+陰影模式
    outline: 3, // 描邊寬度（銳利邊緣）
    shadow: 4, // 陰影距離
  }
}

/**
 * 根據字體和背景生成 ASS 樣式配置（向後兼容，現在只用於標題）
 * @deprecated 請使用 getTitleASSStyle 或 getSubtitleASSStyle
 */
export function getASSStyle(
  font: SubtitleFont,
  background: SubtitleBackground
): ASSStyleConfig | null {
  return getTitleASSStyle(font, background)
}

/**
 * 舊樣式遷移映射（向後兼容）
 */
export function migrateOldStyle(oldStyle: string): {
  font: SubtitleFont
  background: SubtitleBackground
} {
  const migrations: Record<
    string,
    { font: SubtitleFont; background: SubtitleBackground }
  > = {
    // 新樣式（已是 font-based，預設無背景）
    gothic: { font: 'gothic', background: 'none' },
    ming: { font: 'ming', background: 'none' },
    rounded: { font: 'gothic', background: 'none' },

    // 舊樣式（background-based）
    white: { font: 'gothic', background: 'white' },
    black: { font: 'gothic', background: 'black' },
    transparent: { font: 'gothic', background: 'black' },
    outline: { font: 'gothic', background: 'none' },

    // 更舊的樣式
    classic: { font: 'gothic', background: 'black' },
    neon: { font: 'gothic', background: 'black' },
    handwritten: { font: 'gothic', background: 'none' },
    professional: { font: 'ming', background: 'white' },
  }

  return migrations[oldStyle] || { font: 'gothic', background: 'black' }
}

/**
 * 根據影片解析度調整內文字體大小
 * 內文：12 字占畫面寬度 80%（放大字體以提高可讀性）
 */
export function getScaledFontSize(
  _baseSize: number,
  videoWidth: number,
  _videoHeight: number
): number {
  const maxCharsPerLine = 10 // 內文 10 字（再放大約 17%）
  const maxWidthRatio = 0.8 // 80% 寬度
  const targetSize = Math.round((videoWidth * maxWidthRatio) / maxCharsPerLine)
  return targetSize
}

/**
 * 根據影片解析度調整標題字體大小
 * 標題：12 字占畫面寬度 80%
 */
export function getScaledTitleFontSize(
  videoWidth: number,
  _videoHeight: number
): number {
  const maxCharsPerLine = 12 // 標題 12 字
  const maxWidthRatio = 0.8 // 80% 寬度
  return Math.round((videoWidth * maxWidthRatio) / maxCharsPerLine)
}

/**
 * 獲取 FFmpeg subtitles 濾鏡的 force_style 設定（備用）
 */
export function getForceStyle(
  font: SubtitleFont,
  background: SubtitleBackground,
  videoWidth: number,
  videoHeight: number,
  subtitleY: number
): string {
  const fontSize = getScaledFontSize(48, videoWidth, videoHeight)
  const marginV = Math.round(((100 - subtitleY) / 100) * videoHeight)
  const fontName = FONTS[font]
  const bold = 1 // 全部加粗

  if (background === 'black') {
    return `FontName=${fontName},FontSize=${fontSize},PrimaryColour=&H00FFFFFF,BackColour=&H4D000000,BorderStyle=3,Outline=15,MarginV=${marginV},Bold=${bold}`
  } else if (background === 'white') {
    return `FontName=${fontName},FontSize=${fontSize},PrimaryColour=&H00000000,BackColour=&H4DFFFFFF,BorderStyle=3,Outline=15,MarginV=${marginV},Bold=${bold}`
  } else {
    // 無底色：無描邊，只有投影
    return `FontName=${fontName},FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=0,Shadow=10,MarginV=${marginV},Bold=${bold}`
  }
}
