import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const data: BudgetRequest = JSON.parse(event.body || '{}');

    let client = await supabase
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    let clientId: string;

    if (!client.data) {
      const newClient = await supabase
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

    const service = await supabase
      .from('services')
      .select('*')
      .eq('id', data.serviceId)
      .single();

    if (!service.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    const basePrice = parseFloat(service.data.base_price);
    const quantity = data.quantity;
    const distanceFee = data.distanceKm > 10 ? (data.distanceKm - 10) * 5 : 0;
    const difficultyMultiplier = data.difficultyFactor;

    const subtotal = basePrice * quantity;
    const totalPrice = (subtotal + distanceFee) * difficultyMultiplier;

    const budget = await supabase
      .from('budgets')
      .insert({
        client_id: clientId,
        service_id: data.serviceId,
        quantity: quantity,
        distance_km: data.distanceKm,
        difficulty_factor: difficultyFactor,
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
      await supabase
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
Olá ${clientName},

Obrigado por solicitar um orçamento! Segue abaixo o detalhamento completo:

═══════════════════════════════════════
ORÇAMENTO DETALHADO
═══════════════════════════════════════

Serviço: ${serviceName}
Quantidade: ${quantity} ${unit}
Preço base: R$ ${basePrice.toFixed(2)} por ${unit}

CÁLCULO DO VALOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: R$ ${(basePrice * quantity).toFixed(2)}
${distanceFee > 0 ? `Taxa de deslocamento (${distanceKm}km): R$ ${distanceFee.toFixed(2)}` : 'Sem taxa de deslocamento (até 10km)'}
${difficultyFactor > 1 ? `Fator de complexidade (${difficultyFactor}x): Trabalho com dificuldade acima do padrão` : ''}

═══════════════════════════════════════
VALOR TOTAL: R$ ${totalPrice.toFixed(2)}
═══════════════════════════════════════

${description ? `Observações:\n${description}\n` : ''}

Este orçamento é válido por 15 dias.

Estamos à disposição para qualquer dúvida!

Atenciosamente,
Equipe de Orçamentos
  `.trim();
}

async function sendEmail(
  to: string,
  name: string,
  content: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured. Email not sent.');
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
        from: process.env.EMAIL_FROM || 'Orçamentos <orcamentos@example.com>',
        to: [to],
        subject: `Orçamento para ${name}`,
        text: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
