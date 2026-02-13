// middleware.js - Password protection
import { NextResponse } from 'next/server';

const PASSWORD = 'LucyClawBot';
const COOKIE_NAME = 'lucyworkspace-auth';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(COOKIE_NAME);
  
  if (authCookie?.value !== PASSWORD) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
