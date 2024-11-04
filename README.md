# itty-session

itty-session is a cookie-based session middleware for itty-router.

> This is not an official library and is not affiliated with Kevin R. Whitley.

## Why ?

Cookie-based sessions are currently the most secure way to create sessions for your web app. 

[No](https://evertpot.com/jwt-is-a-bad-default),
[JWTs](https://redis.com/blog/json-web-tokens-jwt-are-dangerous-for-user-sessions)
[are](https://gist.github.com/samsch/a5c99b9faaac9f131967e8a6d61682b0)
[not](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
[the](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
[solution](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html).

Specifically, the defaults set for itty-session are `httpOnly`, `secure`, `sameSite: strict`, which is the most secure according to OWASP's cheat sheets (see links above).

I'll elaborate later. Right now, let's get down to brass tacks.

## Installation

Install itty-session via your favourite package manager. You know the drill. 

```shell
npm install itty-session
pnpm install itty-session
yarn add itty-session
```

## Usage

Will be working on more specific examples but here's one for cloudflare workers using itty-router as a base.

```js
import { Router, json } from 'itty-router';
import { createSessionsMiddleware } from 'itty-sessions';

export default {
  async fetch(request, env, ctx) {
    const { sessionPreflight, destroy, sessionify } = await createSessionsMiddleware(env, env.DB);
    if (!env.__router) {

      const router = Router({
        before: [sessionPreflight],  // 
        finally: [sessionify],   // , 
      });

      router.post('/login', async ({ body }) => {
        request.session.username = "test";
        request.session.isLoggedIn = true;
        return json({
          success: true,
          message: 'logged in',
          user: {
            username: "test",
            avatar: 'https://github.com/user-attachments/assets/ef42a076-4539-4391-b6e8-f15a95c639f2',
            role: 'admin',
            isLoggedIn: true,
          }
        });
      });

      router.get('/me', () => {
        if (!request.session?.isLoggedIn) {
           return json({ message: 'not logged in' });
         }
        return json({
          success: true,
          user: {
            username: request.session?.username,
            avatar: 'https://github.com/user-attachments/assets/ef42a076-4539-4391-b6e8-f15a95c639f2',
            role: 'admin',
            isLoggedIn: true,
          }
        });
      });

      router.get('/logout', async () => {
        request.session.username = null;
        request.session.isLoggedIn = false;
        await destroy();
        return json({
          success: true,
          message: 'fake logged out',
        });
      });

      router.get('/sessions/clear', async () => {
        await env.__sessions.clear();
        return json({
          success: true,
          message: 'sessions cleared',
        });
      });

      // 404 for everything else
      router.all('*', () => new Response('Not Found.', { status: 404 }));
      env.__router = router;
    }

    return env.__router.fetch(request);
  },
};
```

## Future Changes

As I continue developing this, a few items to take care of:

- More examples, including a basic non-cloudflare one
- Docs on specific methods and options
- Cookie settings (with defaults)
- Providers for actual persistence (d1, mongo, mysql, bla bla bla)
- More options?
- Got any suggestions? [Feel free to open an issue](https://github.com/eslachance/itty-session/issues)

