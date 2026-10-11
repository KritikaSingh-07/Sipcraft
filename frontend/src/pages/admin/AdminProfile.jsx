import Profile from '@/pages/dashboard/Profile';
import ChangePassword from '@/pages/dashboard/ChangePassword';

/** Admins manage their own account with the same secure profile and password flows as customers. */
export default function AdminProfile() {
  return (
    <div className="space-y-12">
      <Profile />
      <ChangePassword />
    </div>
  );
}
