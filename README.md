# itty-session

itty-session is a cookie-based session middleware for itty-router on Cloudflare Workers.

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

## Requirements

Itty-session requires a database to store session data.

Currently the only database supported is Cloudflare's [D1](https://developers.cloudflare.com/d1/).

By default, itty-session will use the `SESSIONS` database and the `sessions` table.

Expected `wrangler.toml` example configuration (with a second database):

```toml
d1_databases = [
    { binding = "DB", database_name = "my-database", database_id = "ABCD-0123-4567-8901-ABCD-EFGH" },
    { binding = "SESSIONS", database_name = "my-sessions", database_id = "ABCD-0123-4567-8901-ABCD-EFGH" },
]
```

If you're using a different database, you can specify it via the `dbName` option, but make sure it matches the binding name in your `wrangler.toml` file.
A table named `sessions` is also required and will not automatically be created. Make sure it matches the table name in your `wrangler.toml` file.

Table configuration for `sessions`:

```sql
CREATE TABLE "sessions" (
	"sid"	TEXT UNIQUE,
	"data"	TEXT,
	"expiry"	INTEGER
);
```

> You can use [Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/#execute) to create the table for you.
> Example: `npx wrangler d1 execute karaoke-sessions --local --file=./sessions.sql` (or `--remote` to push to remote D1 instance)

## Usage

The following example is for cloudflare workers using itty-router as a base.

```js
import { AutoRouter, cors, withContent } from 'itty-router';
import { createSessionsMiddleware } from './itty-session';

const { sessionPreflight, sessionify } = createSessionsMiddleware({
  dbName: 'SESSIONS', // default
  tableName: 'sessions', // default
  logging: true, // default false
});

const router = AutoRouter({
  before: [sessionPreflight],
  finally: [sessionify],
});

router.post('/login', withContent, async (request) => {
  const { content } = request;
  // placeholder for real auth, please don't do this!
  if (!content?.username !== 'test' || !content?.password !== 'test') {
    return {
      success: false,
      message: 'invalid credentials',
    };
  }
  // creds are correct
  request.session.username = 'test';
  request.session.isLoggedIn = true;

  return {
    success: true,
    message: 'logged in',
    user: {
      username: user.username,
      isLoggedIn: true,
    },
  };
});

router.get('/logout', async (request) => {
  request.session?.destroy();

  return {
    success: true,
    message: 'logged out',
  };
});


export default router;
```

## Future Changes

As I continue developing this, a few items to take care of:

- More examples, including a basic non-cloudflare one
- Docs on specific methods and options
- Cookie settings (with defaults)
- Providers for persistence outside D1/Cloudflare (mongo, mysql, bla bla bla)
- More options?
- Got any suggestions? [Feel free to open an issue](https://github.com/eslachance/itty-session/issues)
