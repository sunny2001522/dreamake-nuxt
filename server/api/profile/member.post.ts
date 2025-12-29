/**
 * POST /api/profile/member
 *
 * Proxy endpoint for CMoney Profile API to avoid CORS issues.
 * Fetches user profile (nickname, email, image) from CMoney auth service.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { accessToken } = body

  if (!accessToken) {
    throw createError({
      statusCode: 400,
      message: 'Access token is required',
    })
  }

  const config = useRuntimeConfig()
  const PROFILE_DOMAIN = config.public.profileServiceDomain

  if (!PROFILE_DOMAIN) {
    throw createError({
      statusCode: 500,
      message: 'Profile service domain not configured',
    })
  }

  try {
    const response = await $fetch(`${PROFILE_DOMAIN}/graphql/query/member`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: { fields: '{ nickname email image }' },
    })

    return response
  } catch (error: any) {
    console.error('Failed to fetch profile from CMoney:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch profile',
    })
  }
})
