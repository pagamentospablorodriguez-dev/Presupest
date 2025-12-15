import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/Bolt Database-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const Bolt Database = createClient(supabaseUrl, supabaseKey);
    const data: BudgetRequest = JSON.parse(event.body || '{}');

    let client = await Bolt Database
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    let clientId: string;

    if (!client.data) {
      const newClient = await Bolt Database
        .from('clients')
        .insert({
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone || '',
        })
        .select()
        .single();

      clientId = newClient.data!.id;
    } else {
      clientId = client.data.id;
    }

    const service = await Bolt Database
      .from('services')
      .select('*')
      .eq('id', data.serviceId)
      .single();

    if (!service.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Servicio no encontrado' }),
      };
    }

    const basePrice = parseFloat(service.data.base_price);
    const quantity = data.quantity;
    const distanceFee = data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;
    const difficultyMultiplier = data.difficultyFactor;

    const subtotal = basePrice * quantity;
    const totalPrice = (subtotal + distanceFee) * difficultyMultiplier;

    const budget = await Bolt Database
      .from('budgets')
      .insert({
        client_id: clientId,
        service_id: data.serviceId,
        quantity: quantity,
        distance_km: data.distanceKm,
        difficulty_factor: data.difficultyFactor,
        total_price: totalPrice.toFixed(2),
        description: data.description || '',
        status: 'pending',
      })
      .select()
      .single();

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
      budget_id: budget.data!.id,
      type: 'proposal',
      content: emailContent,
    });

    const emailSent = await sendEmail(
      data.clientEmail,
      data.clientName,
      emailContent
    );

    if (emailSent) {
      await Bolt Database
        .from('budgets')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', budget.data!.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        budgetId: budget.data!.id,
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

¡Gracias por solicitar un presupuesto! A continuación te detallo el desglose completo:

═══════════════════════════════════════
PRESUPUESTO DETALLADO
═══════════════════════════════════════

Servicio: ${serviceName}
Cantidad: ${quantity} ${unit}
Precio base: ${basePrice.toFixed(2)}€ por ${unit}

CÁLCULO DEL IMPORTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: ${(basePrice * quantity).toFixed(2)}€
${distanceFee > 0 ? `Gastos de desplazamiento (${distanceKm}km): ${distanceFee.toFixed(2)}€` : 'Sin gastos de desplazamiento (hasta 15km)'}
${difficultyFactor > 1 ? `Factor de complejidad (${difficultyFactor}x): Trabajo con dificultad superior al estándar` : ''}

═══════════════════════════════════════
IMPORTE TOTAL: ${totalPrice.toFixed(2)}€
═══════════════════════════════════════

${description ? `Observaciones:\n${description}\n` : ''}

Este presupuesto tiene una validez de 15 días.

¡Estamos a tu disposición para cualquier consulta!

Atentamente,
Equipo de Presupuestos
  `.trim();
}

async function sendEmail(
  to: string,
  name: string,
  content: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY no configurada. Email no enviado.');
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
        from: process.env.EMAIL_FROM || 'Presupuestos <presupuestos@example.com>',
        to: [to],
        subject: `Presupuesto para ${name}`,
        text: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error al enviar email:', error);
    return false;
  }
}
