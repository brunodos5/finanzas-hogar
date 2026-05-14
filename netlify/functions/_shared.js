const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || process.env.NETLIFY_AI_GATEWAY_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_URL = `${OPENAI_BASE_URL.replace(/\/$/, '')}/responses`;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_ALLOWED_ORIGIN = 'https://finanzas-hogar-263.netlify.app';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Vary': 'Origin'
    },
    body: JSON.stringify(body)
  };
}

function header(event, name) {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? found[1] : '';
}

function allowedOrigins() {
  return [
    process.env.APP_ORIGIN,
    process.env.URL,
    DEFAULT_ALLOWED_ORIGIN
  ].filter(Boolean).map(value => {
    try { return new URL(value).origin; } catch { return String(value).replace(/\/$/, ''); }
  });
}

function requireAllowedOrigin(event) {
  const origin = header(event, 'origin');
  if (!origin) return;
  if (!allowedOrigins().includes(origin)) {
    const err = new Error('Origin not allowed');
    err.statusCode = 403;
    throw err;
  }
}

function parseJsonBody(event, maxBytes = 300000) {
  const body = event.body || '';
  const bytes = Buffer.byteLength(body, event.isBase64Encoded ? 'base64' : 'utf8');
  if (bytes > maxBytes) {
    const err = new Error('Archivo demasiado grande para analizar.');
    err.statusCode = 413;
    throw err;
  }
  return JSON.parse(body || '{}');
}

function getOpenAIHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = process.env.OPENAI_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function requireOpenAIAccess() {
  if (!process.env.OPENAI_BASE_URL && !process.env.OPENAI_API_KEY && !process.env.NETLIFY_AI_GATEWAY_BASE_URL && !process.env.NETLIFY_AI_GATEWAY_KEY) {
    const err = new Error('Enable Netlify AI Gateway or set OPENAI_API_KEY');
    err.statusCode = 500;
    throw err;
  }
}

async function callOpenAI(input, schemaName, schema) {
  requireOpenAIAccess();
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: getOpenAIHeaders(),
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || 'OpenAI request failed');
    err.statusCode = res.status;
    throw err;
  }

  const text = data.output_text || data.output?.flatMap(item => item.content || []).map(part => part.text || '').join('');
  return JSON.parse(text);
}

function conceptsSummary(concepts) {
  return (concepts || [])
    .map(c => `${c.tipo}: ${c.nombre} -> ${c.categoria}`)
    .join('\n')
    .slice(0, 12000);
}

function learningRulesSummary(rules) {
  return (rules || [])
    .map(r => `${r.tipo}: "${r.texto}" => ${r.categoria}`)
    .join('\n')
    .slice(0, 8000);
}

exports.json = json;
exports.callOpenAI = callOpenAI;
exports.conceptsSummary = conceptsSummary;
exports.learningRulesSummary = learningRulesSummary;
exports.requireAllowedOrigin = requireAllowedOrigin;
exports.parseJsonBody = parseJsonBody;
