import { parse as parseCookies, serialize as serializeCookies } from 'cookie';
// import BriteLite from './britelite';

export const createSessionsMiddleware = async (env, db) => {
  env.__sessions =
    env.__sessions ||
    new Map();

  let cookieJar = [];
  let sessionID;

  return {
    sessionPreflight: async (request) => {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      console.log('itty-sessions preflight, cookies: ', cookies);
      if (!cookies.session) {
        sessionID = crypto.randomUUID();
        console.log('Checking Data for: ',sessionID);
        await env.__sessions.set(sessionID, {});
        let session;
        try {
          session = await env.__sessions.get(sessionID);
        } catch (e) {
          console.log('Error getting session: ', e);
        }
        request.session = session;
        cookieJar.push(
          serializeCookies('session', sessionID, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10,
          })
        );
      } else {
        sessionID = cookies.session;
        console.log('Checking Data for: ',sessionID);
        console.log('Saved data: ', await env.__sessions.get(sessionID));
        request.session = await env.__sessions.get(sessionID) || {};
      }
    },

    destroy: async () => {
      await env.__sessions.delete(sessionID);
      sessionID = null;
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
