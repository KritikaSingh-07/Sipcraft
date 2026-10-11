import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar, { AnnouncementBar } from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { MobileMenu, SearchOverlay, CartDrawer } from '@/components/layout/Overlays';
import QuickViewModal from '@/components/product/QuickViewModal';
import { FullPageLoader } from '@/components/ui/Feedback';
import { ScrollProgress, RouteProgress, BackToTop, FlyToCartLayer } from '@/components/ui/Effects';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export function SkipLink() {
  return (
    <a href="#main" className="sr-only z-[100] rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
      Skip to content
    </a>
  );
}

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <ScrollToTop />
      <ScrollProgress />
      <RouteProgress />
      <AnnouncementBar />
      <Navbar />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<FullPageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileMenu />
      <SearchOverlay />
      <CartDrawer />
      <QuickViewModal />
      <BackToTop />
      <FlyToCartLayer />
    </div>
  );
}
