import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, cartApi, wishlistApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useGuestStore } from '@/store/guestStore';
import { toast } from 'sonner';

/** Moves the guest (localStorage) cart and wishlist into the account after sign-in. */
export async function mergeGuestData(queryClient) {
  const { cart, wishlist, resetCart, resetWishlist } = useGuestStore.getState();
  try {
    if (cart.length) {
      const res = await cartApi.merge(cart.map((i) => ({ productId: i.productId, quantity: i.quantity, color: i.color || undefined, size: i.size || undefined })));
      resetCart();
      queryClient.setQueryData(['cart'], res.data);
      if (res.message && res.message !== 'Cart synced') toast.info(res.message);
    }
    if (wishlist.length) {
      const data = await wishlistApi.merge(wishlist);
      resetWishlist();
      queryClient.setQueryData(['wishlist'], data);
    }
  } catch {
    // Keep guest data locally if the merge fails; it will be retried on the next sign-in.
  }
}

export function useAuthActions() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const afterSignIn = useCallback(
    async ({ data }) => {
      setSession(data.user, data.accessToken);
      queryClient.removeQueries({ queryKey: ['cart'] });
      queryClient.removeQueries({ queryKey: ['wishlist'] });
      await mergeGuestData(queryClient);
      return data.user;
    },
    [queryClient, setSession],
  );

  const login = useCallback(async (values) => afterSignIn(await authApi.login(values)), [afterSignIn]);
  const register = useCallback(async (values) => afterSignIn(await authApi.register(values)), [afterSignIn]);

  const logout = useCallback(
    async ({ everywhere = false } = {}) => {
      try {
        if (everywhere) await authApi.logoutAll();
        else await authApi.logout();
      } catch {
        // Even if the network call fails, drop local credentials.
      }
      clearSession();
      // Remove every cached private query (orders, cart, admin data…).
      queryClient.clear();
    },
    [clearSession, queryClient],
  );

  return { login, register, logout };
}
