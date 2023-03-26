import { error, json } from '@sveltejs/kit';
import { parse, serialize } from 'cookie';

const users: Array<{ name: string, salt: string, content: string, secret: string }> = [
    {
        name: 'admin',
        content: 'ELGvhy2RGQDPThII',
        salt: '22921938238255138165311209243233179175794',
        secret: 'aRUtyVZDSHH5gKWr6SbHQeInZ4jmYKBiha4sP8SPIBD9+3o9QCOJ2ZdL/ZwOZYh+1bTdHv6UFrLu406LvX5GmQ=='
    }
]

export function GET({ url, cookies }) {
    let userEntry;

    if (url.searchParams.get('user')) {
        const user = url.searchParams.get('user');
        console.log('GET user by name', user)
        userEntry = users.find((u) => u.name === user);
    } else if (cookies.get('user')) {
        const userSecret = cookies.get('user');
        console.log('GET user by secret', userSecret)
        userEntry = users.find((u) => u.secret === userSecret);
    }
    if (!userEntry) {
        const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(64))));
        const user = {
            name: 'user' + users.length,
            salt: salt,
            content: ivBase64 + '',
            secret: secret
        };
        users.push(user);
        userEntry = user;
        console.log('Created new user', user, 'with salt', user.salt, 'and IV', user.content, 'and secret', user.secret, '\n');
    }

    let response = json({ name: userEntry.name, salt: userEntry.salt, content: userEntry.content });
    response.headers.append('Set-Cookie', serialize('user', userEntry.secret, {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
    }));

    return response;
}

export async function POST({ request }) {
    const cookieString = request.headers.get('cookie');
    const { content } = await request.json();

    if (!cookieString) {
        throw error(400, 'Missing cookie header');
    }

    const cookie = parse(cookieString);

    if (!cookie.user || !content) {
        throw error(400, 'Missing user or content parameter');
    }

    let userEntry = users.find((u) => u.secret === cookie.user);

    if (userEntry === undefined) {
        throw error(400, 'Invalid user');
    }

    userEntry.content = content;

    let response = json({ success: true });

    return response;
}
