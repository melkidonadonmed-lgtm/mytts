import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import {
  SESSION_COOKIE_NAME,
  deriveCanonicalGoogleUid,
  resolveRequestUserId,
  signSessionToken,
  verifyGoogleIdToken,
  verifySessionToken,
} from '../src/server/authSession';
import { createStorageRouter } from '../src/server/routes/storageRoutes';
import type { GoogleUserSession } from '../src/types/polyglot';

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }), 'utf-8').toString('base64url');
  const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  return `${header}.${body}.forged_signature`;
}

async function runSuite(): Promise<void> {
  process.env.AUTH_SESSION_SECRET = 'test-zero-trust-secret-key-32-bytes-minimum';
  const prevGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id-12345.apps.googleusercontent.com';

  const app = express();
  app.use(express.json());
  app.use(createStorageRouter());

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    test('01. Forged/unsigned JWT sent to POST /api/auth/google is rejected with 401 (fail-closed)', async () => {
      const forgedJwt = buildUnsignedJwt({
        iss: 'https://accounts.google.com',
        sub: '1234567890',
        aud: process.env.GOOGLE_CLIENT_ID,
        email: 'victim@gmail.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const resp = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: forgedJwt }),
      });

      assert.strictEqual(resp.status, 401, 'Forged JWT must be rejected with HTTP 401');
      const data = (await resp.json()) as { error?: string };
      assert.ok(data.error && data.error.length > 0, 'Error message must be present');
      assert.strictEqual(resp.headers.get('set-cookie'), null, 'No session cookie may be set on failure');
    });

    test('02. Missing GOOGLE_CLIENT_ID fails closed with 401', async () => {
      const savedClientId = process.env.GOOGLE_CLIENT_ID;
      const savedViteClientId = process.env.VITE_GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.VITE_GOOGLE_CLIENT_ID;

      try {
        const result = await verifyGoogleIdToken('a.b.c');
        assert.strictEqual(result.ok, false);
        if (!result.ok) {
          assert.strictEqual(result.status, 401);
        }
      } finally {
        process.env.GOOGLE_CLIENT_ID = savedClientId;
        if (savedViteClientId !== undefined) {
          process.env.VITE_GOOGLE_CLIENT_ID = savedViteClientId;
        }
      }
    });

    test('03. Email-only bypass payload { email: "victim@gmail.com" } is rejected with 400 (strict schema)', async () => {
      const resp = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'victim@gmail.com' }),
      });

      assert.strictEqual(resp.status, 400, 'Email-only bypass must be rejected with HTTP 400');
      const data = (await resp.json()) as { error?: string };
      assert.ok(
        data.error?.includes('Campos não permitidos'),
        `Expected strict schema rejection, got: ${data.error}`
      );
    });

    test('04. Tampered session cookie signature is rejected deterministically', async () => {
      const user: GoogleUserSession = {
        uid: 'google_alice_gmail_com',
        name: 'Alice',
        email: 'alice@gmail.com',
        isGoogleAuthenticated: true,
      };
      const validToken = signSessionToken(user);
      const [payloadPart, sigPart] = validToken.split('.');
      const tamperedSig = `${sigPart.slice(0, -2)}XX`;
      const tamperedToken = `${payloadPart}.${tamperedSig}`;

      assert.strictEqual(verifySessionToken(tamperedToken), null, 'Tampered token must fail verification');

      const meResp = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${tamperedToken}` },
      });
      assert.strictEqual(meResp.status, 200);
      const meData = (await meResp.json()) as { authenticated: boolean; user: unknown };
      assert.strictEqual(meData.authenticated, false);
      assert.strictEqual(meData.user, null);

      const chunksResp = await fetch(`${baseUrl}/api/chunks`, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${tamperedToken}`,
          'X-User-Id': 'google_alice_gmail_com',
        },
      });
      assert.strictEqual(chunksResp.status, 401, 'Tampered cookie + google_* header must return 401');
    });

    test('05. Spoofed X-User-Id: google_victim_gmail_com without valid cookie is rejected with 401', async () => {
      for (const endpoint of ['/api/chunks', '/api/conversations', '/api/flashcards']) {
        const resp = await fetch(`${baseUrl}${endpoint}`, {
          headers: { 'X-User-Id': 'google_victim_gmail_com' },
        });
        assert.strictEqual(resp.status, 401, `${endpoint} must reject spoofed google_* header with 401`);
        const body = (await resp.json()) as { error?: string };
        assert.strictEqual(body.error, 'Sessão Google autenticada obrigatória.');
      }
    });

    test('06. Valid signed session cookie overrides spoofed X-User-Id header and resolves to signed user', async () => {
      const signedUser: GoogleUserSession = {
        uid: 'google_verified_owner_gmail_com',
        name: 'Verified Owner',
        email: 'verified.owner@gmail.com',
        isGoogleAuthenticated: true,
      };
      const token = signSessionToken(signedUser);

      const resolved = resolveRequestUserId({
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
          'x-user-id': 'google_attacker_spoofed_id',
        },
      });
      assert.strictEqual(resolved.ok, true);
      if (resolved.ok) {
        assert.strictEqual(resolved.userId, signedUser.uid);
        assert.strictEqual(resolved.isAuthenticated, true);
      }

      const meResp = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${token}`,
          'X-User-Id': 'google_attacker_spoofed_id',
        },
      });
      assert.strictEqual(meResp.status, 200);
      const meData = (await meResp.json()) as { authenticated: boolean; user?: GoogleUserSession };
      assert.strictEqual(meData.authenticated, true);
      assert.strictEqual(meData.user?.uid, signedUser.uid);

      const logoutResp = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
      assert.strictEqual(logoutResp.status, 200);
      const setCookie = logoutResp.headers.get('set-cookie') || '';
      assert.ok(setCookie.includes(`${SESSION_COOKIE_NAME}=`), 'Logout must clear session cookie');
      assert.ok(setCookie.includes('Max-Age=0'), 'Logout cookie must set Max-Age=0');
    });

    test('07. Valid isolated guest usr_test123 works cleanly and canonical UID fallback works', async () => {
      const resolved = resolveRequestUserId({
        headers: { 'x-user-id': 'usr_test123' },
      });
      assert.strictEqual(resolved.ok, true);
      if (resolved.ok) {
        assert.strictEqual(resolved.userId, 'usr_test123');
        assert.strictEqual(resolved.isAuthenticated, false);
      }

      const resp = await fetch(`${baseUrl}/api/chunks`, {
        headers: { 'X-User-Id': 'usr_test123' },
      });
      assert.strictEqual(resp.status, 200, 'Isolated guest usr_test123 must be allowed on /api/chunks');
      const data = (await resp.json()) as { success?: boolean; chunks?: unknown[] };
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.chunks));

      assert.strictEqual(
        deriveCanonicalGoogleUid({ sub: '999', email: 'User.Name@Gmail.com', emailVerified: true }),
        'google_user_name_gmail_com'
      );
      assert.strictEqual(
        deriveCanonicalGoogleUid({ sub: 'sub-999', email: 'unverified@gmail.com', emailVerified: false }),
        'google_sub-999'
      );
    });

    let passed = 0;
    for (const item of tests) {
      await item.fn();
      passed += 1;
      console.log(`PASS: ${item.name}`);
    }
    console.log(`\nZero-Trust Auth Suite: ${passed}/${tests.length} passed.`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = prevGoogleClientId;
    }
  }
}

runSuite().catch((err: unknown) => {
  console.error('Zero-Trust Auth Suite FAILED:', err);
  process.exit(1);
});
