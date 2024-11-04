import { parse as parseCookies, serialize as serializeCookies } from 'cookie';

export const createSessionsMiddleware = async (env, db) => {
  env.__sessions =
    env.__sessions ||
    new Map();

  let cookieJar = [];

  return {
    sessionPreflight: async (request) => {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      if (cookies.session) {
        if (!env.__sessions.has(cookies.session)) {
          env.__sessions.set(cookies.session, {}); 
        }
        request.session = env.__sessions.get(cookies.session);
      } else {
        const sessionID = crypto.randomUUID();
        env.__sessions.set(sessionID, {});
        request.session = env.__sessions.get(sessionID);
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

    destroy: async (request) => {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      env.__sessions.delete(cookies.session);
      cookieJar.push(
        serializeCookies('session', '', {
          httpOnly: true,
          secure: false,
          path: '/',
          sameSite: 'strict',
          maxAge: 0,
        })
      );
    },

    sessionify: async (response) => {
      if (!response) {
        throw new Error('No fetch handler responded and no upstream to proxy to specified.');
      }
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
  };
};
