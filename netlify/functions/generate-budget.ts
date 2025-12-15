import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BudgetRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceId: string;
  quantity: number;
  distanceKm: number;
  difficultyFactor: number;
  description?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cuerpo de la petición vacío' }),
      };
    }

    const data: BudgetRequest = JSON.parse(event.body);

    if (
      !data.clientName ||
      !data.clientEmail ||
      !data.serviceId ||
      !data.quantity ||
      !data.distanceKm ||
      !data.difficultyFactor
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Datos incompletos para generar presupuesto' }),
      };
    }

    /* ===========================
       CLIENTE
    =========================== */

    const existingClient = await supabase
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    if (existingClient.error) {
      throw new Error(existingClient.error.message);
    }

    let clientId: string;

    if (!existingClient.data) {
      const newClient = await supabase
        .from('clients')
        .insert({
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone || '',
        })
        .select()
        .single();

      if (newClient.error || !newClient.data) {
        throw new Error('Error al crear cliente');
      }

      clientId = newClient.data.id;
    } else {
      clientId = existingClient.data.id;
    }

    /* ===========================
       SERVICIO
    =========================== */

    const service = await supabase
      .from('services')
      .select('*')
      .eq('id', data.serviceId)
      .single();

    if (service.error || !service.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Servicio no encontrado' }),
      };
    }

    const basePrice = Number(service.data.base_price);
    const quantity = Number(data.quantity);

    const distanceFee =
      data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;

    const difficultyMultiplier = Number(data.difficultyFactor);

    const subtotal = basePrice * quantity;
    const totalPrice = (subtotal + distanceFee) * difficultyMultiplier;

    /* ===========================
       PRESUPUESTO
    =========================== */

    const budget = await supabase
      .from('budgets')
      .insert({
        client_id: clientId,
        service_id: data.serviceId,
        quantity: quantity,
        distance_km: data.distanceKm,
        difficulty_factor: difficultyMultiplier,
        total_price: totalPrice.toFixed(2),
        description: data.description || '',
        status: 'pending',
      })
      .select()
      .single();

    if (budget.error || !budget.data) {
      throw new Error('Error al crear presupuesto');
    }

    /* ===========================
       EMAIL
    =========================== */

    const emailContent = generateEmailContent(
      data.clientName,
      service.data.name,
      service.data.unit,
      quantity,
      basePrice,
      data.distanceKm,
      distanceFee,
      difficultyMultiplier,
      totalPrice,
      data.description || ''
    );

    await supabase.from('email_history').insert({
      budget_id: budget.data.id,
      type: 'proposal',
      content: emailContent,
    });

    const emailSent = await sendEmail(
      data.clientEmail,
      data.clientName,
      emailContent
    );

    if (emailSent) {
      await supabase
        .from('budgets')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', budget.data.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        budgetId: budget.data.id,
        totalPrice: totalPrice.toFixed(2),
        emailSent,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/* ===========================
   EMAIL TEMPLATE
=========================== */

function generateEmailContent(
  clientName: string,
  serviceName: string,
  unit: string,
  quantity: number,
  basePrice: number,
  distanceKm: number,
  distanceFee: number,
  difficultyFactor: number,
  totalPrice: number,
  description: string
): string {
  return `
Hola ${clientName},

Gracias por solicitar un presupuesto. A continuación te detallamos el cálculo completo:

══════════════════════════════════════
PRESUPUESTO DETALLADO
══════════════════════════════════════

Servicio: ${serviceName}
Superficie / Cantidad: ${quantity} ${unit}
Precio base: ${basePrice.toFixed(2)} € por ${unit}

CÁLCULO DEL IMPORTE
────────────────────────────────────
Subtotal: ${(basePrice * quantity).toFixed(2)} €
${distanceFee > 0
  ? `Desplazamiento (${distanceKm} km): ${distanceFee.toFixed(2)} €`
  : 'Desplazamiento incluido (hasta 15 km)'}

${difficultyFactor > 1
  ? `Factor de dificultad aplicado: x${difficultyFactor}`
  : 'Dificultad estándar'}

══════════════════════════════════════
IMPORTE TOTAL: ${totalPrice.toFixed(2)} €
══════════════════════════════════════

${description ? `Observaciones:\n${description}\n\n` : ''}
Presupuesto elaborado tras visita técnica.
Validez del presupuesto: 15 días.

Quedamos a tu disposición para cualquier consulta.

Un saludo cordial.
`.trim();
}

/* ===========================
   EMAIL SENDER (RESEND)
=========================== */

async function sendEmail(
  to: string,
  name: string,
  content: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY no configurada');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Presupuestos <presupuestos@tuempresa.com>',
        to: [to],
        subject: `Presupuesto para ${name}`,
        text: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}
