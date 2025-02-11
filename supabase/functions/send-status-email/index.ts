// supabase/functions/send-status-email/index.ts
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const client = new SmtpClient();

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, status } = await req.json();

    if (!email || !status) {
      return new Response(
        JSON.stringify({ error: 'Email and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configure SMTP client
    await client.connectTLS({
      hostname: Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com',
      port: 587,
      username: Deno.env.get('SMTP_USERNAME'),
      password: Deno.env.get('SMTP_PASSWORD'),
    });

    // Email templates
    const templates = {
      approved: {
        subject: 'Your Lab Inventory Account Has Been Approved',
        body: `
          <h2>Account Approved</h2>
          <p>Your account for the Lab Inventory System has been approved.</p>
          <p><a href="https://lab-inventory-bay.vercel.app">Login to your account</a></p>
        `
      },
      denied: {
        subject: 'Update on Your Lab Inventory Account Request',
        body: `
          <h2>Account Status Update</h2>
          <p>Unfortunately, your account request for the Lab Inventory System has been denied.</p>
          <p>If you believe this is an error, please contact your laboratory administrator.</p>
        `
      }
    };

    const template = templates[status as keyof typeof templates];

    await client.send({
      from: Deno.env.get('SMTP_USERNAME')!,
      to: email,
      subject: template.subject,
      content: template.body,
      html: template.body,
    });

    await client.close();

    return new Response(
      JSON.stringify({ message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    // Make sure to close the SMTP client connection in case of error
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }

    // Handle the error message safely
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});