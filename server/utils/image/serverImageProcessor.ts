/**
 * Server-side image processing using Sharp
 * Replaces FFmpeg for image operations (works on Vercel serverless)
 */

import sharp from 'sharp'

export interface CropImageOptions {
  imageUrl: string
  aspectRatio: 'portrait' | 'landscape'
  rotation?: number // 旋轉角度 (0, 90, 180, 270)
  panX?: number // 水平偏移 (-1 ~ 1)，-1 = 最左，0 = 中心，1 = 最右
  panY?: number // 垂直偏移 (-1 ~ 1)，-1 = 最上，0 = 中心，1 = 最下
}

// Target output resolutions (matching original FFmpeg implementation)
const TARGET_RESOLUTIONS = {
  portrait: { width: 720, height: 1280 },   // 720p portrait (9:16)
  landscape: { width: 1280, height: 720 },  // 720p landscape (16:9)
} as const

/**
 * Crop and scale image to target aspect ratio using Sharp
 * Supports custom pan (offset) for user-adjustable cropping position.
 *
 * panX/panY 控制裁切位置：
 * - panX = -1: 裁切框在圖片最左邊
 * - panX = 0: 裁切框在中心（預設）
 * - panX = 1: 裁切框在圖片最右邊
 *
 * @param options - imageUrl, aspectRatio, rotation, panX, panY
 * @returns Cropped and scaled image as JPEG Buffer
 */
export async function cropImageToAspectRatio(
  options: CropImageOptions
): Promise<Buffer> {
  const {
    imageUrl,
    aspectRatio,
    rotation = 0,
    panX = 0,
    panY = 0,
  } = options
  const { width: targetWidth, height: targetHeight } = TARGET_RESOLUTIONS[aspectRatio]
  const targetRatio = targetWidth / targetHeight

  console.log('Sharp cropping image:', {
    imageUrl: imageUrl.substring(0, 50) + '...',
    aspectRatio,
    rotation,
    panX,
    panY,
  })

  // 1. Fetch the image from URL
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())

  // 2. Create Sharp instance and apply rotation first (if needed)
  let sharpInstance = sharp(imageBuffer)

  // Apply rotation if specified (normalize negative values to 0, 90, 180, 270)
  const normalizedRotation = rotation ? ((rotation % 360) + 360) % 360 : 0
  if (normalizedRotation !== 0) {
    sharpInstance = sharpInstance.rotate(normalizedRotation)
  }

  // 3. Get image dimensions after rotation
  const metadata = await sharpInstance.metadata()
  const srcWidth = metadata.width!
  const srcHeight = metadata.height!
  const srcRatio = srcWidth / srcHeight

  // 4. Calculate extract dimensions (to match target aspect ratio)
  let extractWidth: number
  let extractHeight: number

  if (srcRatio > targetRatio) {
    // Image is wider than target - use height as base, crop width
    extractHeight = srcHeight
    extractWidth = Math.round(srcHeight * targetRatio)
  } else {
    // Image is taller than target - use width as base, crop height
    extractWidth = srcWidth
    extractHeight = Math.round(srcWidth / targetRatio)
  }

  // 5. Calculate offset based on panX/panY (-1 to 1)
  // panX/panY = -1 → left/top, 0 → center, 1 → right/bottom
  const clampedPanX = Math.max(-1, Math.min(1, panX))
  const clampedPanY = Math.max(-1, Math.min(1, panY))

  // 最大可移動距離
  const maxOffsetX = srcWidth - extractWidth
  const maxOffsetY = srcHeight - extractHeight

  // 將 -1~1 轉換為 0~maxOffset
  // panX = -1 → left = 0
  // panX = 0 → left = maxOffset/2 (中心)
  // panX = 1 → left = maxOffset
  const left = Math.round(((clampedPanX + 1) / 2) * maxOffsetX)
  const top = Math.round(((clampedPanY + 1) / 2) * maxOffsetY)

  console.log('Extract parameters:', {
    srcWidth,
    srcHeight,
    extractWidth,
    extractHeight,
    left,
    top,
    panX: clampedPanX,
    panY: clampedPanY,
  })

  // 6. Extract region and resize to target dimensions
  const processedBuffer = await sharpInstance
    .extract({
      left: Math.max(0, Math.min(left, srcWidth - extractWidth)),
      top: Math.max(0, Math.min(top, srcHeight - extractHeight)),
      width: extractWidth,
      height: extractHeight,
    })
    .resize(targetWidth, targetHeight, {
      fit: 'fill', // Fill exactly (we already calculated correct aspect ratio)
    })
    .jpeg({ quality: 90 })
    .toBuffer()

  console.log('Sharp image processing complete, buffer size:', processedBuffer.length)

  return processedBuffer
}
