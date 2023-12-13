import { error, json } from '@sveltejs/kit';
import { parse, serialize } from 'cookie';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database<sqlite3.Database, sqlite3.Statement>;
async function database(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    if (db != undefined) return db;
    db = await open({
        filename: './database_sqlite3.db',
        driver: sqlite3.Database,
    });

    await db.exec(`CREATE TABLE IF NOT EXISTS users (name TEXT, salt TEXT, content TEXT, secret TEXT)`);
    return db;
}

export async function GET({ locals }) {
    const db = await database();
    let userEntry;

    if (locals.user?.isAuthenticated) {
        const userName = locals.user.uuid;
        userEntry = await db.get('SELECT * FROM users WHERE name = ?', userName);
        if (!userEntry) {
            const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = btoa(String.fromCharCode(...iv));
            const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(64))));
            const user = {
                name: userName,
                salt: salt,
                content: ivBase64 + '',
                secret: secret
            };

            await db.run('INSERT INTO users (name, salt, content, secret) VALUES (?, ?, ?, ?)', [user.name, user.salt, user.content, user.secret]);
            userEntry = user;
            console.log('Created new user', user, 'with salt', user.salt, 'and IV', user.content, 'and secret', user.secret, '\n');
        }
    }

    if (!userEntry) {
        throw error(400, 'Invalid user');
    }

    const response = json({ name: userEntry.name, salt: userEntry.salt, content: userEntry.content });
    response.headers.append('Set-Cookie', serialize('user', userEntry.secret, {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
    }));

    return response;
}

export async function POST({ request }) {
    const db = await database();
    const cookieString = request.headers.get('cookie');
    const { content } = await request.json();

    if (!cookieString) {
        throw error(400, 'Missing cookie header');
    }

    const cookie = parse(cookieString);

    const userEntry = await db.get('SELECT * FROM users WHERE secret = ?', cookie.user);

    if (!userEntry) {
        throw error(400, 'Invalid user');
    }

    await db.run('UPDATE users SET content = ? WHERE secret = ?', [content, cookie.user]);

    const response = json({ success: true });

    return response;
}
