import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { SmtpClient } from 'https://deno.land/x/smtp/mod.ts'

const client = new SmtpClient()

serve(async (req) => {
  const { email, appUrl } = await req.json()

  await client.connect({
    hostname: Deno.env.get('SMTP_HOSTNAME'),
    port: Number(Deno.env.get('SMTP_PORT')),
    username: Deno.env.get('SMTP_USERNAME'),
    password: Deno.env.get('SMTP_PASSWORD'),
  })

  await client.send({
    from: Deno.env.get('SMTP_FROM'),
    to: email,
    subject: 'Lab Inventory System - Account Approved',
    content: `
      <h1>Your Account Has Been Approved</h1>
      <p>Your account for the Lab Inventory System has been approved by an administrator.</p>
      <p>You can now log in to the system at: <a href="${appUrl}">${appUrl}</a></p>
    `,
    html: true,
  })

  await client.close()

  return new Response(
    JSON.stringify({ message: 'Email sent successfully' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})