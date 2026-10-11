/**
 * Generates the studio-style product renders used by the seed catalogue.
 *
 *   cd tools/product-renders && npm install && npm run render
 *
 * Reads backend/seed/data.js and writes WebP files to frontend/public/media/.
 * Each product gets one image per colourway (in order), plus a "duo" composition when it
 * has 2+ colours, or a dark studio variant when it has fewer.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { products, categories } = require('../../backend/seed/data');

const OUT = path.resolve(__dirname, '../../frontend/public/media');
const W = 1000;
const H = 1250;
const FLOOR = 1080;

/* ─── colour helpers ───────────────────────────────────── */
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};
const shade = (hex, amt) => (amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt));
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

let uid = 0;
const id = (p) => `${p}${++uid}`;

/* ─── reusable defs ────────────────────────────────────── */
function bodyGradient(color, { glossy = 0.28 } = {}) {
  const gid = id('body');
  const dark = luminance(color) < 0.25;
  const def = `<linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${shade(color, dark ? -0.35 : -0.42)}"/>
    <stop offset="0.1" stop-color="${shade(color, -0.12)}"/>
    <stop offset="0.27" stop-color="${shade(color, dark ? 0.22 : glossy)}"/>
    <stop offset="0.38" stop-color="${shade(color, 0.08)}"/>
    <stop offset="0.62" stop-color="${color}"/>
    <stop offset="0.86" stop-color="${shade(color, -0.2)}"/>
    <stop offset="1" stop-color="${shade(color, dark ? -0.45 : -0.5)}"/>
  </linearGradient>`;
  return { gid, def };
}

function steelGradient() {
  const gid = id('steel');
  return {
    gid,
    def: `<linearGradient id="${gid}" x1="0" x2="1">
      <stop offset="0" stop-color="#7d8088"/><stop offset="0.18" stop-color="#c9ccd2"/><stop offset="0.3" stop-color="#f4f5f7"/>
      <stop offset="0.5" stop-color="#b9bcc3"/><stop offset="0.78" stop-color="#e2e4e8"/><stop offset="1" stop-color="#6f727a"/>
    </linearGradient>`,
  };
}

function woodGradient() {
  const gid = id('wood');
  return {
    gid,
    def: `<linearGradient id="${gid}" x1="0" x2="1">
      <stop offset="0" stop-color="#8a6440"/><stop offset="0.25" stop-color="#d7b58a"/><stop offset="0.55" stop-color="#c39b6c"/><stop offset="1" stop-color="#7c5836"/>
    </linearGradient>`,
  };
}

