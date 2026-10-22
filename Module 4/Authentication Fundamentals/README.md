# Authentication Fundamentals

Express and Prisma API demonstrating safe registration and login. Registration stores only an asynchronous bcryptjs hash. Login verifies it with `bcrypt.compare`; an unknown-email login also performs a comparison against a valid, ephemeral dummy hash to reduce account-enumeration timing signals.

## Requirements and setup

Use Node.js 18 or newer.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm start
```

The local SQLite database is stored at `prisma/dev.db`, which is ignored by Git. `BCRYPT_COST` defaults to 12 and may be set between 4 and 15; higher values increase password-hashing work. Passwords longer than 72 UTF-8 bytes are rejected to avoid bcrypt's input truncation behavior. Never commit `.env`, real secrets, plaintext passwords, or password hashes.

## Endpoints

### `POST /auth/register`

Request:

```json
{ "name": "Sam", "email": "sam@example.com", "password": "correct horse battery staple" }
```

Creates the account and returns `201` with `{ "data": { "id", "name", "email" } }`. Email is trimmed and lowercased. Duplicate normalized emails return `409 EMAIL_EXISTS`. Invalid or missing fields return `400 INVALID_REQUEST`.

### `POST /auth/login`

Request:

```json
{ "email": "sam@example.com", "password": "correct horse battery staple" }
```

Valid credentials return `200` with the same safe identity fields. Unknown email and wrong password both return `401` with the exact same response:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }
```

Malformed or missing fields return `400 INVALID_REQUEST`. Unexpected failures return a generic `500 INTERNAL_ERROR`; raw Prisma/bcrypt errors are not returned or logged. The route layer delegates all authentication workflow to the service, and Prisma access is isolated in repository functions.

## Tests

After setup, run:

```bash
npm test
```

The HTTP integration test checks registration, persisted bcrypt verification, safe response fields, duplicate-email conflict, valid login, identical generic credential failures, invalid input, and malformed JSON.
