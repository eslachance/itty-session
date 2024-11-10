import { parse as parseCookies, serialize as serializeCookies } from 'cookie';

const log = (doLog, level, ...message) => {
  if(Array.isArray(level)) {
    message = level;
    level = 'log';
  }
  if(doLog) {
    console[level](`[${new Date().toISOString()}: ${level}]`, ...message);
  }
}

export const createSessionsMiddleware = ({
  dbName = 'SESSIONS',
  tableName = 'sessions',
  logging = false,
} = {}) => ({
  sessionPreflight: async (request, env) => {
    if(!env[dbName]) {
      log(true, 'error', `D1 Database not found in environment. Please make sure to setup ${dbName} in your wrangler.toml file.`);
      throw new Error(`D1 Database not found in environment. Please make sure to setup ${dbName} in your wrangler.toml file.`);
    }
    request.cookieJar = [];
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    log(logging, 'log', 'Session cookie:', cookies?.session);
    let sessionData;
    if(cookies?.session) {
      try {
        sessionData = await env[dbName].prepare(`SELECT * FROM ${tableName} WHERE sid = ?`).bind(cookies?.session).first();
      } catch (error) {
        sessionData = "{}";
        log(logging, 'error', `Error while reading session data for ${cookies?.session}: `, error);
      }
    } else {
      sessionData = "{}";
    }
    log(logging, 'log', `Existing sessionData stored in DB for ${cookies?.session} is: [${typeof sessionData?.data}]`,  sessionData?.data);
    request.session = sessionData?.data ? JSON.parse(sessionData?.data) : null;
    
    if (!request.session) {
      const sessionID = crypto.randomUUID();
      log(logging, 'log', `Creating new session with ID ${sessionID}`);
      request.session = {};
      const maxAge = 60 * 60 * 24 * 365 * 10;
      try {
        await env[dbName].prepare(`INSERT INTO ${tableName} (sid, data, expiry) VALUES (?, ?, ?)`).bind(sessionID, JSON.stringify({}), Date.now() + maxAge).run();
      } catch (error) {
        log(logging, 'error', 'Error while creating session data: ', error);
        log(logging, 'log', `INSERT INTO ${tableName} (sid, data, expiry) VALUES (${sessionID}, ${JSON.stringify({})}, ${Date.now() + maxAge})`);
      }
      request.cookieJar.push(
        serializeCookies('session', sessionID, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'strict',
          maxAge,
        })
      );
    }
    
    request.session.destroy = async () => {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      log(logging, 'log', `Destroying session with ID ${cookies?.session}`);
      try {
        await env[dbName].prepare(`DELETE FROM ${tableName} WHERE sid = ?`).bind(cookies?.session).run();
      } catch (error) {
        log(logging, 'error', 'Error while destroying session data: ', error);
      }

      request.cookieJar.push(
        serializeCookies('session', '', {
          httpOnly: true,
          secure: false,
          path: '/',
          sameSite: 'strict',
          maxAge: 0,
        })
      );
    }
  },    

  sessionify: async (response, request, env, ctx) => {
    if (!response) {
      throw new Error('No fetch handler responded and no upstream to proxy to specified.');
    }
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    
    const { headers, status, body } = response;
    const existingHeaders = Object.fromEntries(headers);
    const responseCookies = request.cookieJar.join('; ');
    
    delete request.session.destroy;
    log(logging, 'log', `Updating session data for session ID ${cookies?.session} with data: `, request.session);
    try {
      ctx.waitUntil(env[dbName].prepare(`UPDATE ${tableName} SET data = ? WHERE sid = ?`).bind(JSON.stringify(request.session), cookies?.session).run());
    } catch (error) {
      log(logging, 'error', 'Error while updating session data: ', error);
    }

    return new Response(body, {
      status,
      headers: {
        ...existingHeaders,
        'set-cookie': responseCookies,
        'content-type': headers.get('content-type'),
      },
    });
  },
});
