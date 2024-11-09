import { parse as parseCookies, serialize as serializeCookies } from 'cookie';

const log = (doLog, level, ...message) => {
  if(Array.isArray(level)) {
    message = level;
    level = 'log';
  }
  if(doLog) {
    console[level](...message);
  }
}

export const createSessionsMiddleware = ({
  dbName = 'SESSIONS',
  tableName = 'sessions',
  logging = false,
} = {}) => ({
  sessionPreflight: async (request, env) => {
    request.cookieJar = [];
    try {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      const sessionData = await env[dbName].prepare(`SELECT * FROM ${tableName} WHERE sid = ?`).bind(cookies?.session).first();
      log(logging, 'log', `Existing sessionData stored in DB for ${cookies?.session} is: `, JSON.parse(sessionData?.data));
      request.session = sessionData?.data ? JSON.parse(sessionData?.data) : null;
      
      if (!request.session) {
        const sessionID = crypto.randomUUID();
        log(logging, 'log', `Creating new session with ID ${sessionID}`);
        request.session = {};
        const maxAge = 60 * 60 * 24 * 365 * 10;
        await env[dbName].prepare(`INSERT INTO ${tableName} (sid, data, expiry) VALUES (?, ?, ?)`).bind(sessionID, JSON.stringify({}), Date.now() + maxAge).run();
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
    } catch(error) {
      log(logging, 'error', 'Error while creating or reading session data: ', error);
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
      await env[dbName].prepare(`UPDATE ${tableName} SET data = ? WHERE sid = ?`).bind(JSON.stringify(request.session), cookies?.session).run();
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
