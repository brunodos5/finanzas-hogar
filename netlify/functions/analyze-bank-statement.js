const { json, callOpenAI, conceptsSummary, learningRulesSummary } = require('./_shared');

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['movimientos'],
  properties: {
    movimientos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'concepto', 'categoria', 'desc', 'monto', 'fecha', 'notas'],
        properties: {
          tipo: { type: 'string', enum: ['ingreso', 'gasto'] },
          concepto: { type: 'string' },
          categoria: { type: 'string' },
          desc: { type: 'string' },
          monto: { type: 'number' },
          fecha: { type: 'string' },
          notas: { type: 'string' }
        }
      }
    }
  }
};

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { text, fileName, concepts, learningRules, defaultType } = JSON.parse(event.body || '{}');
    if (!text || text.length < 10) return json(400, { error: 'Missing statement text' });

    const prompt = [
      'Extraé SOLO movimientos/transacciones reales de este estado de cuenta bancario.',
      'Ignorá encabezados, saldos iniciales/finales, totales, subtotales, números de cuenta, páginas y líneas informativas.',
      'Cada movimiento debe tener fecha YYYY-MM-DD, descripción, monto positivo y tipo ingreso/gasto.',
      `Si el signo o columna no es clara, usá tipo por defecto: ${defaultType || 'gasto'}.`,
      'Débitos, compras, pagos, retiros y cargos son gasto. Créditos, depósitos, transferencias recibidas y sueldo son ingreso.',
      'Priorizá estas correcciones aprendidas del usuario cuando el comercio o texto coincida:',
      learningRulesSummary(learningRules || []) || 'Sin correcciones aprendidas todavia.',
      'Elegí el concepto y categoría más cercanos de esta lista:',
      conceptsSummary(concepts || []),
      `Archivo: ${fileName || 'estado de cuenta'}`,
      'Contenido:',
      text.slice(0, 50000)
    ].join('\n\n');

    const result = await callOpenAI([
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    ], 'bank_statement_result', schema);

    result.movimientos = (result.movimientos || []).filter(m => m.fecha && m.monto > 0 && m.desc);
    return json(200, result);
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Unexpected error' });
  }
};
