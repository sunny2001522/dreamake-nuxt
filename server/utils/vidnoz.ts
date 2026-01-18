const VIDNOZ_API_BASE = 'https://devapi.vidnoz.com'

function getHeaders() {
  const config = useRuntimeConfig()
  return {
    'Authorization': `Bearer ${config.vidnozApiKey}`,
  }
}

/**
 * Generate talking head video using Vidnoz API
 */
export async function generateTalkingVideo(
  avatarUrl: string,
  audioUrl: string
): Promise<{ taskId: string }> {
  const url = `${VIDNOZ_API_BASE}/v2/task/generate-talking-head`

  const formData = new FormData()
  formData.append('avatar_url', avatarUrl)
  formData.append('file_url', audioUrl)
  formData.append('type', '2') // '2' for Upload Audio Files Directly

  console.log('Sending Vidnoz generate video request with formData:', { avatarUrl, audioUrl, type: 2 })

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Vidnoz generate video API Error:', response.status, errorBody)
    throw new Error(`Vidnoz generate video API failed with status ${response.status}: ${errorBody}`)
  }

  const result = await response.json()
  console.log('Vidnoz generate video API Success:', result)

  if (result.code !== 200) {
    throw new Error(`Vidnoz API returned error code: ${result.code} - ${result.message}`)
  }

  return { taskId: result.data.task_id }
}

/**
 * Generate talking head video using avatar buffer directly
 * @param avatarBuffer - Cropped image buffer
 * @param audioUrl - Audio URL
 */
export async function generateTalkingVideoWithBuffer(
  avatarBuffer: Buffer,
  audioBuffer: Buffer,
  resolution: string = '720p'
): Promise<{ taskId: string }> {
  const url = `${VIDNOZ_API_BASE}/v2/task/generate-talking-head`

  const formData = new FormData()

  // Create Blob for avatar
  const avatarArrayBuffer = avatarBuffer.buffer.slice(
    avatarBuffer.byteOffset,
    avatarBuffer.byteOffset + avatarBuffer.byteLength
  ) as ArrayBuffer
  const avatarBlob = new Blob([avatarArrayBuffer], { type: 'image/jpeg' })

  // Create Blob for audio
  const audioArrayBuffer = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength
  ) as ArrayBuffer
  const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/wav' })

  // Append both as files
  formData.append('avatar', avatarBlob, 'avatar.jpg')
  formData.append('file', audioBlob, 'audio.wav') // Use 'file' parameter for direct audio upload
  formData.append('type', '2')
  formData.append('resolution', resolution)

  console.log('Preparing FormData for Vidnoz with direct file uploads:', {
    avatarBlobSize: avatarBlob.size,
    audioBlobSize: audioBlob.size,
    type: '2',
    resolution,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Vidnoz generate video API Error:', response.status, errorBody)
    throw new Error(`Vidnoz generate video API failed with status ${response.status}: ${errorBody}`)
  }

  const result = await response.json()
  console.log('Vidnoz generate video API Success:', result)

  if (result.code !== 200) {
    throw new Error(`Vidnoz API returned error code: ${result.code} - ${result.message}`)
  }

  return { taskId: result.data.task_id }
}

/**
 * Get talking video generation status
 */
export async function getTalkingVideoStatus(
  taskId: string
): Promise<{ status: 'pending' | 'generating' | 'success' | 'failed'; videoUrl?: string; duration?: number }> {
  const url = `${VIDNOZ_API_BASE}/v2/task/detail`

  console.log('Checking Vidnoz video status for task:', taskId)

  // Use FormData (multipart/form-data) - API requires this format
  const formData = new FormData()
  formData.append('id', taskId)

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Vidnoz get status API Error:', response.status, errorBody)
    throw new Error(`Vidnoz get status API failed with status ${response.status}: ${errorBody}`)
  }

  const result = await response.json()
  console.log('Vidnoz get status API Success:', result)

  if (result.code !== 200) {
    throw new Error(`Vidnoz API returned error code: ${result.code} - ${result.message}`)
  }

  const taskData = result.data

  // Debug logging
  console.log('=== Vidnoz API Debug Info ===')
  console.log('Task status code:', taskData.status)
  console.log('Additional data keys:', Object.keys(taskData.additional_data || {}))
  console.log('Available video URLs:', {
    defaultUrl: taskData.additional_data?.url,
    video720p: taskData.additional_data?.video_720p,
    video1080p: taskData.additional_data?.video_1080p,
  })
  console.log('Full additional_data:', JSON.stringify(taskData.additional_data, null, 2))
  console.log('=============================')

  let status: 'pending' | 'generating' | 'success' | 'failed'
  let videoUrl: string | undefined
  let duration: number | undefined

  // Vidnoz status codes (according to API docs):
  // -1 = not executed
  // -2 = in execution
  // 0  = completed
  if (taskData.status === -1 || taskData.status === -2) {
    status = 'generating'
  } else if (taskData.status === 0) {
    status = 'success'
    // Prefer 720p URL, fallback to default URL
    videoUrl = taskData.additional_data?.video_720p?.url
            || taskData.additional_data?.url
    duration = taskData.additional_data?.video_720p?.video_duration
            || taskData.additional_data?.video_duration

    console.log('Selected video URL:', videoUrl)
    console.log('Is 720p available:', !!taskData.additional_data?.video_720p)
  } else {
    status = 'failed'
  }

  return { status, videoUrl, duration }
}
