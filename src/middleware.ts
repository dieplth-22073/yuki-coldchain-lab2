import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** ログイン不要で到達してよいパス。それ以外はすべてゲートの内側。 */
const PUBLIC_PATHS = ['/login', '/auth'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 環境変数が無い場合でもログイン画面だけは出し、設定漏れだと分かるようにする。
  // 未設定のまま中身を見せてしまわないよう、他のパスは /login へ送る。
  if (!url || !key) {
    if (isPublic(request.nextUrl.pathname)) return response;
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.searchParams.set('reason', 'env-missing');
    return NextResponse.redirect(to);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() は毎回 Supabase に問い合わせる。getSession() と違い Cookie を信用しない。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.searchParams.set('redirect', pathname);
    return NextResponse.redirect(to);
  }

  if (user && pathname === '/login') {
    const to = request.nextUrl.clone();
    to.pathname = '/';
    to.search = '';
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 静的アセットと画像最適化を除く全パス。
     * API ルートも含めてゲートの対象にする。
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
