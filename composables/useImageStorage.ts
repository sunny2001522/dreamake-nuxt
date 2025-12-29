import type { DbImage, DbImageInsert, DbImageUpdate } from '~/types'

/**
 * Composable for managing image storage in Supabase
 * Uses server-side API to bypass RLS for CMoney OIDC users
 */
export const useImageStorage = () => {
  const supabase = useSupabaseClient<any>()

  /**
   * Get all images for a user, sorted by last_used_at (most recent first)
   * Uses server API to bypass RLS
   */
  const getAllImages = async (userId: string): Promise<DbImage[]> => {
    const data = await $fetch<DbImage[]>('/api/images', {
      query: { userId },
    })

    return data || []
  }

  /**
   * Get an image by ID
   */
  const getImageById = async (id: string): Promise<DbImage | null> => {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return null
    }

    return data
  }

  /**
   * Save a new image to Supabase
   */
  const saveImage = async (
    file: File,
    userId: string,
    name?: string
  ): Promise<DbImage> => {
    // Generate unique file path
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/${timestamp}.${ext}`

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Create thumbnail
    let thumbnailUrl: string | null = null
    try {
      const thumbnailBlob = await createThumbnail(file)
      const thumbPath = `${userId}/thumb_${timestamp}.jpg`
      const { error: thumbError } = await supabase.storage
        .from('avatars')
        .upload(thumbPath, thumbnailBlob, { upsert: true })

      if (!thumbError) {
        const { data: thumbUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(thumbPath)
        thumbnailUrl = thumbUrlData.publicUrl
      }
    } catch {
      // Thumbnail creation failed, continue without it
    }

    // Insert metadata to database
    const imageData: DbImageInsert = {
      user_id: userId,
      name: name || file.name.replace(/\.[^/.]+$/, ''),
      image_url: urlData.publicUrl,
      image_mime_type: file.type,
      thumbnail_url: thumbnailUrl,
    }

    const { data, error } = await supabase
      .from('images')
      .insert(imageData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save image metadata: ${error.message}`)
    }

    return data
  }

  /**
   * Record image usage (update last_used_at)
   */
  const recordImageUsage = async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('record_image_usage', { image_id: id })

    if (error) {
      // Fallback to manual update if RPC fails
      await supabase
        .from('images')
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq('id', id)
    }
  }

  /**
   * Update image metadata
   */
  const updateImage = async (
    id: string,
    updates: DbImageUpdate
  ): Promise<DbImage | null> => {
    const { data, error } = await supabase
      .from('images')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update image: ${error.message}`)
    }

    return data
  }

  /**
   * Delete an image (both from Storage and database)
   * Uses server API to bypass RLS
   */
  const deleteImage = async (id: string, userId: string): Promise<void> => {
    await $fetch(`/api/images/${id}`, {
      method: 'DELETE',
    })
  }

  return {
    getAllImages,
    getImageById,
    saveImage,
    recordImageUsage,
    updateImage,
    deleteImage,
  }
}

/**
 * Create thumbnail from image file
 */
async function createThumbnail(file: File, maxSize: number = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create thumbnail blob'))
          }
        },
        'image/jpeg',
        0.7
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
