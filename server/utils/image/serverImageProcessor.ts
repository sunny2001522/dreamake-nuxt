/**
 * Server-side image processing using Sharp
 * Replaces FFmpeg for image operations (works on Vercel serverless)
 */

import sharp from 'sharp'

export interface CropImageOptions {
  imageUrl: string
  aspectRatio: 'portrait' | 'landscape'
}

// Target output resolutions (matching original FFmpeg implementation)
const TARGET_RESOLUTIONS = {
  portrait: { width: 720, height: 1280 },   // 720p portrait (9:16)
  landscape: { width: 1280, height: 720 },  // 720p landscape (16:9)
} as const

/**
 * Crop and scale image to target aspect ratio using Sharp
 * Center-crops to the maximum area that fits the target ratio,
 * then scales to 720p resolution
 *
 * @param options - imageUrl and aspectRatio
 * @returns Cropped and scaled image as JPEG Buffer
 */
export async function cropImageToAspectRatio(
  options: CropImageOptions
): Promise<Buffer> {
  const { imageUrl, aspectRatio } = options
  const { width: targetWidth, height: targetHeight } = TARGET_RESOLUTIONS[aspectRatio]

  console.log('Sharp cropping image:', { imageUrl: imageUrl.substring(0, 50) + '...', aspectRatio })

  // 1. Fetch the image from URL
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())

  // 2. Use Sharp to resize with cover (center crop) and output JPEG
  const processedBuffer = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'cover',        // Crops to fill dimensions (like FFmpeg crop filter)
      position: 'center',  // Center crop
    })
    .jpeg({ quality: 90 }) // High quality JPEG (similar to FFmpeg -q:v 2)
    .toBuffer()

  console.log('Sharp image processing complete, buffer size:', processedBuffer.length)

  return processedBuffer
}
