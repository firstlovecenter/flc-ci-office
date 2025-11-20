export { default } from 'next-auth/middleware';

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/departments/:path*',
        '/transactions/:path*',
        '/users/:path*',
        '/reports/:path*',
    ],
};
