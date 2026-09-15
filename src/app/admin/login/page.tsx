import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { AdminLoginView } from './admin-login-view';

export const metadata = {
  title: 'Washed 관리자 로그인',
  description: '기기 · 대기열 · 신고 관리 콘솔 로그인',
};

export default async function AdminLoginPage() {
  const isAuth = await isAdminAuthenticated();
  if (isAuth) {
    redirect('/admin');
  }

  return <AdminLoginView />;
}
