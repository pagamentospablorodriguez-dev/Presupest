import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { observations, baseTotal } = JSON.parse(event.body || '{}');

    if (!observations) {
      return { statusCode: 200, body: JSON.stringify({ adjustment: 0, reason: '' }) };
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { statusCode: 200, body: JSON.stringify({ adjustment: 0, reason: '' }) };
    }

    const prompt = `Analiza estas observaciones de obra y determina si requieren ajuste de precio:

OBSERVACIONES: "${observations}"
PRESUPUESTO BASE: ${baseTotal}€

Responde en JSON con este formato exacto:
{
  "hasAdjustment": boolean,
  "adjustment": número (positivo o negativo),
  "reason": "texto corto explicando el ajuste"
}

REGLAS:
- Si menciona dificultades extra, acceso complicado, alturas, refuerzos → suma 5-15%
- Si menciona necesidad de permisos, trámites especiales → suma 8%
- Si menciona materiales especiales caros → suma 10-20%
- Si menciona urgencia/rapidez → suma 10%
- Si menciona simplificación de trabajo → resta 5%
- Si no hay motivo para ajuste → adjustment: 0

Responde SOLO el JSON, sin explicaciones adicionales.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    const adjustment = result.hasAdjustment ? result.adjustment : 0;
    const percentAdjustment = (baseTotal * (adjustment / 100)).toFixed(2);

    return {
      statusCode: 200,
      body: JSON.stringify({
        adjustment: parseFloat(percentAdjustment),
        reason: result.reason || '',
      }),
    };
  } catch (error: any) {
    return { statusCode: 200, body: JSON.stringify({ adjustment: 0, reason: '' }) };
  }
};
