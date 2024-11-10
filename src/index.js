import { parse as parseCookies, serialize as serializeCookies } from 'cookie';
import { log } from './utils/logger.js';

let checkedDatabase = false;
let provider;

export const createSessionsMiddleware = ({
  Provider,
  providerOptions = {},
  logging = false,
} = {}) => ({
  sessionPreflight: async (request, env) => {
    try {
      provider = new Provider({ env, logging, ...providerOptions });
    } catch (error) {
      log(true, 'error', 'Error while creating provider: ', error);
      throw new Error('Error while creating provider: ', error);
    }
    
    if(!checkedDatabase) {
      checkedDatabase = true;
      await provider.precheck();
    }

    request.cookieJar = [];
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    log(logging, 'log', 'Session cookie:', cookies?.sid);
    
    let sessionData;
    
    if (cookies?.sid) {
      try {
        sessionData = await provider.getSession(cookies?.sid);
      } catch (error) {
        sessionData = "{}";
        log(logging, 'error', `Error while reading session data for ${cookies?.sid}: `, error);
      }
    } else {
      sessionData = "{}";
    }
    log(logging, 'log', `Existing sessionData stored in DB for ${cookies?.sid} is: [${typeof sessionData?.data}]`,  sessionData?.data);
    request.session = sessionData?.data ? JSON.parse(sessionData?.data) : null;
    
    if (!request.session) {
      request.session = {};
      try {
        request.sessionID = await provider.createSession();        
      } catch (error) {
        log(logging, 'error', 'Error while creating session data: ', error);
        throw new Error('Error while creating session data: ', error);
      }
      log(logging, 'log', `Created new session with ID ${request.sessionID}`);
      request.cookieJar.push(
        serializeCookies('sid', request.sessionID, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 365 * 10,
        })
      );
    } else {
      request.sessionID = cookies?.sid;
    }
    
    request.session.destroy = async () => {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      log(logging, 'log', `Destroying session with ID ${cookies?.sid}`);
      try {
        await provider.destroySession(cookies?.sid);
      } catch (error) {
        log(logging, 'error', 'Error while destroying session data: ', error);
      }

      request.cookieJar.push(
        serializeCookies('sid', '', {
          httpOnly: true,
          secure: false,
          path: '/',
          sameSite: 'strict',
          maxAge: 0,
        })
      );
    }
  },    

  sessionify: async (response, request, _env, ctx) => {
    if (!response) {
      throw new Error('No fetch handler responded and no upstream to proxy to specified.');
    }
    const { headers, status, body } = response;
    const existingHeaders = Object.fromEntries(headers);
    const responseCookies = request.cookieJar.join('; ');
    
    delete request.session.destroy;
    log(logging, 'log', `Updating session data for session ID ${request.sessionID} with data: `, request.session);
    try {
      ctx.waitUntil(provider.setSession(request.sessionID, request.session));
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
