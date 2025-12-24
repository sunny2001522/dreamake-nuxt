/**
 * GET /api/upload?url=xxx
 *
 * Proxy fetch image from URL (to avoid CORS issues)
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const imageUrl = query.url as string

    if (!imageUrl) {
      throw createError({
        statusCode: 400,
        message: 'No URL provided',
      })
    }

    // Validate URL
    let url: URL
    try {
      url = new URL(imageUrl)
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Invalid URL format',
      })
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw createError({
        statusCode: 400,
        message: 'Only HTTP/HTTPS URLs are allowed',
      })
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DreaMake/1.0)',
      },
    })

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch image',
      })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Validate it's an image
    if (!contentType.startsWith('image/')) {
      throw createError({
        statusCode: 400,
        message: 'URL does not point to a valid image',
      })
    }

    const imageBuffer = await response.arrayBuffer()

    // Return the image with proper headers
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    })

    return Buffer.from(imageBuffer)
  } catch (error: any) {
    console.error('Image proxy error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch image',
    })
  }
})
