// middleware.js
// Protect dashboard routes

import { NextResponse } from 'next/server';

export function middleware(request) {
  // Skip API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip login page
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // For now, allow all access (auth handled client-side)
  // In production, check session cookie here
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};