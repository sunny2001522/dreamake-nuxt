/**
 * ASS 字幕檔案生成器
 * 將 TimedSegment[] 轉換為 ASS 格式
 */

import type { TimedSegment, SubtitleFont, SubtitleBackground } from '~/types'
import {
  getTitleASSStyle,
  getSubtitleASSStyle,
  getScaledFontSize,
  getScaledTitleFontSize,
} from './styleMapper'

export interface ASSGeneratorOptions {
  segments: TimedSegment[]
  font: SubtitleFont
  titleBackground: SubtitleBackground // 標題背景（黑底/白底/無底）
  subtitleY: number // 0-100 百分比（從頂部算起）
  videoWidth: number
  videoHeight: number
  title?: string // 標題文字（可選）
  titleY?: number // 標題位置 0-100 百分比（從頂部算起）
}

// 向後兼容：舊的 background 參數映射到 titleBackground
export interface LegacyASSGeneratorOptions {
  segments: TimedSegment[]
  font: SubtitleFont
  background: SubtitleBackground // 舊參數名（向後兼容）
  subtitleY: number
  videoWidth: number
  videoHeight: number
  title?: string
  titleY?: number
}

/**
 * 將秒數轉換為 ASS 時間格式 (H:MM:SS.CC)
 */
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

/**
 * 計算 ASS MarginV（從底部算起的像素距離）
 * CSS subtitleY 是從頂部算起的百分比
 */
function calculateMarginV(subtitleY: number, videoHeight: number): number {
  // subtitleY = 66 表示字幕在畫面 66% 處（從頂部）
  // ASS MarginV 是從底部算起
  const fromBottom = 100 - subtitleY
  return Math.round((fromBottom / 100) * videoHeight)
}

/**
 * 轉義 ASS 特殊字元
 */
function escapeASSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // 反斜線
    .replace(/\n/g, '\\N') // 換行
    .replace(/\{/g, '\\{') // 大括號（避免被解析為 override tag）
    .replace(/\}/g, '\\}')
}

/**
 * 計算標題的 MarginV（從頂部算起）
 * ASS Alignment=8 時，MarginV 是從頂部算起
 */
function calculateTitleMarginV(titleY: number, videoHeight: number): number {
  return Math.round((titleY / 100) * videoHeight)
}

/**
 * 生成 ASS 字幕檔案內容
 * 標題：使用 titleBackground 決定樣式（黑底/白底/無底）
 * 內文字幕：固定白色 + 重陰影
 */
export function generateASS(
  options: ASSGeneratorOptions | LegacyASSGeneratorOptions
): string {
  // 向後兼容：支援舊的 background 參數
  const titleBackground =
    'titleBackground' in options
      ? options.titleBackground
      : (options as LegacyASSGeneratorOptions).background
  const {
    segments,
    font,
    subtitleY,
    videoWidth,
    videoHeight,
    title,
    titleY = 8,
  } = options

  // 如果沒有字幕也沒有標題，返回空字串
  if (segments.length === 0 && !title) {
    return ''
  }

  // 內文字幕樣式（固定：白色 + 重陰影）
  const subtitleStyle = getSubtitleASSStyle(font)
  // 標題樣式（根據 titleBackground 決定）
  const titleStyle = getTitleASSStyle(font, titleBackground)

  if (!subtitleStyle) {
    return ''
  }

  const marginV = calculateMarginV(subtitleY, videoHeight)
  // 內文字體大小：15 字占 80%
  const fontSize = getScaledFontSize(
    subtitleStyle.fontSize,
    videoWidth,
    videoHeight
  )
  // 標題字體大小：12 字占 80%
  const titleFontSize = getScaledTitleFontSize(videoWidth, videoHeight)

  // ASS 檔案頭
  const scriptInfo = `[Script Info]
Title: DreaMake Subtitles
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes
`

  // 標題樣式的 MarginV（從頂部算起，Alignment=8）
  const titleMarginV = calculateTitleMarginV(titleY, videoHeight)

  // V4+ Styles 區塊
  // Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,
  //         Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,
  //         BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
  // Alignment: 2=底部置中, 8=頂部置中

  // Default 樣式（內文字幕）：白色 + 重陰影
  let stylesContent = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${subtitleStyle.fontName},${fontSize},${subtitleStyle.primaryColor},&H000000FF,${subtitleStyle.outlineColor},${subtitleStyle.backColor},${subtitleStyle.bold},0,0,0,100,100,0,0,${subtitleStyle.borderStyle},${subtitleStyle.outline},${subtitleStyle.shadow},2,20,20,${marginV},1`

  // 如果有標題，加入 Title 樣式（根據 titleBackground 決定，使用較大的標題字體）
  if (title && titleStyle) {
    stylesContent += `\nStyle: Title,${titleStyle.fontName},${titleFontSize},${titleStyle.primaryColor},&H000000FF,${titleStyle.outlineColor},${titleStyle.backColor},${titleStyle.bold},0,0,0,100,100,0,0,${titleStyle.borderStyle},${titleStyle.outline},${titleStyle.shadow},8,20,20,${titleMarginV},1`
  }
  stylesContent += '\n'

  // Events 區塊（對話行）
  let dialoguesContent = ''

  // 如果有標題，加入標題對話（全程顯示）
  if (title) {
    const escapedTitle = escapeASSText(title)
    dialoguesContent += `Dialogue: 1,0:00:00.00,9:59:59.99,Title,,0,0,0,,${escapedTitle}\n`
  }

  // 處理無時間戳的字幕（startTime = -1 表示無時間戳）
  let processedSegments = segments
  const hasNoTimestamps = segments.length > 0 && segments.every(seg => seg.startTime < 0)

  if (hasNoTimestamps) {
    // 根據文字長度估算顯示時間（每秒約 5 個中文字）
    const CHARS_PER_SECOND = 5
    let currentTime = 0

    processedSegments = segments.map(seg => {
      const duration = Math.max(seg.text.length / CHARS_PER_SECOND, 1) // 最少 1 秒
      const startTime = currentTime
      const endTime = currentTime + duration
      currentTime = endTime
      return { ...seg, startTime, endTime }
    })

    console.log('Auto-assigned timestamps for segments without timing:', processedSegments.length)
  }

  // 調整時間戳避免字幕重疊（當前句結束時間不超過下一句開始時間）
  const adjustedSegments = processedSegments.map((seg, i) => {
    if (i < processedSegments.length - 1) {
      const nextSeg = processedSegments[i + 1]
      if (seg.endTime > nextSeg.startTime) {
        return { ...seg, endTime: nextSeg.startTime }
      }
    }
    return seg
  })

  // 字幕對話
  dialoguesContent += adjustedSegments
    .map((seg) => {
      const start = formatASSTime(seg.startTime)
      const end = formatASSTime(seg.endTime)
      const text = escapeASSText(seg.text)
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`
    })
    .join('\n')

  const events = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialoguesContent}
`

  return scriptInfo + '\n' + stylesContent + '\n' + events
}
