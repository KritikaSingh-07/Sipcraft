import { Link } from 'react-router-dom';
import { useSettings } from '@/hooks/queries';
import { PageTransition, Reveal } from '@/components/ui/Motion';
import Seo from '@/components/ui/Seo';
import { cn } from '@/utils/cn';

const UPDATED = '1 October 2026';

const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what personal information Sipcraft collects, why we collect it, and the choices you have.',
    sections: [
      ['Information we collect', ['Account details you provide: name, email, phone number and password (stored only as a secure hash).', 'Order details: shipping addresses, items purchased and order history.', 'Payment information is entered directly into Razorpay’s secure checkout. We never see or store your full card number, CVV or UPI PIN.', 'Basic technical data such as device type and IP address, used for security and fraud prevention.']],
      ['How we use it', ['To process and deliver your orders and send order updates.', 'To provide customer support and respond to your messages.', 'To keep your account secure, including detecting suspicious sign-ins.', 'To send marketing emails only if you subscribe — you can unsubscribe at any time.']],
      ['Sharing', ['With courier partners, only the details needed to deliver your parcel.', 'With Razorpay to process payments.', 'We never sell your personal data.']],
      ['Cookies', ['We use a single essential, HttpOnly cookie to keep you signed in securely. It cannot be read by scripts.', 'Your cart and wishlist may be saved in your browser’s local storage before you sign in.']],
      ['Your rights', ['You can view and update your profile at any time from your account.', 'To request a copy or deletion of your data, email us and we’ll respond within 30 days.']],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'By using sipcraft.in and placing an order, you agree to these terms.',
    sections: [
      ['Orders', ['All orders are subject to availability and confirmation of payment.', 'We reserve the right to cancel orders affected by pricing errors or suspected fraud; any payment will be refunded in full.']],
      ['Pricing', ['Prices are in Indian Rupees and include GST.', 'Prices and offers may change without notice, but changes never affect orders already paid for.']],
      ['Coupons', ['Coupons are subject to their stated minimum order value, expiry date and usage limits.', 'Only one coupon can be applied per order and coupons have no cash value.']],
      ['Accounts', ['You are responsible for keeping your password confidential.', 'We may suspend accounts used for abuse, fraud or violation of these terms.']],
      ['Warranty & liability', ['Sipcraft vessels carry a one-year warranty against manufacturing defects.', 'Our liability is limited to the value of the product purchased.']],
      ['Governing law', ['These terms are governed by the laws of India, with courts in Bengaluru having exclusive jurisdiction.']],
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    intro: 'We ship across India from our warehouse in Bengaluru.',
    sections: [
      ['Dispatch', ['Orders placed before 4 pm IST on business days are dispatched the same day; others within 24 hours.']],
      ['Delivery times', ['Metro cities: 2–4 business days.', 'Rest of India: 4–7 business days.', 'Remote pincodes may take up to 10 business days.']],
      ['Shipping charges', ['Free shipping on orders of ₹{freeShippingThreshold} or more after discounts.', 'A flat fee of ₹{shippingFee} applies to smaller orders.']],
      ['Tracking', ['You’ll receive an email and an in-app notification with tracking details as soon as your order ships.', 'Track any order from My Orders in your account.']],
    ],
  },
  returns: {
    title: 'Return Policy',
    intro: 'Not quite right? Returns are easy.',
    sections: [
      ['Eligibility', ['Request a return within 7 days of delivery from the order page in your account.', 'Items must be unused, with all lids and accessories, in the original packaging.', 'Personalised or engraved items can only be returned if they arrive damaged or defective.']],
      ['How it works', ['Open your order in My Orders and choose “Request a return”.', 'Our courier partner will collect the parcel within 2 business days.', 'Once the item passes inspection, your refund is processed.']],
      ['Damaged or wrong items', ['If your order arrives damaged or incorrect, contact us within 48 hours with photos and we’ll send a replacement at no cost.']],
    ],
  },
  refund: {
    title: 'Refund Policy',
    intro: 'How and when refunds are issued.',
    sections: [
      ['Cancelled orders', ['Orders cancelled before shipping are refunded in full automatically.']],
      ['Returned orders', ['Refunds for returns are issued once the returned item passes inspection, usually within 2 business days of pickup.']],
      ['Timelines', ['Refunds go back to the original payment method via Razorpay.', 'UPI and wallets: typically 2–3 business days. Cards and netbanking: 5–7 business days, depending on your bank.']],
      ['Failed payments', ['If money was debited but your order was not confirmed, the amount is automatically refunded by Razorpay within 5–7 business days.']],
    ],
  },
};

const NAV = [
  ['privacy', 'Privacy'],
  ['terms', 'Terms'],
  ['shipping', 'Shipping'],
  ['returns', 'Returns'],
  ['refund', 'Refunds'],
];

export default function Policy({ page }) {
  const p = POLICIES[page];
  const { data: s } = useSettings();
  const fill = (t) => t.replace('{freeShippingThreshold}', (s?.freeShippingThreshold ?? 999).toLocaleString('en-IN')).replace('{shippingFee}', s?.shippingFee ?? 79);

  return (
    <PageTransition className="container-page py-14 lg:py-20">
      <Seo title={p.title} description={p.intro} />
      <div className="grid gap-12 lg:grid-cols-[220px_1fr] lg:gap-20">
        <nav aria-label="Policies" className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-4">Policies</p>
          <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
            {NAV.map(([slug, label]) => (
              <li key={slug}>
                <Link to={`/${slug}`} aria-current={slug === page ? 'page' : undefined} className={cn('block shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition lg:rounded-2xl', slug === page ? 'bg-ink text-white' : 'hover:bg-sand')}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Reveal as="article" className="prose-policy max-w-3xl">
          <h1 className="display text-5xl">{p.title}</h1>
          <p className="mt-3 text-sm text-subtle">Last updated {UPDATED}</p>
          <p className="mt-8 text-lg">{p.intro}</p>
          {p.sections.map(([heading, items]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <ul>
                {items.map((t) => (
                  <li key={t}>{fill(t)}</li>
                ))}
              </ul>
            </section>
          ))}
          <div className="mt-12 rounded-3xl bg-sand p-6">
            <p className="font-bold text-ink">Questions?</p>
            <p className="mt-1">
              Email <a href={`mailto:${s?.supportEmail || 'care@sipcraft.in'}`} className="font-semibold text-ink underline">{s?.supportEmail || 'care@sipcraft.in'}</a> or use our{' '}
              <Link to="/contact" className="font-semibold text-ink underline">
                contact form
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
