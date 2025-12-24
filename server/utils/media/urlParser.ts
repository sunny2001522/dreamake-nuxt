import type { MediaPlatform, MediaItemType, ParsedMediaUrl } from '~/types'

/**
 * 解析媒體 URL 並識別平台和類型
 */
export function parseMediaUrl(url: string): ParsedMediaUrl {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return parseYouTubeUrl(url, urlObj)
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      return parseTwitchUrl(url, urlObj)
    }

    // Bilibili
    if (hostname.includes('bilibili.com')) {
      return parseBilibiliUrl(url, urlObj)
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      return parseTikTokUrl(url, urlObj)
    }

    // Podcast RSS
    if (url.endsWith('.rss') || url.endsWith('.xml') || url.includes('/feed')) {
      return {
        platform: 'podcast',
        type: 'feed',
        url,
        isValid: true
      }
    }

    // 其他平台（通過 yt-dlp 支援）
    return {
      platform: 'other',
      type: 'video',
      url,
      isValid: true
    }
  } catch {
    return {
      platform: 'other',
      type: 'video',
      url,
      isValid: false,
      error: '無效的網址格式'
    }
  }
}

/**
 * 解析 YouTube URL
 */
function parseYouTubeUrl(url: string, urlObj: URL): ParsedMediaUrl {
  const pathname = urlObj.pathname

  // 頻道格式：/@username, /channel/xxx, /c/xxx, /user/xxx
  if (
    pathname.match(/@[^/\s]+/) ||
    pathname.includes('/channel/') ||
    pathname.includes('/c/') ||
    pathname.includes('/user/')
  ) {
    return {
      platform: 'youtube',
      type: 'channel',
      url,
      isValid: true
    }
  }

  // 播放清單格式：/playlist?list=xxx
  if (pathname.includes('/playlist') && urlObj.searchParams.has('list')) {
    const playlistId = urlObj.searchParams.get('list')
    return {
      platform: 'youtube',
      type: 'playlist',
      url,
      identifier: playlistId || undefined,
      isValid: !!playlistId
    }
  }

  // 影片格式：/watch?v=xxx 或 youtu.be/xxx
  if (pathname.includes('/watch') || urlObj.hostname.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(url, urlObj)
    return {
      platform: 'youtube',
      type: 'video',
      url,
      identifier: videoId,
      isValid: !!videoId,
      error: !videoId ? '無法提取影片 ID' : undefined
    }
  }

  return {
    platform: 'youtube',
    type: 'video',
    url,
    isValid: false,
    error: '無法識別的 YouTube 連結類型'
  }
}

/**
 * 提取 YouTube 影片 ID
 */
function extractYouTubeVideoId(url: string, urlObj: URL): string | undefined {
  // youtu.be/VIDEO_ID
  if (urlObj.hostname.includes('youtu.be')) {
    return urlObj.pathname.split('/')[1]?.split(/[?&#]/)[0]
  }

  // youtube.com/watch?v=VIDEO_ID
  const videoId = urlObj.searchParams.get('v')
  return videoId || undefined
}

/**
 * 解析 Twitch URL
 */
function parseTwitchUrl(url: string, urlObj: URL): ParsedMediaUrl {
  const pathname = urlObj.pathname

  // Clip: clips.twitch.tv/xxx or twitch.tv/xxx/clip/xxx
  if (urlObj.hostname.includes('clips.twitch.tv') || pathname.includes('/clip/')) {
    return {
      platform: 'twitch',
      type: 'clip',
      url,
      isValid: true
    }
  }

  // VOD: twitch.tv/videos/123456
  if (pathname.includes('/videos/')) {
    const vodId = pathname.split('/videos/')[1]?.split(/[?&#]/)[0]
    return {
      platform: 'twitch',
      type: 'vod',
      url,
      identifier: vodId,
      isValid: !!vodId,
      error: !vodId ? '無法提取 VOD ID' : undefined
    }
  }

  // 頻道: twitch.tv/username
  const channelName = pathname.split('/')[1]?.split(/[?&#]/)[0]
  if (channelName && !channelName.includes('/')) {
    return {
      platform: 'twitch',
      type: 'channel',
      url,
      identifier: channelName,
      isValid: true
    }
  }

  return {
    platform: 'twitch',
    type: 'video',
    url,
    isValid: false,
    error: '無法識別的 Twitch 連結類型'
  }
}

/**
 * 解析 Bilibili URL
 */
function parseBilibiliUrl(url: string, urlObj: URL): ParsedMediaUrl {
  const pathname = urlObj.pathname

  // 影片格式：/video/BVxxx 或 /video/avxxx
  if (pathname.includes('/video/')) {
    const videoId = pathname.split('/video/')[1]?.split(/[?&#/]/)[0]
    const isValid = !!(videoId && (videoId.startsWith('BV') || videoId.startsWith('av')))

    return {
      platform: 'bilibili',
      type: 'video',
      url,
      identifier: videoId,
      isValid,
      error: !isValid ? '無效的 Bilibili 影片 ID' : undefined
    }
  }

  return {
    platform: 'bilibili',
    type: 'video',
    url,
    isValid: false,
    error: '無法識別的 Bilibili 連結類型'
  }
}

/**
 * 解析 TikTok URL
 */
function parseTikTokUrl(url: string, urlObj: URL): ParsedMediaUrl {
  const pathname = urlObj.pathname

  // 影片格式：/@username/video/123456
  if (pathname.includes('/video/')) {
    const videoId = pathname.split('/video/')[1]?.split(/[?&#]/)[0]
    return {
      platform: 'tiktok',
      type: 'video',
      url,
      identifier: videoId,
      isValid: !!videoId,
      error: !videoId ? '無法提取影片 ID' : undefined
    }
  }

  // 短連結格式：vm.tiktok.com/xxx or vt.tiktok.com/xxx
  if (urlObj.hostname.includes('vm.tiktok.com') || urlObj.hostname.includes('vt.tiktok.com')) {
    return {
      platform: 'tiktok',
      type: 'video',
      url,
      isValid: true
    }
  }

  return {
    platform: 'tiktok',
    type: 'video',
    url,
    isValid: false,
    error: '無法識別的 TikTok 連結類型'
  }
}

/**
 * 批次解析多個 URL
 */
export function parseMediaUrls(urls: string[]): ParsedMediaUrl[] {
  return urls
    .map(url => url.trim())
    .filter(url => url.length > 0)
    .map(url => parseMediaUrl(url))
}

/**
 * 從多行文字中提取並解析 URL
 */
export function parseMediaUrlsFromText(text: string): ParsedMediaUrl[] {
  const urls = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  return parseMediaUrls(urls)
}