const specular = (x, y, w, h, opacity = 0.42) => {
  const fid = id('blur');
  return {
    def: `<filter id="${fid}" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="${Math.max(2, w * 0.35)}"/></filter>`,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" opacity="${opacity}" filter="url(#${fid})"/>`,
  };
};

/** A tapered body path: list of [halfWidth, y] from top to bottom, symmetric around cx. */
function bodyPath(cx, profile, bottomRadius = 26) {
  const right = profile.map(([hw, y]) => [cx + hw, y]);
  const left = profile.map(([hw, y]) => [cx - hw, y]).reverse();
  const [lastX, lastY] = right[right.length - 1];
  let d = `M ${cx - profile[0][0]} ${profile[0][1]} L ${right[0][0]} ${right[0][1]}`;
  for (let i = 1; i < right.length - 1; i++) {
    const [px, py] = right[i - 1];
    const [x, y] = right[i];
    d += ` C ${px} ${py + (y - py) * 0.5} ${x} ${py + (y - py) * 0.5} ${x} ${y}`;
  }
  const [px, py] = right[right.length - 2];
  d += ` C ${px} ${py + (lastY - bottomRadius - py) * 0.5} ${lastX} ${py + (lastY - bottomRadius - py) * 0.5} ${lastX} ${lastY - bottomRadius}`;
  d += ` Q ${lastX} ${lastY} ${lastX - bottomRadius} ${lastY}`;
  const [lx] = left[0];
  d += ` L ${lx + bottomRadius} ${lastY} Q ${lx} ${lastY} ${lx} ${lastY - bottomRadius}`;
  for (let i = 1; i < left.length; i++) {
    const [ppx, ppy] = i === 1 ? [lx, lastY - bottomRadius] : left[i - 1];
    const [x, y] = left[i];
    d += ` C ${ppx} ${ppy + (y - ppy) * 0.5} ${x} ${ppy + (y - ppy) * 0.5} ${x} ${y}`;
  }
  return `${d} Z`;
}

/* ─── vessel definitions (in a 1000-wide space, cx = 500, floor = FLOOR) ── */
function vessel(shape, color, opts = {}) {
  const cx = 500;
  const defs = [];
  const parts = [];
  const body = bodyGradient(color);
  const steel = steelGradient();
  defs.push(body.def, steel.def);
  const dark = luminance(color) < 0.3;
  const accent = dark ? shade(color, 0.12) : shade(color, -0.12);
  const lidColor = opts.lidColor || (dark ? shade(color, -0.25) : shade(color, -0.06));
  const lidGrad = bodyGradient(lidColor, { glossy: 0.18 });
  defs.push(lidGrad.def);
  const wordmark = (y, size = 20, op = 0.55) =>
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" letter-spacing="${size * 0.22}" fill="${dark ? shade(color, 0.35) : shade(color, -0.3)}" opacity="${op}">SIPCRAFT</text>`;

  const straw = (x1, y1, x2, y2, w = 18, c = dark ? '#E9E6F2' : shade(color, -0.28)) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${shade(c, -0.18)}" stroke-width="${w}" stroke-linecap="round"/>
     <line x1="${x1 - w * 0.18}" y1="${y1}" x2="${x2 - w * 0.18}" y2="${y2 + 6}" stroke="${shade(c, 0.25)}" stroke-width="${w * 0.35}" stroke-linecap="round" opacity="0.8"/>`;

  const handle = (top, bottom, outX, attachX, w = 40) => {
    const hg = bodyGradient(color);
    defs.push(hg.def);
    return `<path d="M ${attachX} ${top} C ${outX} ${top - 10} ${outX + 10} ${top + 30} ${outX} ${(top + bottom) / 2} C ${outX - 6} ${bottom - 30} ${outX - 6} ${bottom + 8} ${attachX} ${bottom}"
      fill="none" stroke="${shade(color, -0.32)}" stroke-width="${w + 6}" stroke-linecap="round"/>
      <path d="M ${attachX} ${top} C ${outX} ${top - 10} ${outX + 10} ${top + 30} ${outX} ${(top + bottom) / 2} C ${outX - 6} ${bottom - 30} ${outX - 6} ${bottom + 8} ${attachX} ${bottom}"
      fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>
      <path d="M ${attachX + 8} ${top - 6} C ${outX - 8} ${top - 6} ${outX + 2} ${top + 30} ${outX - 10} ${(top + bottom) / 2}"
      fill="none" stroke="${shade(color, 0.35)}" stroke-width="${w * 0.22}" stroke-linecap="round" opacity="0.7"/>`;
  };

  const lidDisc = (y, w, h, fill = `url(#${lidGrad.gid})`) =>
    `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${Math.min(14, h / 2)}" fill="${fill}"/>
     <ellipse cx="${cx}" cy="${y + 2}" rx="${w / 2 - 4}" ry="${h * 0.22}" fill="${shade(lidColor, dark ? 0.12 : 0.2)}" opacity="0.9"/>`;

  const rim = (y, w) => `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="16" rx="5" fill="url(#${steel.gid})"/>`;

  switch (shape) {
    case 'tumbler-handle': {
      const top = 470;
      const p = [[152, top], [146, top + 160], [108, top + 360], [104, FLOOR]];
      parts.push(handle(top + 90, top + 360, cx + 270, cx + 120));
      parts.push(straw(cx + 22, top - 20, cx + 60, top - 210));
      parts.push(`<path d="${bodyPath(cx, p, 30)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - 112, top + 30, 18, 520);
      defs.push(s.def);
      parts.push(s.svg);
      parts.push(rim(top - 14, 314));
      parts.push(lidDisc(top - 64, 318, 54));
      parts.push(`<ellipse cx="${cx + 22}" cy="${top - 60}" rx="22" ry="7" fill="${shade(lidColor, -0.3)}"/>`);
      parts.push(wordmark(top + 600, 20));
      break;
    }
    case 'tumbler-slim': {
      const top = 560;
      const p = [[112, top], [100, top + 260], [88, FLOOR]];
      parts.push(straw(cx + 18, top - 20, cx + 44, top - 190, 16));
      parts.push(`<path d="${bodyPath(cx, p, 26)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - 80, top + 30, 14, 440);
      defs.push(s.def);
      parts.push(s.svg);
      parts.push(rim(top - 12, 232));
      parts.push(lidDisc(top - 48, 236, 40));
      parts.push(`<rect x="${cx - 46}" y="${top - 52}" width="60" height="10" rx="5" fill="${shade(lidColor, -0.35)}"/>`);
      parts.push(wordmark(top + 420, 17));
      break;
    }
    case 'sipper':
    case 'kids-sipper': {
      const kid = shape === 'kids-sipper';
      const top = kid ? 700 : 560;
      const hw = kid ? 92 : 108;
      const p = [[hw - 6, top], [hw, top + 40], [hw, FLOOR]];
      parts.push(`<path d="${bodyPath(cx, p, 34)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - hw * 0.72, top + 40, 16, FLOOR - top - 90);
      defs.push(s.def);
      parts.push(s.svg);
      const lidH = kid ? 120 : 130;
      const lc = kid ? shade(color, -0.15) : '#3b3d44';
      const lg = bodyGradient(lc, { glossy: 0.2 });
      defs.push(lg.def);
      parts.push(`<rect x="${cx - hw + 4}" y="${top - lidH + 30}" width="${(hw - 4) * 2}" height="${lidH - 20}" rx="26" fill="url(#${lg.gid})"/>`);
      parts.push(`<path d="M ${cx - 30} ${top - lidH + 34} Q ${cx - 20} ${top - lidH - 60} ${cx + 30} ${top - lidH - 70} L ${cx + 44} ${top - lidH - 46} Q ${cx + 4} ${top - lidH - 36} ${cx + 8} ${top - lidH + 34} Z" fill="${shade(lc, 0.1)}"/>`);
      parts.push(`<rect x="${cx + 18}" y="${top - lidH - 82}" width="34" height="44" rx="14" fill="${kid ? shade(color, 0.3) : '#d9dbe0'}" transform="rotate(28 ${cx + 35} ${top - lidH - 60})"/>`);
      if (!kid) parts.push(`<path d="M ${cx - hw + 20} ${top - 60} C ${cx - hw - 70} ${top - 70} ${cx - hw - 70} ${top + 40} ${cx - hw + 4} ${top + 10}" fill="none" stroke="${lc}" stroke-width="22" stroke-linecap="round"/>`);
      parts.push(`<rect x="${cx - hw}" y="${top + 6}" width="${hw * 2}" height="12" fill="url(#${steel.gid})" opacity="0.9"/>`);
      if (kid) parts.push(`<rect x="${cx - hw}" y="${FLOOR - 70}" width="${hw * 2}" height="70" rx="30" fill="${shade(color, -0.25)}"/>`);
      parts.push(wordmark(top + (kid ? 230 : 330), kid ? 15 : 18));
      break;
    }
    case 'bottle':
    case 'trail-bottle': {
      const trail = shape === 'trail-bottle';
      const shoulder = trail ? 520 : 600;
      const hw = trail ? 128 : 112;
      const neck = trail ? 92 : 58;
      const p = [[neck, shoulder - (trail ? 50 : 120)], [neck + 4, shoulder - (trail ? 40 : 90)], [hw, shoulder + 30], [hw, FLOOR]];
      parts.push(`<path d="${bodyPath(cx, p, 34)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - hw * 0.72, shoulder + 30, 18, FLOOR - shoulder - 100);
      defs.push(s.def);
      parts.push(s.svg);
      const capTop = shoulder - (trail ? 50 : 120);
      if (trail) {
        const cg = bodyGradient('#2f3136', { glossy: 0.16 });
        defs.push(cg.def);
        parts.push(`<path d="M ${cx - 42} ${capTop - 70} C ${cx - 42} ${capTop - 170} ${cx + 42} ${capTop - 170} ${cx + 42} ${capTop - 70}" fill="none" stroke="#2f3136" stroke-width="22" stroke-linecap="round"/>`);
        parts.push(`<rect x="${cx - neck - 4}" y="${capTop - 84}" width="${(neck + 4) * 2}" height="90" rx="18" fill="url(#${cg.gid})"/>`);
        for (let i = 0; i < 9; i++) parts.push(`<rect x="${cx - neck + 8 + i * ((neck * 2 - 16) / 8)}" y="${capTop - 70}" width="4" height="62" rx="2" fill="#000" opacity="0.18"/>`);
      } else {
        const wood = woodGradient();
        defs.push(wood.def);
        parts.push(`<rect x="${cx - neck - 2}" y="${capTop - 32}" width="${(neck + 2) * 2}" height="40" rx="6" fill="url(#${steel.gid})"/>`);
        parts.push(`<rect x="${cx - neck - 2}" y="${capTop - 92}" width="${(neck + 2) * 2}" height="64" rx="12" fill="url(#${wood.gid})"/>`);
        for (let i = 0; i < 5; i++) parts.push(`<path d="M ${cx - neck + 8} ${capTop - 82 + i * 12} q ${neck * 0.6} ${i % 2 ? 6 : -6} ${neck * 1.8} 0" stroke="#6b4a2c" stroke-width="1.6" fill="none" opacity="0.35"/>`);
      }
      parts.push(wordmark(shoulder + (trail ? 360 : 300), trail ? 22 : 18));
      break;
    }
    case 'travel-mug': {
      const top = 640;
      const p = [[118, top], [112, top + 200], [100, FLOOR]];
      parts.push(handle(top + 70, top + 300, cx + 250, cx + 100, 44));
      parts.push(`<path d="${bodyPath(cx, p, 28)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - 86, top + 30, 16, 350);
      defs.push(s.def);
      parts.push(s.svg);
      parts.push(rim(top - 14, 242));
      const lc = dark ? '#d8d4cc' : '#2e2f34';
      const lg = bodyGradient(lc, { glossy: 0.18 });
      defs.push(lg.def);
      parts.push(`<path d="M ${cx - 124} ${top - 12} L ${cx - 112} ${top - 76} Q ${cx} ${top - 96} ${cx + 112} ${top - 76} L ${cx + 124} ${top - 12} Z" fill="url(#${lg.gid})"/>`);
      parts.push(`<rect x="${cx - 40}" y="${top - 100}" width="64" height="22" rx="10" fill="${shade(lc, -0.2)}"/>`);
      parts.push(wordmark(top + 300, 17));
      break;
    }
    case 'coffee-tumbler': {
      const top = 760;
      const p = [[124, top], [114, top + 120], [100, FLOOR]];
      parts.push(`<path d="${bodyPath(cx, p, 26)}" fill="url(#${body.gid})"/>`);
      const s = specular(cx - 90, top + 26, 16, 250);
      defs.push(s.def);
      parts.push(s.svg);
      parts.push(rim(top - 12, 254));
      const lc = '#f2efe9';
      const lg = bodyGradient(dark ? lc : '#34353b', { glossy: 0.15 });
      defs.push(lg.def);
      parts.push(`<path d="M ${cx - 130} ${top - 6} Q ${cx - 128} ${top - 60} ${cx - 100} ${top - 66} L ${cx + 100} ${top - 66} Q ${cx + 128} ${top - 60} ${cx + 130} ${top - 6} Z" fill="url(#${lg.gid})"/>`);
      parts.push(`<rect x="${cx - 70}" y="${top - 64}" width="80" height="14" rx="7" fill="#000" opacity="0.35"/>`);
      parts.push(wordmark(top + 200, 16));
      break;
    }
    case 'glass-sipper': {
      const top = 600;
      const hw = 104;
      const p = [[hw, top], [hw, FLOOR]];
      const tint = color;
      parts.push(`<path d="${bodyPath(cx, p, 30)}" fill="${tint}" opacity="0.35"/>`);
      parts.push(`<rect x="${cx - hw + 10}" y="${top + 140}" width="${(hw - 10) * 2}" height="${FLOOR - top - 160}" rx="24" fill="#bfe1f2" opacity="0.55"/>`);
      parts.push(`<path d="${bodyPath(cx, p, 30)}" fill="none" stroke="${shade(tint, -0.25)}" stroke-width="5" opacity="0.6"/>`);
      parts.push(straw(cx + 10, top + 40, cx + 30, top - 220, 14, '#e6eef2'));
      const sleeve = bodyGradient(luminance(color) > 0.6 ? '#9DB8A0' : '#3c3f45');
      defs.push(sleeve.def);
      parts.push(`<rect x="${cx - hw - 4}" y="${top + 230}" width="${(hw + 4) * 2}" height="190" rx="18" fill="url(#${sleeve.gid})"/>`);
      const wood = woodGradient();
      defs.push(wood.def);
      parts.push(`<rect x="${cx - hw - 6}" y="${top - 56}" width="${(hw + 6) * 2}" height="62" rx="14" fill="url(#${wood.gid})"/>`);
      const s = specular(cx - 80, top + 30, 14, 420, 0.65);
      defs.push(s.def);
      parts.push(s.svg);
      break;
    }
    case 'boot': {
      const top = 560;
      const p = [[112, top], [100, top + 260], [92, FLOOR]];
      const sb = bodyGradient('#c7cad0');
      defs.push(sb.def);
      parts.push(`<path d="${bodyPath(cx, p, 26)}" fill="url(#${sb.gid})"/>`);
      parts.push(rim(top - 12, 232));
      parts.push(lidDisc(top - 48, 236, 40, '#3a3b40'));
      parts.push(`<path d="M ${cx - 100} ${FLOOR - 150} L ${cx + 100} ${FLOOR - 150} L ${cx + 100} ${FLOOR - 26} Q ${cx + 100} ${FLOOR} ${cx + 74} ${FLOOR} L ${cx - 74} ${FLOOR} Q ${cx - 100} ${FLOOR} ${cx - 100} ${FLOOR - 26} Z" fill="url(#${body.gid})"/>`);
      parts.push(`<rect x="${cx - 100}" y="${FLOOR - 154}" width="200" height="14" rx="7" fill="${shade(color, 0.2)}"/>`);
      break;
    }
    default:
      throw new Error(`Unknown shape ${shape}`);
  }
  return { defs: defs.join('\n'), svg: parts.join('\n'), accent };
}

function strawSet(color = '#9DB8A0') {
  const steel = steelGradient();
  const defs = [steel.def];
  const parts = [];
  const tips = ['#B9A8E8', color, '#EBB8B8', '#2B2D3A'];
  for (let i = 0; i < 4; i++) {
    const x = 330 + i * 95;
    const bent = i % 2 === 1;
    const d = bent ? `M ${x} 1000 L ${x + 60} 520 Q ${x + 66} 470 ${x + 110} 440` : `M ${x} 1000 L ${x + 70} 380`;
    parts.push(`<path d="${d}" fill="none" stroke="#8b8e96" stroke-width="30" stroke-linecap="round"/>`);
    parts.push(`<path d="${d}" fill="none" stroke="url(#${steel.gid})" stroke-width="24" stroke-linecap="round"/>`);
    const tx = bent ? x + 110 : x + 70;
    const ty = bent ? 440 : 380;
    parts.push(`<circle cx="${tx}" cy="${ty}" r="17" fill="${tips[i]}"/>`);
  }
  parts.push(`<line x1="720" y1="1010" x2="790" y2="560" stroke="#3a3b40" stroke-width="12" stroke-linecap="round"/>`);
  for (let i = 0; i < 22; i++) {
    const y = 560 + i * 7;
    parts.push(`<line x1="${786 - i * 0.6 - 14}" y1="${y}" x2="${800 - i * 0.6 + 14}" y2="${y - 3}" stroke="#d9d4c7" stroke-width="3"/>`);
  }
  return { defs: defs.join('\n'), svg: parts.join('\n') };
}

/* ─── scene composition ────────────────────────────────── */
function scene(content, { bg, dark = false, width = W, height = H, shadows = [] }) {
  const bgId = id('bg');
  const shId = id('sh');
  if (!dark && luminance(bg) < 0.32) bg = '#C9C4D6';
  const top = dark ? '#2a2932' : mix(bg, '#ffffff', 0.78);
  const bottom = dark ? '#16151b' : mix(bg, '#f3f1ec', 0.62);
  const shadowSvg = shadows
    .map(([cx, w, o = 0.28]) => `<ellipse cx="${cx}" cy="${FLOOR + 6}" rx="${w}" ry="${w * 0.12}" fill="#1a1820" opacity="${dark ? 0.6 : o}" filter="url(#${shId})"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="${bgId}" cx="0.5" cy="0.38" r="0.85"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></radialGradient>
    <filter id="${shId}" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="16"/></filter>
    ${content.defs}
  </defs>
  <rect width="100%" height="100%" fill="url(#${bgId})"/>
  <rect y="${FLOOR - 4}" width="100%" height="${height - FLOOR + 4}" fill="${dark ? '#000' : bottom}" opacity="${dark ? 0.15 : 0.35}"/>
  ${shadowSvg}
  ${content.svg}
</svg>`;
}

const FRAME = { 'tumbler-handle': 1.14, 'tumbler-slim': 1.2, sipper: 1.2, 'kids-sipper': 1.38, bottle: 1.18, 'trail-bottle': 1.16, 'travel-mug': 1.3, 'coffee-tumbler': 1.55, 'glass-sipper': 1.22, boot: 1.2 };

/** Places one vessel render into a scene at an x offset and scale (scale around the floor point). */
const place = (v, dx = 0, scale = 1) => ({
  defs: v.defs,
  svg: `<g transform="translate(${500 + dx} ${FLOOR}) scale(${scale}) translate(-500 -${FLOOR})">${v.svg}</g>`,
});
const combine = (...items) => ({ defs: items.map((i) => i.defs).join('\n'), svg: items.map((i) => i.svg).join('\n') });

function giftBox(color, shapes, colors) {
  const box = color;
  const a = vessel(shapes[0], colors[0]);
  const b = vessel(shapes[1], colors[1] || colors[0]);
  const bg = bodyGradient(box, { glossy: 0.12 });
  const back = `<rect x="160" y="760" width="680" height="320" rx="16" fill="${shade(box, -0.25)}"/>`;
  const front = `<rect x="140" y="880" width="720" height="200" rx="16" fill="url(#${bg.gid})"/>
    <rect x="470" y="880" width="60" height="200" fill="${luminance(box) < 0.3 ? '#c9b8e6' : '#2b2d3a'}" opacity="0.9"/>
    <text x="300" y="995" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="34" letter-spacing="8" fill="${luminance(box) < 0.3 ? '#f1eef8' : '#2b2d3a'}" opacity="0.85">SIPCRAFT</text>
    <text x="700" y="995" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="30" fill="${luminance(box) < 0.3 ? '#f1eef8' : '#2b2d3a'}" opacity="0.7">for you</text>`;
  return combine({ defs: bg.def, svg: back }, place(a, -160, 1.0), place(b, 170, 1.0), { defs: '', svg: front });
}

async function write(svg, file, { width = W, height = H, quality = 82 } = {}) {
  const out = path.join(OUT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).resize(width, height).webp({ quality, effort: 5 }).toFile(out);
  return out;
}

// Same slug function the API uses, so image paths always match product slugs.
const { toSlug: slugify } = require('../../backend/src/utils/helpers');

function productImages(p) {
  const shape = p.render.shape;
  const colors = p.colors.length ? p.colors.map((c) => c.hex) : ['#9DB8A0'];
  const scale = p.render.scale || 1;
  const images = [];
  if (shape === 'gift-box') {
    const pair = p.render.pair || ['tumbler-handle', 'tumbler-slim'];
    const pairColors = p.name.includes('Duo') ? [['#B9A8E8', '#EDEBE6'], ['#2B2D3A', '#2A2A2E']] : [['#5B4336', '#6B4F3F']];
    p.colors.forEach((c, i) => images.push(scene(giftBox(c.hex === '#B9A8E8' ? '#F1EEF8' : c.hex, pair, pairColors[i] || pairColors[0]), { bg: c.hex, shadows: [[500, 380, 0.22]] })));
    images.push(scene(giftBox('#2B2D3A', pair, pairColors[0]), { bg: '#2B2D3A', dark: true, shadows: [[500, 380]] }));
    return images;
  }
  if (shape === 'straw-set') {
    images.push(scene(strawSet(), { bg: '#9DB8A0', shadows: [[560, 260, 0.18]] }));
    images.push(scene(strawSet(), { bg: '#B9A8E8', dark: true, shadows: [[560, 260]] }));
    return images;
  }
  const f = (FRAME[shape] || 1.15) * scale;
  for (const c of colors) images.push(scene(place(vessel(shape, c), 0, f), { bg: c, shadows: [[500, 150 * f]] }));
  if (colors.length >= 2) {
    const duo = combine(place(vessel(shape, colors[1]), 165, 0.98 * f), place(vessel(shape, colors[0]), -150, 1.06 * f));
    images.push(scene(duo, { bg: colors[0], shadows: [[370, 140], [650, 130]] }));
  } else {
    images.push(scene(place(vessel(shape, colors[0]), 0, f), { bg: colors[0], dark: true, shadows: [[500, 150 * f]] }));
  }
  return images;
}

async function main() {
  let count = 0;
  for (const p of products) {
    const slug = slugify(p.name);
    const imgs = productImages(p);
    for (let i = 0; i < imgs.length; i++) {
      await write(imgs[i], `products/${slug}-${i}.webp`);
      count++;
    }
  }

  // Category tiles
  for (const c of categories) {
    let content;
    if (c.render.shape === 'straw-set') content = strawSet();
    else if (c.render.shape === 'gift-box') content = giftBox('#F1EEF8', ['tumbler-handle', 'tumbler-slim'], ['#B9A8E8', '#2A2A2E']);
    else content = place(vessel(c.render.shape, c.render.color), 0, FRAME[c.render.shape] || 1.15);
    await write(scene(content, { bg: c.render.color, shadows: [[500, 160]] }), `categories/${c.slug}.webp`, { width: 800, height: 1000 });
    count++;
  }

  // Hero composition (wide)
  const hero = combine(
    place(vessel('tumbler-slim', '#2A2A2E'), -330, 0.86),
    place(vessel('sipper', '#EDEBE6', { lidColor: '#3b3d44' }), 330, 0.86),
    place(vessel('tumbler-handle', '#B9A8E8'), 0, 1.02),
  );
  await write(scene(hero, { bg: '#B9A8E8', width: 1000, height: 1250, shadows: [[170, 120], [500, 160, 0.3], [830, 120]] }), 'hero/hero-trio.webp', { quality: 86 });
  count++;
  const lifestyle = combine(place(vessel('bottle', '#3F5A4A'), -170, 0.9), place(vessel('trail-bottle', '#D8C7A8'), 170, 0.9));
  await write(scene(lifestyle, { bg: '#9DB8A0', shadows: [[330, 130], [670, 140]] }), 'hero/outdoors-pair.webp');
  count++;
  const og = combine(place(vessel('tumbler-handle', '#B9A8E8'), 0, 0.82));
  await write(scene(og, { bg: '#B9A8E8', width: 1000, height: 1250, shadows: [[500, 130]] }), 'hero/og-square.webp');
  count++;

  console.log(`Rendered ${count} images to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { slugify };
