# LU48 — Session Authentication

Express and Prisma example of server-side session authentication. The browser stores only a signed, opaque `sid` cookie; user identity stays in the server-side session store and is reloaded from Prisma for protected requests.

## Requirements

- Node.js 18 or newer
- npm

## Setup and run

```bash
cp .env.example .env
# Replace COOKIE_SECRET with a unique random value of at least 32 characters.
npm install
npm run setup
npm run dev
```

The setup command generates the Prisma client, creates the local SQLite database, and seeds a demo account: `sam@example.com` / `SessionDemo!48`.

`COOKIE_SECURE=false` is suitable only for local HTTP testing. Set it to `true` when testing over HTTPS; Secure cookies are not sent by an HTTP client. Production always enables the Secure attribute. Do not commit `.env` or real secrets.

## Endpoints

- `POST /auth/login` — accepts `{ "email": "sam@example.com", "password": "SessionDemo!48" }`; successful login returns safe user fields and sets a signed `sid` cookie.
- `GET /auth/me` — returns the safe identity resolved from a verified cookie and live server session.
- `POST /auth/logout` — revokes the server session and clears the cookie; repeated calls return `204`.

Protected-route failures share the generic `401 AUTH_REQUIRED` response. Unknown email and incorrect password share the same generic `401 INVALID_CREDENTIALS` response. Responses never include password hashes or raw Prisma/session errors.

## Verify with curl

Start the server, then in a second terminal:

```bash
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"sam@example.com","password":"SessionDemo!48"}' \
  http://localhost:3000/auth/login

curl -i -b cookies.txt http://localhost:3000/auth/me

curl -i -X POST -b cookies.txt -c cookies.txt http://localhost:3000/auth/logout

# The revoked cookie can no longer authenticate.
curl -i -b cookies.txt http://localhost:3000/auth/me
```

Inspect the login response for `sid`, `HttpOnly`, `SameSite=Lax`, and `Path=/`. For a Secure-cookie check, use HTTPS and `COOKIE_SECURE=true` (or `NODE_ENV=production`).

## Tests

After setup, run the HTTP integration suite:

```bash
npm test
```

The tests cover signed-cookie issuance, successful identity resolution, generic credential failures, missing/tampered cookies, logout revocation, and idempotent logout.

## Session storage note

The included in-memory `Map` is for learning and local execution only. A process restart discards sessions, and multiple server instances cannot share them. Production deployments should replace it with a shared expiring store such as Redis while preserving the same create, resolve, expiry, and destroy contract.
