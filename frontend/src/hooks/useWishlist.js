import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wishlistApi, productApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useGuestStore } from '@/store/guestStore';

/** Wishlist ids + products for guests (localStorage) and signed-in shoppers (MongoDB). */
export function useWishlist({ withProducts = false } = {}) {
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === 'authenticated';
  const guestIds = useGuestStore((s) => s.wishlist);

  const server = useQuery({ queryKey: ['wishlist'], queryFn: wishlistApi.get, enabled: isAuthed, staleTime: 60_000 });
  const guestProducts = useQuery({
    queryKey: ['products', 'by-ids', guestIds],
    queryFn: () => productApi.list({ ids: guestIds.join(','), limit: 48 }),
    enabled: withProducts && status === 'guest' && guestIds.length > 0,
  });

  const ids = isAuthed ? (server.data?.productIds || []).map(String) : guestIds;
  const items = isAuthed ? server.data?.items || [] : guestIds.length ? guestProducts.data?.items || [] : [];
  const isLoading = status === 'loading' || (isAuthed ? server.isLoading : withProducts && guestIds.length > 0 && guestProducts.isLoading);

  return { ids, items, count: ids.length, isLoading, has: (id) => ids.includes(String(id)) };
}

export function useToggleWishlist() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const toggleGuest = useGuestStore((s) => s.toggleWishlist);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ product, inWishlist }) => {
      if (!isAuthed) {
        toggleGuest(product._id);
        return { message: inWishlist ? 'Removed from wishlist' : 'Saved to wishlist' };
      }
      const res = inWishlist ? await wishlistApi.remove(product._id) : await wishlistApi.add(product._id);
      queryClient.setQueryData(['wishlist'], res.data);
      return res;
    },
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
