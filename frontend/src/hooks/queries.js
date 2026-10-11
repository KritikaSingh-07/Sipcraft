import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { productApi, categoryApi, contentApi, reviewApi, userApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';

export const useProducts = (params, options = {}) =>
  useQuery({ queryKey: ['products', params], queryFn: () => productApi.list(params), placeholderData: keepPreviousData, staleTime: 60_000, ...options });

export const useProduct = (slug) => useQuery({ queryKey: ['product', slug], queryFn: () => productApi.get(slug), enabled: Boolean(slug), staleTime: 60_000 });

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list(), staleTime: 5 * 60_000 });

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: contentApi.settings, staleTime: 5 * 60_000 });

export const useBanners = (placement) => useQuery({ queryKey: ['banners', placement], queryFn: () => contentApi.banners(placement), staleTime: 5 * 60_000 });

export const useFeaturedReviews = () => useQuery({ queryKey: ['reviews', 'featured'], queryFn: reviewApi.featured, staleTime: 5 * 60_000 });

export const useTeam = () => useQuery({ queryKey: ['team'], queryFn: contentApi.team, staleTime: 5 * 60_000 });

export const useUnreadNotifications = () => {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: userApi.unreadCount,
    enabled: isAuthed,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
};

/** Admin-managed page content (home | about | services). */
export const usePageContent = (key) => useQuery({ queryKey: ['content', key], queryFn: () => contentApi.page(key), staleTime: 5 * 60_000 });
