import { create } from 'zustand';

/** Global UI state: overlays and drawers. */
export const useUIStore = create((set) => ({
  searchOpen: false,
  mobileMenuOpen: false,
  cartDrawerOpen: false,
  quickViewSlug: null,
  cartPulse: 0, // incremented to animate the cart badge after an add
  flyItem: null, // { id, src, rect } — image flying into the cart icon

  openSearch: () => set({ searchOpen: true, mobileMenuOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
  setMobileMenu: (open) => set({ mobileMenuOpen: open }),
  openCartDrawer: () => set({ cartDrawerOpen: true, mobileMenuOpen: false }),
  closeCartDrawer: () => set({ cartDrawerOpen: false }),
  openQuickView: (slug) => set({ quickViewSlug: slug }),
  closeQuickView: () => set({ quickViewSlug: null }),
  pulseCart: () => set((s) => ({ cartPulse: s.cartPulse + 1 })),
  /** Animates a product image from `el` (an <img> or its wrapper) into the navbar cart icon. */
  flyToCart: (el) => {
    const img = el?.tagName === 'IMG' ? el : el?.querySelector?.('img');
    if (!img) return;
    const r = img.getBoundingClientRect();
    set({ flyItem: { id: Date.now(), src: img.currentSrc || img.src, rect: { x: r.left, y: r.top, w: r.width, h: r.height } } });
  },
  clearFly: () => set({ flyItem: null }),
}));
