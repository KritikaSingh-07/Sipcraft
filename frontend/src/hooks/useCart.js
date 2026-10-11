import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cartApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useGuestStore } from '@/store/guestStore';
import { useUIStore } from '@/store/uiStore';

const EMPTY = { items: [], savedForLater: [], totals: null, couponCode: null };

/**
 * One cart interface for guests and signed-in shoppers.
 * - Signed in: the server cart (MongoDB) is the source of truth.
 * - Guest: lines live in localStorage; prices/totals come from POST /cart/quote.
 */
export function useCart() {
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === 'authenticated';
  const guestLines = useGuestStore((s) => s.cart);
  const queryClient = useQueryClient();

  const serverCart = useQuery({ queryKey: ['cart'], queryFn: cartApi.get, enabled: isAuthed, staleTime: 30_000 });

  const quoteInput = useMemo(
    () =>
      guestLines.map((i) => ({ productId: i.productId, quantity: i.quantity, color: i.color || undefined, size: i.size || undefined, savedForLater: i.savedForLater || undefined })),
    [guestLines],
  );
  const guestQuote = useQuery({
    queryKey: ['cart-quote', quoteInput],
    queryFn: () => cartApi.quote(quoteInput),
    enabled: status === 'guest' && guestLines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const cart = useMemo(() => {
    if (isAuthed) return serverCart.data || EMPTY;
    if (!guestLines.length) return EMPTY;
    const quoted = guestQuote.data?.items || [];
    const lines = guestLines.map((g, idx) => {
      const q = quoted[idx];
      return q ? { ...q, _id: g._id, savedForLater: g.savedForLater } : null;
    }).filter(Boolean);
    return {
      items: lines.filter((l) => !l.savedForLater),
      savedForLater: lines.filter((l) => l.savedForLater),
      totals: guestQuote.data?.totals || null,
      couponCode: null,
    };
  }, [isAuthed, serverCart.data, guestLines, guestQuote.data]);

  const count = isAuthed
    ? (cart.items || []).reduce((n, i) => n + i.quantity, 0)
    : guestLines.filter((i) => !i.savedForLater).reduce((n, i) => n + i.quantity, 0);

  const isLoading = status === 'loading' || (isAuthed ? serverCart.isLoading : guestLines.length > 0 && guestQuote.isLoading);

  return { cart, count, isLoading, isAuthed, isError: isAuthed ? serverCart.isError : guestQuote.isError, refetch: isAuthed ? serverCart.refetch : guestQuote.refetch, queryClient };
}

export function useCartActions() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const guest = useGuestStore();
  const queryClient = useQueryClient();
  const pulseCart = useUIStore((s) => s.pulseCart);

  const setCart = (res) => {
    queryClient.setQueryData(['cart'], res.data);
    return res;
  };

  const add = useMutation({
    mutationFn: async ({ product, quantity = 1, color = '', size = '' }) => {
      if (product.colors?.length && !color) throw new Error('Please choose a colour');
      if (product.sizes?.length && !size) throw new Error('Please choose a size');
      if (product.stock <= 0) throw new Error('This item is out of stock');
      if (isAuthed) return setCart(await cartApi.add({ productId: product._id, quantity, color: color || undefined, size: size || undefined }));
      guest.addToCart({ productId: product._id, quantity, color, size });
      return { message: `${product.name} added to cart` };
    },
    onSuccess: (res) => {
      pulseCart();
      toast.success(res.message || 'Added to cart');
    },
    onError: (err) => toast.error(err.response ? getErrorMessage(err) : err.message),
  });

  const update = useMutation({
    mutationFn: async ({ itemId, ...patch }) => {
      if (isAuthed) return setCart(await cartApi.update(itemId, patch));
      guest.updateCartItem(itemId, patch);
      return { message: patch.savedForLater === true ? 'Saved for later' : patch.savedForLater === false ? 'Moved to cart' : null };
    },
    onSuccess: (res) => res?.message && res.message !== 'Cart updated' && toast.success(res.message),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (itemId) => {
      if (isAuthed) return setCart(await cartApi.remove(itemId));
      guest.removeCartItem(itemId);
      return null;
    },
    onSuccess: () => toast.success('Removed from cart'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (isAuthed) return setCart(await cartApi.clear());
      guest.clearCart();
      return null;
    },
  });

  const applyCoupon = useMutation({
    mutationFn: async (code) => setCart(await cartApi.applyCoupon(code)),
    onSuccess: (res) => toast.success(res.message),
  });

  const removeCoupon = useMutation({
    mutationFn: async () => setCart(await cartApi.removeCoupon()),
    onSuccess: () => toast.success('Coupon removed'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return { add, update, remove, clear, applyCoupon, removeCoupon };
}
