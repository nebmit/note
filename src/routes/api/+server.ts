import { error, json } from '@sveltejs/kit';

const users: Map<string, { salt: string, content: string }> = new Map();

export function GET({ url }) {
    const user = url.searchParams.get('user') ?? '';

    if (users.get(user) === undefined) {
        const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ivBase64 = btoa(String.fromCharCode(...iv));
        users.set(user, {
            salt: salt,
            content: ivBase64 + ''
        });
        console.log('Created new user', user, 'with salt', users.get(user)?.salt, 'and IV', users.get(user)?.content);
    }

    const content = users.get(user);

    return json(content);
}

export async function POST({ request }) {
    const { user, content } = await request.json();

    if (!user || !content) {
        throw error(400, 'Missing user or content parameter');
    }

    users.set(user, {
        salt: users.get(user)?.salt ?? '',
        content: content
    });

    return json({ success: true });
}
