const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { json, requireAllowedOrigin, parseJsonBody } = require('./_shared');

const STORE_NAME = 'finanzas-casa-users';
const USERS_KEY = 'app-users';
const DEFAULT_ADMIN_HASH = 'dd821402cfc9e94d7619b7bc673b584458cfee8d866fdab75ec4bf12f3d12f56';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function authSecret() {
  return process.env.APP_AUTH_SECRET || process.env.NETLIFY_SITE_ID || process.env.SITE_ID || 'finanzas-casa-local-secret';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

function makeToken(user) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  }));
  return `${payload}.${signPayload(payload)}`;
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

function normalizeUser(user) {
  const username = normalizeUsername(user?.username);
  if (!username || !user?.passwordHash) return null;
  return {
    id: user.id || crypto.randomUUID(),
    username,
    role: user.role === 'admin' ? 'admin' : 'user',
    active: user.active !== false,
    passwordHash: user.passwordHash,
    updatedAt: user.updatedAt || new Date().toISOString()
  };
}

function defaultUsers() {
  return [{
    id: 'admin-bruno',
    username: 'bruno',
    role: 'admin',
    active: true,
    passwordHash: DEFAULT_ADMIN_HASH,
    updatedAt: '2026-01-01T00:00:00.000Z'
  }];
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    active: user.active !== false,
    updatedAt: user.updatedAt || ''
  };
}

async function getUsers() {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const stored = await store.get(USERS_KEY, { type: 'json' });
  const users = Array.isArray(stored?.users) ? stored.users.map(normalizeUser).filter(Boolean) : [];
  if (!users.some(user => user.username === 'bruno')) users.unshift(defaultUsers()[0]);
  return users;
}

async function saveUsers(users) {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  await store.setJSON(USERS_KEY, { users, updatedAt: new Date().toISOString() });
}

function requireAdmin(event) {
  const headers = event.headers || {};
  const auth = headers.authorization || headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const session = verifyToken(token);
  if (!session || session.role !== 'admin') {
    const err = new Error('Solo administrador.');
    err.statusCode = 403;
    throw err;
  }
  return session;
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    requireAllowedOrigin(event);
    const body = parseJsonBody(event, 20000);
    const action = body.action;
    const users = await getUsers();

    if (action === 'login') {
      const username = normalizeUsername(body.username);
      const passwordHash = hashPassword(body.password);
      const user = users.find(item => item.username === username && item.passwordHash === passwordHash && item.active !== false);
      if (!user) return json(401, { error: 'Usuario o contraseña incorrectos.' });
      return json(200, { user: publicUser(user), token: makeToken(user) });
    }

    requireAdmin(event);

    if (action === 'list') {
      return json(200, { users: users.map(publicUser) });
    }

    if (action === 'save') {
      const username = normalizeUsername(body.username);
      const role = body.role === 'admin' ? 'admin' : 'user';
      const active = body.active !== false;
      const password = String(body.password || '');
      if (!username) return json(400, { error: 'Ingresa un usuario.' });

      let user = body.id ? users.find(item => item.id === body.id) : null;
      if (users.some(item => item.id !== body.id && item.username === username)) return json(409, { error: 'Ese usuario ya existe.' });
      if (!user && !password) return json(400, { error: 'Ingresa una contraseña.' });

      const now = new Date().toISOString();
      if (!user) {
        user = { id: crypto.randomUUID(), username, role, active, passwordHash: hashPassword(password), updatedAt: now };
        users.push(user);
      } else {
        Object.assign(user, { username, role, active, updatedAt: now });
        if (password) user.passwordHash = hashPassword(password);
      }
      await saveUsers(users);
      return json(200, { users: users.map(publicUser) });
    }

    if (action === 'delete') {
      const user = users.find(item => item.id === body.id);
      if (!user || user.username === 'bruno') return json(400, { error: 'No se puede eliminar ese usuario.' });
      await saveUsers(users.filter(item => item.id !== body.id));
      return json(200, { users: users.filter(item => item.id !== body.id).map(publicUser) });
    }

    return json(400, { error: 'Accion invalida.' });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Unexpected error' });
  }
};
