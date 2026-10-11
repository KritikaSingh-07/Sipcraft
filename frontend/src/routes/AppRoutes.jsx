import { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import { ProtectedRoute, AdminRoute, GuestRoute } from './Guards';

/* Every page is code-split. */
const Home = lazy(() => import('@/pages/Home'));
const Products = lazy(() => import('@/pages/Products'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Cart = lazy(() => import('@/pages/Cart'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderSuccess = lazy(() => import('@/pages/OrderSuccess'));
const About = lazy(() => import('@/pages/content/About'));
const Services = lazy(() => import('@/pages/content/Services'));
const Team = lazy(() => import('@/pages/content/Team'));
const Contact = lazy(() => import('@/pages/content/Contact'));
const Policy = lazy(() => import('@/pages/content/Policy'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const StatusPage = lazy(() => import('@/pages/StatusPage'));

const DashboardLayout = lazy(() => import('@/layouts/DashboardLayout'));
const Overview = lazy(() => import('@/pages/dashboard/Overview'));
const Orders = lazy(() => import('@/pages/dashboard/Orders'));
const OrderDetail = lazy(() => import('@/pages/dashboard/OrderDetail'));
const Addresses = lazy(() => import('@/pages/dashboard/Addresses'));
const Profile = lazy(() => import('@/pages/dashboard/Profile'));
const ChangePassword = lazy(() => import('@/pages/dashboard/ChangePassword'));
const Notifications = lazy(() => import('@/pages/dashboard/Notifications'));

const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminProductEditor = lazy(() => import('@/pages/admin/AdminProductEditor'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'));
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminCustomerDetail = lazy(() => import('@/pages/admin/AdminCustomerDetail'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'));
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminBanners = lazy(() => import('@/pages/admin/AdminBanners'));
const AdminTeam = lazy(() => import('@/pages/admin/AdminTeam'));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminRefunds = lazy(() => import('@/pages/admin/AdminRefunds'));
const AdminContent = lazy(() => import('@/pages/admin/AdminContent'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminActivity = lazy(() => import('@/pages/admin/AdminActivity'));
const AdminProfile = lazy(() => import('@/pages/admin/AdminProfile'));

export default function AppRoutes() {
  const location = useLocation();
  // Cross-fade only between the storefront and the admin app; pages animate themselves.
  const section = location.pathname.startsWith('/admin') ? 'admin' : 'store';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={section}>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="about" element={<About />} />
          <Route path="services" element={<Services />} />
          <Route path="team" element={<Team />} />
          <Route path="contact" element={<Contact />} />
          {['privacy', 'terms', 'shipping', 'returns', 'refund'].map((p) => (
            <Route key={p} path={p} element={<Policy page={p} />} />
          ))}

          <Route element={<GuestRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route path="reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="order-success/:id" element={<OrderSuccess />} />
            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<Overview />} />
              <Route path="dashboard/orders" element={<Navigate to="/orders" replace />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="dashboard/wishlist" element={<Wishlist embedded />} />
              <Route path="dashboard/addresses" element={<Addresses />} />
              <Route path="dashboard/profile" element={<Profile />} />
              <Route path="dashboard/password" element={<ChangePassword />} />
              <Route path="dashboard/notifications" element={<Notifications />} />
            </Route>
          </Route>

          <Route path="unauthorized" element={<StatusPage code={401} />} />
          <Route path="forbidden" element={<StatusPage code={403} />} />
          <Route path="*" element={<StatusPage code={404} />} />
        </Route>

        <Route path="admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductEditor />} />
            <Route path="products/:id" element={<AdminProductEditor />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:id" element={<AdminCustomerDetail />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="team" element={<AdminTeam />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="*" element={<StatusPage code={404} compact />} />
          </Route>
        </Route>
      </Routes>
    </AnimatePresence>
  );
}
