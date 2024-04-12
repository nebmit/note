import { redirect } from '@sveltejs/kit';

const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;

export async function handle({ event, resolve }) {
    const sessionId = event.cookies.get('session_id');
    if (!sessionId && isProtectedRoute(event.url.pathname)) {
        throw redirect(303, `${LOGIN_URL}?redirect_uri=${event.url.href}`);
    }

    const user = await validateToken(sessionId);
    if (user) {
        event.locals = {
            user: {
                isAuthenticated: true,
                uuid: user.uuid
            }
        };
    } else {
        if (isProtectedRoute(event.url.pathname)) {
            throw redirect(303, '/');
        }
    }

    return resolve(event);
}

function isProtectedRoute(pathname: string) {
    switch (pathname) {
    case '/':
        return false;
    }
    return true;
}

async function validateToken(token: string | undefined) {
    if (!token) {
        return false;
    }

    const response = await fetch(AUTH_URL, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        return false;
    }

    const content = await response.json();

    if (content.success) {
        return content.user;
    }

    return false;
}
