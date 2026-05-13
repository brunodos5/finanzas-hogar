const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function requireOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('Missing OPENAI_API_KEY');
    err.statusCode = 500;
    throw err;
  }
}

async function callOpenAI(input, schemaName, schema) {
  requireOpenAIKey();
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
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
