import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;

  const isAdminRoute = url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login');
  const isSettingsApi = url.pathname.startsWith('/api/settings');
  const isGetRegistrationsApi = url.pathname.startsWith('/api/register') && req.method === 'GET';
  const isFaqsWrite = url.pathname.startsWith('/api/faqs') && req.method !== 'GET';
  const isUploadApi = url.pathname.startsWith('/api/upload');
  const isWebinarApi = url.pathname.startsWith('/api/webinar');
  const isFeaturesWrite = url.pathname.startsWith('/api/features') && req.method !== 'GET';
  const isAgendaWrite = url.pathname.startsWith('/api/agenda-items') && req.method !== 'GET';
  const isAdminTeamApi = url.pathname.startsWith('/api/admin/team');
  const isAdminZoomApi = url.pathname.startsWith('/api/admin/zoom');
  const isAdminRegsApi = url.pathname.startsWith('/api/admin/registrations');
  const isAdminSessionsApi = url.pathname.startsWith('/api/admin/sessions');
  const isAdminEmailApi   = url.pathname.startsWith('/api/admin/email');

  const gatedApi =
    isSettingsApi ||
    isGetRegistrationsApi ||
    isFaqsWrite ||
    isUploadApi ||
    isWebinarApi ||
    isFeaturesWrite ||
    isAgendaWrite ||
    isAdminTeamApi ||
    isAdminZoomApi ||
    isAdminRegsApi ||
    isAdminSessionsApi ||
    isAdminEmailApi;

  if (!(isAdminRoute || gatedApi)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_session')?.value;
  const session = await verifyAdminSession(token);

  if (!session) {
    if (gatedApi) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/settings/:path*',
    '/api/register',
    '/api/faqs',
    '/api/upload',
    '/api/webinar',
    '/api/features',
    '/api/agenda-items',
    '/api/admin/team',
    '/api/admin/team/:path*',
    '/api/admin/zoom/:path*',
    '/api/admin/registrations/:path*',
    '/api/admin/sessions',
    '/api/admin/sessions/:path*',
    '/api/admin/email/:path*',
  ],
};
