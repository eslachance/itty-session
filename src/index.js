import { parse as parseCookies, serialize as serializeCookies } from 'cookie';

const destroySessionCookie = serializeCookies('session', '', {
  httpOnly: true,
  secure: false,
  path: '/',
  sameSite: 'strict',
  maxAge: 0,
});

const saveSession = async(env, tableName, dbName) => {
  console.log('Save Session');
  console.log(this, env, tableName, dbName);
  const db = env[dbName];
  await db.prepare(`INSERT INTO ${tableName} (id, data) VALUES (?, ?)`).run(this.id, JSON.stringify(data));
};

const destroySession = async (cookieJar, env, tableName, dbName) => {
  console.log('Destroy Session');
  console.log(data, env, tableName, dbName);
  const db = env[dbName];
  await db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(data.id);
  cookieJar.push(destroySessionCookie);
};

export const createSessionsMiddleware = (dbName = 'SESSIONS', tableName = 'sessions') => ({
  sessionPreflight: async (request, env, ctx) => {
    request.cookieJar = [];
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    if (cookies.session) {
      console.log('Got a session cookie: ', cookies.session);
      const session = await env[dbName].prepare(`SELECT * FROM ${tableName} WHERE id = ?`).first(cookies.session);
      if (!session) {
        console.log('No session found in db, deleting cookie');
        cookieJar.push(destroySessionCookie);
        return {};
      }
      console.log('returning session from db: ', session)
      session.save = saveSession.bind(session, env, tableName, dbName);
      session.destroy = destroySession.bind(null, cookieJar, env, tableName, dbName);
      request.session = session;
    } else {
      console.log('No session cookie found, creating a new one');
      const sessionID = crypto.randomUUID();
      console.log('New session ID: ', sessionID);
      await env[dbName].prepare(`INSERT INTO ${tableName} (id, created_at) VALUES (?, ?)`).run(sessionID, new Date());
      request.session = {};
      cookieJar.push(
        serializeCookies('session', sessionID, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 365 * 10,
        })
      );
    }
  },

  sessionify: async (response, request) => {
    if (!response) {
      throw new Error('No fetch handler responded and no upstream to proxy to specified.');
    }
    await request.session.save();
    const { headers, status, body } = response;
    const existingHeaders = Object.fromEntries(headers);
    const cookies = cookieJar.join('; ');
    cookieJar = [];

    return new Response(body, {
      status,
      headers: {
        ...existingHeaders,
        'set-cookie': cookies,
        'content-type': headers.get('content-type'),
      },
    });
  },
});
