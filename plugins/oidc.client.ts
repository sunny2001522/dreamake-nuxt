import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { clientId } from '~/constants/appInfo'

export default defineNuxtPlugin((nuxtApp) => {
  const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN
  const OIDC_DOMAIN = import.meta.env.VITE_OIDC_DOMAIN

  // 確保環境變數存在
  if (!OIDC_DOMAIN) {
    console.error('VITE_OIDC_DOMAIN environment variable is not set')
    return
  }

  const manager = new UserManager({
    authority: OIDC_DOMAIN,
    client_id: clientId,
    redirect_uri: `${BASE_DOMAIN}/login`,
    response_type: 'code',
    scope: 'openid nickname',
    post_logout_redirect_uri: `${BASE_DOMAIN}/logout`,
    silent_redirect_uri: `${BASE_DOMAIN}/refresh`,
    accessTokenExpiringNotificationTimeInSeconds: 10,
    automaticSilentRenew: true,
    filterProtocolClaims: false,
    monitorSession: true,
    metadata: {
      issuer: OIDC_DOMAIN,
      authorization_endpoint: `${OIDC_DOMAIN}/identity/authorize`,
      token_endpoint: `${OIDC_DOMAIN}/identity/token`,
      end_session_endpoint: `${OIDC_DOMAIN}/identity/endsession`,
      jwks_uri: `${OIDC_DOMAIN}/identity/keys/jwks`,
      check_session_iframe: `${OIDC_DOMAIN}/identity/checksession`,
    },
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  })

  nuxtApp.provide('manager', manager)
})
