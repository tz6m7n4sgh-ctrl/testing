// LinkedIn OpenID Connect (OIDC) OAuth 2.0
// Scopes: openid profile email — r_liteprofile/r_emailaddress are deprecated since 2024
const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  REDIRECT_URI = 'http://localhost:3000/auth/callback'
} = process.env;

export function buildUrl(state) {
  if (!LINKEDIN_CLIENT_ID) throw new Error('LINKEDIN_CLIENT_ID not set');
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    scope: 'openid profile email'
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function exchangeCode(code) {
  const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed ${resp.status}: ${text}`);
  }
  return resp.json();
}

// OIDC userinfo — returns sub, name, given_name, family_name, picture, email
export async function getProfile(accessToken) {
  const resp = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000)
  });
  if (!resp.ok) throw new Error(`Profile fetch failed ${resp.status}`);
  return resp.json();
}
