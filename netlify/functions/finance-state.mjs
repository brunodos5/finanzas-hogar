import crypto from 'crypto';

const DEFAULT_ALLOWED_ORIGIN = 'https://finanzas-hogar-263.netlify.app';
const DEFAULT_SUPABASE_URL = 'https://mnkkearluehndvkudulc.supabase.co';
const DEFAULT_FAMILY_EMAIL = 'familia+finanzas-casa@finanzas-hogar.app';

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || '';
}

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Vary': 'Origin'
    }
  });
}

function allowedOrigins() {
  return [env('APP_ORIGIN'), env('URL'), DEFAULT_ALLOWED_ORIGIN]
    .filter(Boolean)
    .map(value => {
      try { return new URL(value).origin; }
      catch { return String(value).replace(/\/$/, ''); }
    });
}

function requireAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins().includes(origin)) {
    const err = new Error('Origin not allowed');
    err.statusCode = 403;
    throw err;
  }
}

function authSecret() {
  return env('APP_AUTH_SECRET') || env('NETLIFY_SITE_ID') || env('SITE_ID') || 'finanzas-casa-local-secret';
}

function signPayload(payload) {
  return crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || signature !== signPayload(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function requireAppSession(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const session = verifyToken(token);
  if (!session?.username) {
    const err = new Error('Sesion invalida.');
    err.statusCode = 401;
    throw err;
  }
  return session;
}

function supabaseConfig() {
  const url = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_KEY');
  if (!key) {
    const err = new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY en Netlify.');
    err.statusCode = 500;
    throw err;
  }
  return { url, key };
}

function familyEmail() {
  return (env('FAMILY_SYNC_EMAIL') || DEFAULT_FAMILY_EMAIL).trim().toLowerCase();
}

function familyPassword() {
  return crypto.createHash('sha256').update(`${authSecret()}:familia-compartida`).digest('base64url').slice(0, 32);
}

async function listAuthUsers(url, key) {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=100&page=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.msg || body?.message || 'No pude leer usuarios de Supabase Auth.');
  return Array.isArray(body?.users) ? body.users : [];
}

async function createFamilyAuthUser(url, key, email) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password: familyPassword(),
      email_confirm: true,
      user_metadata: { app: 'finanzas-casa', purpose: 'shared-family-state' }
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.msg || body?.message || 'No pude crear el usuario familiar en Supabase Auth.');
  return body;
}

async function familyUserId() {
  const configured = env('FAMILY_SYNC_USER_ID');
  if (configured) return configured;
  const { url, key } = supabaseConfig();
  const email = familyEmail();
  const users = await listAuthUsers(url, key);
  const existing = users.find(user => String(user.email || '').toLowerCase() === email);
  if (existing?.id) return existing.id;
  try {
    const created = await createFamilyAuthUser(url, key, email);
    if (created?.id) return created.id;
  } catch (err) {
    const nextUsers = await listAuthUsers(url, key);
    const nextExisting = nextUsers.find(user => String(user.email || '').toLowerCase() === email);
    if (nextExisting?.id) return nextExisting.id;
    throw err;
  }
  throw new Error('No pude preparar el usuario familiar de Supabase.');
}

async function readState(userId) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/finance_states?user_id=eq.${encodeURIComponent(userId)}&select=data,updated_at&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const rows = await res.json();
  if (!res.ok) throw new Error(rows?.message || 'No pude leer Supabase.');
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function writeState(userId, data) {
  const { url, key } = supabaseConfig();
  const updatedAt = new Date().toISOString();
  const res = await fetch(`${url}/rest/v1/finance_states?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify({ user_id: userId, data, updated_at: updatedAt })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || 'No pude guardar en Supabase.');
  return { updated_at: updatedAt };
}

export default async request => {
  if (request.method === 'OPTIONS') return response(200, {});
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    requireAllowedOrigin(request);
    requireAppSession(request);
    const userId = await familyUserId();
    const body = await request.json();

    if (body.action === 'download') {
      const state = await readState(userId);
      return response(200, { userId, state });
    }

    if (body.action === 'sync') {
      const current = await readState(userId);
      const saved = await writeState(userId, body.data || {});
      return response(200, { userId, state: current, saved });
    }

    return response(400, { error: 'Accion invalida.' });
  } catch (err) {
    return response(err.statusCode || 500, { error: err.message || 'Unexpected error' });
  }
};
