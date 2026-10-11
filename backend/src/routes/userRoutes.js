const router = require('express').Router();
const c = require('../controllers/userController');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { upload } = require('../services/uploadService');
const { idParams } = require('../validators/common');
const { user, address } = require('../validators/schemas');

router.use(protect);

router.put('/me', validate({ body: user.updateProfile }), c.updateProfile);
router.post('/me/avatar', upload.single('avatar'), c.uploadAvatar);
router.delete('/me/avatar', c.removeAvatar);
router.get('/me/dashboard', c.dashboard);

router.get('/me/addresses', c.listAddresses);
router.post('/me/addresses', validate({ body: address }), c.createAddress);
router.put('/me/addresses/:id', validate({ params: idParams, body: address.partial() }), c.updateAddress);
router.patch('/me/addresses/:id/default', validate({ params: idParams }), c.setDefaultAddress);
router.delete('/me/addresses/:id', validate({ params: idParams }), c.deleteAddress);

router.get('/me/notifications', c.listNotifications);
router.get('/me/notifications/unread-count', c.unreadCount);
router.patch('/me/notifications/read-all', c.markAllNotificationsRead);
router.patch('/me/notifications/:id/read', validate({ params: idParams }), c.markNotificationRead);
router.delete('/me/notifications/:id', validate({ params: idParams }), c.deleteNotification);

module.exports = router;
