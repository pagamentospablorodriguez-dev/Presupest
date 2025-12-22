import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/Bolt Database-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface InvoiceItem {
  serviceId: string;
  quantity: number;
}

interface InvoiceRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectName?: string;
  observations?: string;
  emailContent?: string;
  emailSubject?: string;
  invoiceNumber?: number;
  items: InvoiceItem[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const data: InvoiceRequest = JSON.parse(event.body || '{}');

    const existingClient = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    let clientId: string;
    if (!existingClient.data) {
      const newClient = await supabaseAdmin
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

    let totalGeneral = 0;
    const itemsDetails: any[] = [];

    for (const item of data.items) {
      const service = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('id', item.serviceId)
        .single();

      if (!service.data) continue;

      const basePrice = Number(service.data.base_price);
      const quantity = Number(item.quantity);
      const itemTotal = basePrice * quantity;
      totalGeneral += itemTotal;

      itemsDetails.push({
        service: service.data,
        quantity,
        itemTotal,
      });
    }

    const invoiceNumber = data.invoiceNumber || 1;

    const invoiceData = {
      client_id: clientId,
      invoice_number: invoiceNumber,
      project_name: data.projectName || '',
      observations: data.observations || '',
      total_price: totalGeneral.toFixed(2),
      status: 'pending',
    };

    const invoice = await supabaseAdmin.from('invoices').insert(invoiceData).select().single();

    for (let i = 0; i < data.items.length; i++) {
      await supabaseAdmin.from('invoice_items').insert({
        invoice_id: invoice.data!.id,
        service_id: data.items[i].serviceId,
        quantity: data.items[i].quantity,
        subtotal: itemsDetails[i].itemTotal,
      });
    }

    const pdfBase64 = await generateInvoicePDF(
      data.clientName,
      data.clientEmail,
      data.clientPhone || '',
      invoiceNumber,
      itemsDetails,
      totalGeneral,
      data.observations || ''
    );

    const emailContent = data.emailContent || `Buenas tardes ${data.clientName.split(' ')[0]},\n\nTe envío la factura ${invoiceNumber}/025.\n\nUn saludo.`;
    const emailSubject = data.emailSubject || `Factura ${invoiceNumber}/025${data.projectName ? ' - ' + data.projectName : ''}`;

    const emailSent = await sendEmailWithPDF(
      data.clientEmail,
      emailSubject,
      emailContent,
      pdfBase64,
      invoiceNumber
    );

    if (emailSent) {
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoice.data!.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        invoiceId: invoice.data!.id,
        totalPrice: invoiceData.total_price,
        emailSent,
      }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function generateInvoicePDF(
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  invoiceNumber: number,
  items: any[],
  total: number,
  observations: string
): Promise<string> {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF();

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getFullYear()).slice(-2)}`;

  doc.setLineWidth(0.8);
  doc.rect(14, 10, 90, 32);
  doc.rect(106, 10, 90, 32);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Eduardo Bruno Rodríguez González', 16, 16);
  doc.setFont(undefined, 'normal');
  doc.text('Calle Tarragona, 27 08570 Torello', 16, 21);
  doc.setFont(undefined, 'bold');
  doc.text('NIF:', 16, 26);
  doc.setFont(undefined, 'normal');
  doc.text(' 44724261W', 23, 26);
  doc.setFont(undefined, 'bold');
  doc.text('Teléfono:', 16, 31);
  doc.setFont(undefined, 'normal');
  doc.text(' 637 30 69 32', 32, 31);
  doc.setFont(undefined, 'bold');
  doc.text('Mail:', 16, 36);
  doc.setFont(undefined, 'normal');
  doc.text(' eduarbruno27@gmail.com', 25, 36);

  doc.setFont(undefined, 'bold');
  doc.text(clientName, 108, 16);
  doc.setFont(undefined, 'normal');
  doc.setFont(undefined, 'bold');
  doc.text('Mail:', 108, 21);
  doc.setFont(undefined, 'normal');
  doc.text(` ${clientEmail}`, 117, 21);
  if (clientPhone) {
    doc.setFont(undefined, 'bold');
    doc.text('Teléfono:', 108, 26);
    doc.setFont(undefined, 'normal');
    doc.text(` ${clientPhone}`, 124, 26);
  }

  doc.setLineWidth(0.8);
  doc.rect(14, 45, 182, 8);

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(`Factura: ${invoiceNumber}/025`, 16, 50);
  doc.setFont(undefined, 'normal');
  doc.text(dateStr, 175, 50);

  doc.setLineWidth(0.8);
  doc.rect(14, 56, 140, 7);
  doc.rect(154, 56, 42, 7);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('DESCRIPCIÓN', 16, 61);
  doc.text('TOTAL', 180, 61, { align: 'right' });
  doc.setFont(undefined, 'normal');

  let yPos = 68;

  items.forEach((item) => {
    const serviceLine = `${item.quantity} ${item.service.unit} ${item.service.name}`;
    doc.text(serviceLine, 16, yPos);
    doc.text(`${item.itemTotal.toFixed(2)} €`, 189, yPos, { align: 'right' });
    yPos += 5;
  });

  if (observations) {
    yPos += 3;
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(`*${observations}`, 180);
    obsLines.forEach((line: string) => {
      doc.text(line, 16, yPos);
      yPos += 4;
    });
    doc.setFontSize(9);
    yPos += 3;
  }

  yPos += 6;
  doc.text('Mètode de pagament: Transferencia bancaria.', 16, yPos);
  yPos += 5;
  doc.text('Entidad: Banco Santander', 16, yPos);
  yPos += 5;
  doc.text('IBAN: ES19 0049 6783 9726 9504 4312', 16, yPos);

  yPos += 12;
  const subtotal = total;
  const iva = subtotal * 0.21;
  const totalTotal = subtotal + iva;

  doc.setFillColor(144, 238, 144);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setFontSize(10);
  doc.setTextColor(0, 128, 0);
  doc.setFont(undefined, 'bold');
  doc.text('SUB-TOTAL', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(`${subtotal.toFixed(2)} €`, 189, yPos, { align: 'right' });

  yPos += 6;
  doc.setFillColor(144, 238, 144);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setTextColor(0, 128, 0);
  doc.setFont(undefined, 'bold');
  doc.text('IVA 21%', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(`${iva.toFixed(2)} €`, 189, yPos, { align: 'right' });

  yPos += 6;
  doc.setFillColor(144, 238, 144);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setTextColor(0, 128, 0);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL TOTAL', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`${totalTotal.toFixed(2)} €`, 189, yPos, { align: 'right' });

  return doc.output('datauristring').split(',')[1];
}

async function sendEmailWithPDF(
  to: string,
  subject: string,
  content: string,
  pdfBase64: string,
  invoiceNumber: number
): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('Gmail no configurado');
    return false;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"Eduardo Bruno" <${gmailUser}>`,
      to: to,
      subject: subject,
      text: content,
      attachments: [
        {
          filename: `Factura_${invoiceNumber}_025.pdf`,
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}
