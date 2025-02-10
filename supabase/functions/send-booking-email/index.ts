import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { SmtpClient } from 'https://deno.land/x/smtp/mod.ts'

const client = new SmtpClient()

serve(async (req) => {
  const { email, type, booking } = await req.json()
  const { itemName, quantity, startDate, endDate } = booking

  const formattedStart = new Date(startDate).toLocaleString()
  const formattedEnd = new Date(endDate).toLocaleString()

  const subject = type === 'confirmation' 
    ? 'Booking Confirmation'
    : 'Booking Cancellation'

  const content = type === 'confirmation'
    ? `
      <h1>Booking Confirmation</h1>
      <p>Your booking for ${itemName} has been confirmed:</p>
      <ul>
        <li>Quantity: ${quantity}</li>
        <li>Start: ${formattedStart}</li>
        <li>End: ${formattedEnd}</li>
      </ul>
    `
    : `
      <h1>Booking Cancelled</h1>
      <p>Your booking for ${itemName} has been cancelled:</p>
      <ul>
        <li>Quantity: ${quantity}</li>
        <li>Start: ${formattedStart}</li>
        <li>End: ${formattedEnd}</li>
      </ul>
    `

  await client.connect({
    hostname: Deno.env.get('SMTP_HOSTNAME'),
    port: Number(Deno.env.get('SMTP_PORT')),
    username: Deno.env.get('SMTP_USERNAME'),
    password: Deno.env.get('SMTP_PASSWORD'),
  })

  await client.send({
    from: Deno.env.get('SMTP_FROM'),
    to: email,
    subject: `Lab Inventory System - ${subject}`,
    content,
    html: true,
  })

  await client.close()

  return new Response(
    JSON.stringify({ message: 'Email sent successfully' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})