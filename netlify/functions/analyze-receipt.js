const { json, callOpenAI, conceptsSummary, learningRulesSummary } = require('./_shared');

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['is_receipt', 'tipo', 'concepto', 'categoria', 'desc', 'monto', 'fecha', 'notas'],
  properties: {
    is_receipt: { type: 'boolean' },
    tipo: { type: 'string', enum: ['gasto'] },
    concepto: { type: 'string' },
    categoria: { type: 'string' },
    desc: { type: 'string' },
    monto: { type: 'number' },
    fecha: { type: 'string' },
    notas: { type: 'string' }
  }
};

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { file, concepts, learningRules, today } = JSON.parse(event.body || '{}');
    if (!file?.data || !file?.type) return json(400, { error: 'Missing file data' });

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const filePart = isPdf
      ? { type: 'input_file', filename: file.name || 'comprobante.pdf', file_data: `data:${file.type};base64,${file.data}` }
      : { type: 'input_image', image_url: `data:${file.type};base64,${file.data}`, detail: 'high' };

    const prompt = [
      'Analizá este comprobante, ticket, recibo o factura de Uruguay/Español.',
      'Devolvé solamente datos del gasto principal. No inventes datos si no están claros.',
      `Si no ves fecha, usá ${today}. La fecha debe ser YYYY-MM-DD.`,
      'El monto debe ser el total final pagado, número positivo, sin símbolo de moneda.',
      'Priorizá estas correcciones aprendidas del usuario cuando el comercio o texto coincida:',
      learningRulesSummary((learningRules || []).filter(r => r.tipo === 'gasto')) || 'Sin correcciones aprendidas todavia.',
      'Elegí el concepto y categoría más cercanos de esta lista:',
      conceptsSummary((concepts || []).filter(c => c.tipo === 'gasto'))
    ].join('\n\n');

    const result = await callOpenAI([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          filePart
        ]
      }
    ], 'receipt_result', schema);

    return json(200, result);
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Unexpected error' });
  }
};
