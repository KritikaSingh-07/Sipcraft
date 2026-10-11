import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const lineKey = (productId, color = '', size = '') => `${productId}|${color}|${size}`;

const safeStorage = createJSONStorage(() => {
  try {
    const t = '__sc_test__';
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
});

/**
 * Guest cart + wishlist persisted in localStorage. Contains only product ids, variants and
 * quantities — prices are always fetched from the server (POST /cart/quote).
 * Merged into the server cart/wishlist on login, then cleared.
 */
export const useGuestStore = create(
  persist(
    (set, get) => ({
      cart: [], // [{ _id, productId, quantity, color, size, savedForLater }]
      wishlist: [], // [productId]

      addToCart: ({ productId, quantity = 1, color = '', size = '' }) =>
        set((s) => {
          const key = lineKey(productId, color, size);
          const existing = s.cart.find((i) => i._id === key);
          if (existing) {
            return { cart: s.cart.map((i) => (i._id === key ? { ...i, quantity: Math.min(20, i.quantity + quantity), savedForLater: false } : i)) };
          }
          return { cart: [...s.cart, { _id: key, productId, quantity: Math.min(20, quantity), color, size, savedForLater: false }] };
        }),
      updateCartItem: (id, patch) =>
        set((s) => ({ cart: s.cart.map((i) => (i._id === id ? { ...i, ...patch, quantity: Math.min(20, Math.max(1, patch.quantity ?? i.quantity)) } : i)) })),
      removeCartItem: (id) => set((s) => ({ cart: s.cart.filter((i) => i._id !== id) })),
      clearCart: () => set((s) => ({ cart: s.cart.filter((i) => i.savedForLater) })),
      resetCart: () => set({ cart: [] }),

      toggleWishlist: (productId) =>
        set((s) => ({ wishlist: s.wishlist.includes(productId) ? s.wishlist.filter((id) => id !== productId) : [productId, ...s.wishlist].slice(0, 100) })),
      resetWishlist: () => set({ wishlist: [] }),

      cartCount: () => get().cart.filter((i) => !i.savedForLater).reduce((n, i) => n + i.quantity, 0),
    }),
    { name: 'sipcraft-guest', version: 1, storage: safeStorage },
  ),
);

/** Recently viewed products (ids), most recent first. */
export const useRecentStore = create(
  persist(
    (set) => ({
      ids: [],
      push: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, 12) })),
    }),
    { name: 'sipcraft-recent', storage: safeStorage },
  ),
);

/** Recent search terms. */
export const useSearchHistory = create(
  persist(
    (set) => ({
      terms: [],
      add: (term) => {
        const t = term.trim();
        if (t.length < 2) return;
        set((s) => ({ terms: [t, ...s.terms.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6) }));
      },
      remove: (term) => set((s) => ({ terms: s.terms.filter((x) => x !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'sipcraft-searches', storage: safeStorage },
  ),
);
