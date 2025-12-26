/**
 * Admin authentication utilities
 * Uses environment variable ADMIN_EMAILS to define admin users
 */

/**
 * Get admin emails from runtime config (comma-separated)
 */
export function getAdminEmails(): string[] {
  const config = useRuntimeConfig()
  const emails = config.adminEmails as string
  if (!emails) return []
  return emails.split(',').map((email: string) => email.trim().toLowerCase())
}

/**
 * Check if an email address belongs to an admin user
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.includes(email.toLowerCase())
}

/**
 * Validate admin access and return error response if not authorized
 * Use this in API routes for consistent error handling
 */
export function validateAdminAccess(userEmail: string | undefined | null): {
  authorized: boolean
  error?: { message: string; statusCode: number }
} {
  if (!userEmail) {
    return {
      authorized: false,
      error: { message: 'Authentication required', statusCode: 401 },
    }
  }

  if (!isAdminEmail(userEmail)) {
    return {
      authorized: false,
      error: { message: 'Admin access required', statusCode: 403 },
    }
  }

  return { authorized: true }
}
