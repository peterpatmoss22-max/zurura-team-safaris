import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="container legal-inner">
        <Link className="legal-back" href="/">← Back to Zurura Team Safaris</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: 26 October 2026</p>

        <p>Zurura Team Safaris ("we", "us", "our") respects your privacy. This policy explains what information we collect when you use this website, why we collect it, and the choices you have.</p>

        <h2>1. Who we are</h2>
        <p>Zurura Team Safaris, [business address, Kenya] ("Zurura"). Contact: <a href="mailto:zurura512@gmail.com">zurura512@gmail.com</a>.</p>

        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> name and email address, when you create an account.</li>
          <li><strong>Booking details:</strong> name, email, WhatsApp number, M-Pesa number, travel dates, guest count, and the safari package selected.</li>
          <li><strong>Payment confirmation:</strong> we receive confirmation that a payment succeeded or failed from our payment provider (Safaricom M-Pesa); we do not see or store your M-Pesa PIN or full financial account details.</li>
          <li><strong>Contact form messages:</strong> whatever you choose to tell us when you get in touch.</li>
          <li><strong>Basic site usage:</strong> we use cookie-free, aggregate analytics (Vercel Analytics) to see how many people visit which pages. This does not identify you personally and does not use tracking cookies.</li>
        </ul>

        <h2>3. Why we collect it</h2>
        <p>To create and manage your account, process and confirm bookings, send booking updates by WhatsApp and email, respond to enquiries, and meet our legal obligations (for example, issuing tax-compliant invoices through KRA's eTIMS system).</p>

        <h2>4. Who we share it with</h2>
        <ul>
          <li><strong>Supabase</strong> — hosts our database and handles account login.</li>
          <li><strong>Safaricom M-Pesa</strong> — processes payments.</li>
          <li><strong>Twilio</strong> — delivers WhatsApp booking updates.</li>
          <li><strong>Resend</strong> — delivers account emails.</li>
          <li><strong>Kenya Revenue Authority (eTIMS)</strong> — receives invoice details as required by Kenyan tax law.</li>
        </ul>
        <p>We do not sell your personal information to anyone.</p>

        <h2>5. How long we keep it</h2>
        <p>We keep account and booking records for as long as your account is active, plus [X years — set this to match your bookkeeping/tax retention requirement] afterwards for accounting and tax purposes.</p>

        <h2>6. Your rights</h2>
        <p>You can ask us to:</p>
        <ul>
          <li>send you a copy of the personal information we hold about you,</li>
          <li>correct information that is wrong,</li>
          <li>delete your account and personal information, where we are not legally required to keep it (for example, confirmed bookings may need to be kept for tax records).</li>
        </ul>

        <h2 id="delete-my-data">7. Requesting deletion of your data</h2>
        <p>To request deletion of your account and personal data, email <a href="mailto:zurura512@gmail.com?subject=Data%20deletion%20request">zurura512@gmail.com</a> with the subject "Data deletion request" from the email address on your account, or use our <Link href="/#inquiry">contact form</Link>. We will confirm your identity and respond within 30 days.</p>

        <h2>8. Cookies</h2>
        <p>We use only the cookies strictly needed to keep you signed in. See our <Link href="/terms#cookies">Terms of Service</Link> for details. We do not use advertising or tracking cookies.</p>

        <h2>9. Changes to this policy</h2>
        <p>We may update this policy from time to time. We'll change the "Last updated" date above when we do.</p>
      </div>
    </main>
  )
}
