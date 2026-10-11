import { useLocation } from 'react-router-dom';
import { SITE_URL } from '@/utils/constants';

/**
 * Per-page SEO. React 19 hoists <title>, <meta> and <link> rendered anywhere into <head>.
 */
export default function Seo({ title, description, image, type = 'website', noindex, jsonLd, canonicalPath }) {
  const { pathname } = useLocation();
  const fullTitle = title ? `${title} · Sipcraft` : 'Sipcraft — Premium Tumblers & Sippers';
  const desc = description || 'Premium insulated tumblers, sippers and bottles designed for everyday adventures. Free shipping above ₹999.';
  const url = `${SITE_URL}${canonicalPath ?? pathname}`;
  const img = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/media/hero/og-square.webp`;
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  );
}
