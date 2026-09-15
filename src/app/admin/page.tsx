import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { AdminView } from './admin-view';

export const metadata = {
  title: 'Washed 관리자 콘솔',
  description: '기기 · 대기열 · 신고 관리 콘솔',
};

export default async function AdminPage() {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    redirect('/admin/login');
  }

  return <AdminView />;
}
