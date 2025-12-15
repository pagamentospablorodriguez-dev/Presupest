import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/Bolt Database-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const Bolt Database = createClient(supabaseUrl, supabaseServiceKey);

interface BudgetItem {
  serviceId: string;
  quantity: number;
  customNotes?: string;
}

interface ProjectRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectName: string;
  distanceKm: number;
  globalDifficulty: number;
  observations?: string;
  items: BudgetItem[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const data: ProjectRequest = JSON.parse(event.body || '{}');

    // Crear o encontrar cliente
    let existingClient = await Bolt Database
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    let clientId: string;
    if (!existingClient.data) {
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
      clientId = existingClient.data.id;
    }

    // Calcular todos los servicios
    let subtotalGeneral = 0;
    const itemsDetails = [];

    for (const item of data.items) {
      const service = await Bolt Database
        .from('services')
        .select('*')
        .eq('id', item.serviceId)
        .single();

      if (!service.data) continue;

      const basePrice = Number(service.data.base_price);
      const quantity = Number(item.quantity);
      const subtotal = basePrice * quantity;

      subtotalGeneral += subtotal;

      itemsDetails.push({
        service: service.data,
        quantity,
        subtotal,
        notes: item.customNotes || '',
      });
    }

    // Desplazamiento (UNA vez para toda la obra)
    const distanceFee = data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;

    // Total con dificultad
    const totalPrice = (subtotalGeneral + distanceFee) * data.globalDifficulty;

    // Crear proyecto
    const project = await Bolt Database
      .from('projects')
      .insert({
        client_id: clientId,
        project_name: data.projectName,
        distance_km: data.distanceKm,
        global_difficulty: data.globalDifficulty,
        observations: data.observations || '',
        total_price: totalPrice.toFixed(2),
        status: 'pending',
      })
      .select()
      .single();

    // Guardar items
    for (let i = 0; i < data.items.length; i++) {
      await supabase.from('budget_items').insert({
        project_id: project.data!.id,
        service_id: data.items[i].serviceId,
        quantity: data.items[i].quantity,
        custom_notes: data.items[i].customNotes || '',
        subtotal: itemsDetails[i].subtotal,
      });
    }

    // Email consolidado
    const emailContent = generateConsolidatedEmail(
      data.clientName,
      data.projectName,
      itemsDetails,
      subtotalGeneral,
      data.distanceKm,
      distanceFee,
      data.globalDifficulty,
      totalPrice,
      data.observations || ''
    );

    await supabase.from('email_history').insert({
      budget_id: project.data!.id,
      type: 'proposal',
      content: emailContent,
    });

    const emailSent = await sendEmail(data.clientEmail, data.clientName, data.projectName, emailContent);

    if (emailSent) {
      await Bolt Database
        .from('projects')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', project.data!.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        projectId: project.data!.id,
        totalPrice: totalPrice.toFixed(2),
        emailSent,
      }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

function generateConsolidatedEmail(
  clientName: string,
  projectName: string,
  items: any[],
  subtotal: number,
  distanceKm: number,
  distanceFee: number,
  difficulty: number,
  totalPrice: number,
  observations: string
): string {
  let itemsList = '';
  items.forEach((item, idx) => {
    itemsList += `${idx + 1}. ${item.service.name}\n`;
    itemsList += `   ${item.quantity} ${item.service.unit} × ${item.service.base_price}€ = ${item.subtotal.toFixed(2)}€\n`;
    if (item.notes) itemsList += `   Nota: ${item.notes}\n`;
    itemsList += '\n';
  });

  return `
Estimado/a ${clientName},

Tras nuestra visita técnica, le presentamos el presupuesto detallado para la obra solicitada.

═══════════════════════════════════════════════════════════
PRESUPUESTO: ${projectName.toUpperCase()}
═══════════════════════════════════════════════════════════

SERVICIOS INCLUIDOS
───────────────────────────────────────────────────────────

${itemsList}

───────────────────────────────────────────────────────────
Subtotal servicios:                        ${subtotal.toFixed(2)}€
${distanceFee > 0 ? `Desplazamiento (${distanceKm} km):                  ${distanceFee.toFixed(2)}€` : ''}
${difficulty > 1 ? `Factor de complejidad (x${difficulty}):              Aplicado` : ''}

═══════════════════════════════════════════════════════════
IMPORTE TOTAL:                             ${totalPrice.toFixed(2)}€
═══════════════════════════════════════════════════════════

${observations ? `OBSERVACIONES:\n${observations}\n\n` : ''}
✓ Presupuesto elaborado tras visita técnica
✓ Materiales de calidad incluidos
✓ Garantía del trabajo realizado
✓ Validez: 15 días

Quedamos a su disposición para cualquier consulta o aclaración.

Un cordial saludo.
  `.trim();
}

async function sendEmail(to: string, name: string, project: string, content: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return false;

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
        subject: `Presupuesto: ${project} - ${name}`,
        text: content,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
