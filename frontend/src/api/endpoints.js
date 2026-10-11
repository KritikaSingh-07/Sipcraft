import { api, unwrap } from './client';

const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const authApi = {
  register: (body) => api.post('/auth/register', body).then((r) => r.data),
  login: (body) => api.post('/auth/login', body).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  me: () => unwrap(api.get('/auth/me')),
  forgotPassword: (body) => api.post('/auth/forgot-password', body).then((r) => r.data),
  resetPassword: (body) => api.post('/auth/reset-password', body).then((r) => r.data),
  changePassword: (body) => api.post('/auth/change-password', body).then((r) => r.data),
};

export const productApi = {
  list: (params) => unwrap(api.get('/products', { params: clean(params) })),
  get: (slug) => unwrap(api.get(`/products/${encodeURIComponent(slug)}`)),
  suggestions: (q) => unwrap(api.get('/products/suggestions', { params: { q } })),
  reviews: (productId, params) => unwrap(api.get(`/products/${productId}/reviews`, { params: clean(params) })),
  reviewEligibility: (productId) => unwrap(api.get(`/products/${productId}/reviews/eligibility`)),
  createReview: (productId, body) => api.post(`/products/${productId}/reviews`, body).then((r) => r.data),
  // admin
  adminList: (params) => unwrap(api.get('/products/admin/list', { params: clean(params) })),
  adminGet: (id) => unwrap(api.get(`/products/admin/${id}`)),
  create: (body) => api.post('/products', body).then((r) => r.data),
  update: (id, body) => api.put(`/products/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`).then((r) => r.data),
  bulk: (body) => api.post('/products/bulk', body).then((r) => r.data),
  uploadImages: (id, files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return api.post(`/products/${id}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then((r) => r.data);
  },
  deleteImage: (id, imageId) => api.delete(`/products/${id}/images/${imageId}`).then((r) => r.data),
  reorderImages: (id, order) => api.put(`/products/${id}/images/reorder`, { order }).then((r) => r.data),
};

export const categoryApi = {
  list: (params) => unwrap(api.get('/categories', { params })),
  create: (body) => api.post('/categories', body).then((r) => r.data),
  update: (id, body) => api.put(`/categories/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const cartApi = {
  get: () => unwrap(api.get('/cart')),
  add: (body) => api.post('/cart', body).then((r) => r.data),
  update: (itemId, body) => api.put(`/cart/${itemId}`, body).then((r) => r.data),
  remove: (itemId) => api.delete(`/cart/${itemId}`).then((r) => r.data),
  clear: () => api.delete('/cart').then((r) => r.data),
  merge: (items) => api.post('/cart/merge', { items }).then((r) => r.data),
  quote: (items) => unwrap(api.post('/cart/quote', { items })),
  applyCoupon: (code) => api.post('/cart/coupon', { code }).then((r) => r.data),
  removeCoupon: () => api.delete('/cart/coupon').then((r) => r.data),
};

export const wishlistApi = {
  get: () => unwrap(api.get('/wishlist')),
  add: (productId) => api.post(`/wishlist/${productId}`).then((r) => r.data),
  remove: (productId) => api.delete(`/wishlist/${productId}`).then((r) => r.data),
  merge: (productIds) => unwrap(api.post('/wishlist/merge', { productIds })),
};

export const couponApi = {
  publicList: () => unwrap(api.get('/coupons/public')),
  validate: (code) => api.post('/coupons/validate', { code }).then((r) => r.data),
  list: (params) => unwrap(api.get('/coupons', { params: clean(params) })),
  create: (body) => api.post('/coupons', body).then((r) => r.data),
  update: (id, body) => api.put(`/coupons/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/coupons/${id}`).then((r) => r.data),
};

export const userApi = {
  updateProfile: (body) => api.put('/users/me', body).then((r) => r.data),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then((r) => r.data);
  },
  removeAvatar: () => api.delete('/users/me/avatar').then((r) => r.data),
  dashboard: () => unwrap(api.get('/users/me/dashboard')),
  addresses: () => unwrap(api.get('/users/me/addresses')),
  createAddress: (body) => api.post('/users/me/addresses', body).then((r) => r.data),
  updateAddress: (id, body) => api.put(`/users/me/addresses/${id}`, body).then((r) => r.data),
  setDefaultAddress: (id) => api.patch(`/users/me/addresses/${id}/default`).then((r) => r.data),
  deleteAddress: (id) => api.delete(`/users/me/addresses/${id}`).then((r) => r.data),
  notifications: (params) => unwrap(api.get('/users/me/notifications', { params: clean(params) })),
  unreadCount: () => unwrap(api.get('/users/me/notifications/unread-count')),
  markRead: (id) => api.patch(`/users/me/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/users/me/notifications/read-all').then((r) => r.data),
  deleteNotification: (id) => api.delete(`/users/me/notifications/${id}`).then((r) => r.data),
};

export const orderApi = {
  list: (params) => unwrap(api.get('/orders', { params: clean(params) })),
  get: (id) => unwrap(api.get(`/orders/${id}`)),
  cancel: (id, reason) => api.put(`/orders/${id}/cancel`, { reason }).then((r) => r.data),
  requestReturn: (id, reason) => api.post(`/orders/${id}/return`, { reason }).then((r) => r.data),
};

export const paymentApi = {
  config: () => unwrap(api.get('/payments/config')),
  createOrder: (body) => unwrap(api.post('/payments/create-order', body)),
  verify: (body) => api.post('/payments/verify', body, { timeout: 45000 }).then((r) => r.data),
  failed: (body) => api.post('/payments/failed', body).then((r) => r.data),
  retry: (orderId) => unwrap(api.post(`/payments/retry/${orderId}`)),
};

export const reviewApi = {
  featured: () => unwrap(api.get('/reviews/featured')),
  mine: () => unwrap(api.get('/reviews/mine')),
  update: (id, body) => api.put(`/reviews/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/reviews/${id}`).then((r) => r.data),
  report: (id, reason) => api.post(`/reviews/${id}/report`, { reason }).then((r) => r.data),
  uploadImages: (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return unwrap(api.post('/uploads/review/images', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
};

export const contentApi = {
  settings: () => unwrap(api.get('/settings')),
  page: (key) => unwrap(api.get(`/content/${key}`)),
  banners: (placement) => unwrap(api.get('/banners', { params: clean({ placement }) })),
  team: () => unwrap(api.get('/team')),
  contact: (body) => api.post('/contact', body).then((r) => r.data),
  newsletter: (email) => api.post('/newsletter', { email }).then((r) => r.data),
};

export const uploadApi = {
  upload: (folder, files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return unwrap(api.post(`/uploads/${folder}`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
  remove: (publicId) => api.delete('/uploads', { data: { publicId } }).then((r) => r.data),
};

export const adminApi = {
  dashboard: () => unwrap(api.get('/admin/dashboard')),
  analytics: (range) => unwrap(api.get('/admin/analytics', { params: { range } })),
  customers: (params) => unwrap(api.get('/admin/customers', { params: clean(params) })),
  customer: (id) => unwrap(api.get(`/admin/customers/${id}`)),
  updateCustomer: (id, body) => api.patch(`/admin/customers/${id}`, body).then((r) => r.data),
  orders: (params) => unwrap(api.get('/admin/orders', { params: clean(params) })),
  order: (id) => unwrap(api.get(`/admin/orders/${id}`)),
  updateOrderStatus: (id, body) => api.put(`/admin/orders/${id}/status`, body).then((r) => r.data),
  refundOrder: (id, body) => api.post(`/admin/orders/${id}/refund`, body).then((r) => r.data),
  orderNotes: (id, adminNotes) => api.put(`/admin/orders/${id}/notes`, { adminNotes }).then((r) => r.data),
  payments: (params) => unwrap(api.get('/admin/payments', { params: clean(params) })),
  reviews: (params) => unwrap(api.get('/admin/reviews', { params: clean(params) })),
  moderateReview: (id, status) => api.patch(`/admin/reviews/${id}`, { status }).then((r) => r.data),
  deleteReview: (id) => api.delete(`/admin/reviews/${id}`).then((r) => r.data),
  messages: (params) => unwrap(api.get('/admin/messages', { params: clean(params) })),
  updateMessage: (id, status) => api.patch(`/admin/messages/${id}`, { status }).then((r) => r.data),
  deleteMessage: (id) => api.delete(`/admin/messages/${id}`).then((r) => r.data),
  subscribers: (params) => unwrap(api.get('/admin/subscribers', { params: clean(params) })),
  banners: () => unwrap(api.get('/admin/banners')),
  createBanner: (body) => api.post('/admin/banners', body).then((r) => r.data),
  updateBanner: (id, body) => api.put(`/admin/banners/${id}`, body).then((r) => r.data),
  deleteBanner: (id) => api.delete(`/admin/banners/${id}`).then((r) => r.data),
  team: () => unwrap(api.get('/admin/team')),
  createTeam: (body) => api.post('/admin/team', body).then((r) => r.data),
  updateTeam: (id, body) => api.put(`/admin/team/${id}`, body).then((r) => r.data),
  deleteTeam: (id) => api.delete(`/admin/team/${id}`).then((r) => r.data),
  activity: (params) => unwrap(api.get('/admin/activity', { params: clean(params) })),
  refunds: (params) => unwrap(api.get('/admin/refunds', { params: clean(params) })),
  approveRefund: (id, note) => api.post(`/admin/refunds/${id}/approve`, { note }).then((r) => r.data),
  rejectRefund: (id, reason) => api.post(`/admin/refunds/${id}/reject`, { reason }).then((r) => r.data),
  content: (key) => unwrap(api.get(`/admin/content/${key}`)),
  updateContent: (key, body) => api.put(`/admin/content/${key}`, body).then((r) => r.data),
  resetContent: (key) => api.delete(`/admin/content/${key}`).then((r) => r.data),
  sendNotification: (body) => api.post('/admin/notifications', body).then((r) => r.data),
  sentNotifications: () => unwrap(api.get('/admin/notifications/sent')),
  search: (q) => unwrap(api.get('/admin/search', { params: { q } })),
  replyMessage: (id, message) => api.post(`/admin/messages/${id}/reply`, { message }).then((r) => r.data),
  settings: () => unwrap(api.get('/admin/settings')),
  updateSettings: (body) => api.put('/admin/settings', body).then((r) => r.data),
};
