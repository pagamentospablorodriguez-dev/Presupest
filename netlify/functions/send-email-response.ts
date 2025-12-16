import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { clientEmail, clientName, projectName, emailContent } = JSON.parse(event.body || '{}');

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Gmail no configurado' }) };
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"Presupuestos" <${gmailUser}>`,
      to: clientEmail,
      subject: `Re: Presupuesto - ${projectName}`,
      text: emailContent,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailSent: true }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
