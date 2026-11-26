import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The customer portal returns credentials and personal data (session tokens, passport details, signed document
// links, bank details, chat). The global request logger (createRequestLogger, the very middleware server/index.ts
// mounts) prints the first 500 characters of any JSON answer unless the response is marked `skipResponseLog`.
// These tests run the REAL portal routers behind that REAL logger and prove no portal body reaches it.

const SECRET = 'SECRET-VALUE-MUST-NOT-BE-LOGGED';

vi.mock('../../config/database', () => ({ db: {} }));
vi.mock('../../utils/ai-model', () => ({ CHAT_MODEL: 'm', getOpenAI: vi.fn() }));
vi.mock('../usage/usage.service', () => ({ usageService: {} }));
vi.mock('./portal-pin-reset.repository', () => ({ portalPinResetRepository: {} }));
vi.mock('./portal-auth.service', () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock('./portal-webauthn.service', () => ({ portalWebauthnService: {} }));
vi.mock('./portal-deals.service', () => ({ portalDealsService: {} }));
vi.mock('./portal-bookings.service', () => ({ portalBookingsService: {} }));
vi.mock('./portal.service', () => ({ portalService: {} }));
vi.mock('./portal-booking-detail.controller', () => ({ portalBookingDetailController: { detail: (_q: unknown, r: { json: (b: unknown) => void }) => r.json({ secret: 'SECRET-VALUE-MUST-NOT-BE-LOGGED' }) } }));

// Every controller answers with a body that contains the secret; the logger must never print it.
const h = vi.hoisted(() => {
  const leak = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ token: 'SECRET-VALUE-MUST-NOT-BE-LOGGED', url: 'https://signed.example/SECRET-VALUE-MUST-NOT-BE-LOGGED' });
  return { leakingController: () => new Proxy({}, { get: () => leak }) };
});
vi.mock('./portal.controller', () => ({ portalController: h.leakingController() }));
vi.mock('./portal-quotes.controller', () => ({ portalQuotesController: h.leakingController() }));
vi.mock('./portal-summary.controller', () => ({ portalSummaryController: h.leakingController() }));
vi.mock('./portal-branding.controller', () => ({ portalBrandingController: h.leakingController() }));
vi.mock('./portal-pin-reset.controller', () => ({ portalPinResetController: h.leakingController() }));
vi.mock('./portal-documents.controller', () => ({ portalDocumentsController: h.leakingController() }));
vi.mock('./portal-passports.service', () => ({
  portalPassportsService: { list: vi.fn(async () => [{ passportLast4: '4567', surname: 'SECRET-VALUE-MUST-NOT-BE-LOGGED' }]), savePassport: vi.fn(), createPassenger: vi.fn() },
}));
vi.mock('./portal-passport-read.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./portal-passport-read.service')>();
  return { ...actual, portalPassportReadService: { read: vi.fn(async () => ({ passportNumber: 'SECRET-VALUE-MUST-NOT-BE-LOGGED', surname: 'Smith' })) } };
});

import { noResponseLog } from '../../middlewares/no-response-log';
import { createRequestLogger } from '../../middlewares/request-log';
import { portalAuthService } from './portal-auth.service';
import { portalCoreRouter } from './portal-core.routes';
import { portalPassportsRouter } from './portal-passports.routes';
import { portalQuotesRouter } from './portal-quotes.routes';
import portalRouter from './portal.routes';

const ID = '3f6c9a52-1d2b-4e8f-9a41-0b7c5d6e8f10';
const lines: string[] = [];
let server: Server;
let base: string;

beforeAll(() => {
  const app = express();
  app.use(createRequestLogger((line) => lines.push(line)));
  app.use(express.json());
  app.use('/api/v2/portal', portalRouter);
  // The legacy alias mounts the same core and quotes routers under /api/portal.
  app.use('/api/portal', portalCoreRouter);
  app.use('/api/portal', portalQuotesRouter);
  // Control: a route that is NOT marked still gets its body logged, so the tests prove the logger really would print.
  app.get('/api/unmarked', (_req, res) => res.json({ token: SECRET }));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  lines.length = 0;
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: 'c1', email: 'a@b.com' });
});

const auth = { Authorization: 'Bearer t', 'Content-Type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = auth) {
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  await res.text();
  await new Promise((r) => setTimeout(r, 15));
  return res.status;
}

function upload() {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: 'image/jpeg' }), 'p.jpg');
  return fetch(`${base}/api/v2/portal/passports/read`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: form }).then(async (r) => {
    await r.text();
    await new Promise((x) => setTimeout(x, 15));
    return r.status;
  });
}

describe('the logger really does print an unmarked JSON body (control)', () => {
  it('logs the body of a route that is not marked', async () => {
    await call('GET', '/api/unmarked');
    expect(lines.join('\n')).toContain(SECRET);
  });
});

describe('no portal response body ever reaches the request log', () => {
  const cases: Array<[string, string, string, unknown?]> = [
    ['sign-in (session token)', 'POST', '/api/v2/portal/login', { email: 'a@b.com', pin: '1234' }],
    ['sign-in on the legacy /api/portal alias', 'POST', '/api/portal/login', { email: 'a@b.com', pin: '1234' }],
    ['magic-link sign-in', 'POST', '/api/v2/portal/magic-login', { code: 'abcdefghijklmnop' }],
    ['passenger list', 'GET', '/api/v2/portal/passengers'],
    ['document download (signed URL)', 'GET', `/api/v2/portal/documents/${ID}/download`],
    ['document list', 'GET', '/api/v2/portal/documents'],
    ['summary', 'GET', '/api/v2/portal/summary'],
    ['quotes list (core/quotes alias)', 'GET', '/api/portal/quotes'],
    ['quotes list (v2)', 'GET', '/api/v2/portal/quotes'],
    ['bookings', 'GET', '/api/v2/portal/bookings'],
    ['bookings on the alias', 'GET', '/api/portal/bookings'],
    ['wallet', 'GET', '/api/v2/portal/wallet/balance'],
    ['messages', 'GET', '/api/v2/portal/messages'],
    ['branding', 'GET', '/api/v2/portal/branding'],
  ];

  it.each(cases)('%s', async (_name, method, path, body) => {
    const status = await call(method, path, body);
    expect(status).toBeLessThan(500);
    expect(lines.some((l) => l.includes(path.replace(/\?.*/, '')))).toBe(true);
    expect(lines.join('\n')).not.toContain(SECRET);
    expect(lines.join('\n')).not.toContain('signed.example');
  });

  it('the passport photo read result (full passport number, names, dates)', async () => {
    expect(await upload()).toBe(200);
    expect(lines.some((l) => l.includes('/api/v2/portal/passports/read'))).toBe(true);
    expect(lines.join('\n')).not.toContain(SECRET);
    expect(lines.join('\n')).not.toContain('Smith');
  });

  it('only the method, path, status and duration are logged for a portal call', async () => {
    await call('POST', '/api/v2/portal/login', { email: 'a@b.com', pin: '1234' });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^POST \/api\/v2\/portal\/login \d{3} in \d+ms$/);
  });

  it('the request body (a PIN, a passport number) is never in the log line either', async () => {
    await call('PUT', `/api/v2/portal/passengers/${ID}/passport`, { passportNumber: 'AB1234567', pin: '987654' });
    expect(lines.join('\n')).not.toMatch(/AB1234567|987654/);
  });
});

describe('res.locals.skipResponseLog is set on every portal entry point', () => {
  async function flag(mount: (app: express.Express) => void, path: string): Promise<unknown> {
    const app = express();
    app.use(express.json());
    let seen: unknown = 'route not reached';
    app.use((_req, res, next) => {
      res.on('finish', () => undefined);
      const done = res.json.bind(res);
      res.json = (b: unknown) => {
        seen = res.locals.skipResponseLog;
        return done(b);
      };
      next();
    });
    mount(app);
    const s = app.listen(0);
    try {
      const port = (s.address() as AddressInfo).port;
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'GET', headers: { Authorization: 'Bearer t' } });
      await r.text();
    } finally {
      s.close();
    }
    return seen;
  }

  it.each([
    ['the v2 portal router', (app: express.Express) => app.use('/p', portalRouter), '/p/summary'],
    ['the core router on its own (legacy alias)', (app: express.Express) => app.use('/p', portalCoreRouter), '/p/bookings'],
    ['the quotes router on its own (legacy alias)', (app: express.Express) => app.use('/p', portalQuotesRouter), '/p/quotes'],
    ['the passports router on its own', (app: express.Express) => app.use('/p', portalPassportsRouter), '/p/passengers'],
  ])('%s', async (_name, mount, path) => {
    expect(await flag(mount, path)).toBe(true);
  });

  it('the shared middleware itself sets the flag', () => {
    const res = { locals: {} as Record<string, unknown> };
    const next = vi.fn();
    noResponseLog({} as express.Request, res as unknown as express.Response, next);
    expect(res.locals.skipResponseLog).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});

describe('the legacy /api/portal router (server/routes/portal.routes.ts)', () => {
  // Importing it would pull in the whole legacy service layer, so this is a source-level check.
  const source = readFileSync(fileURLToPath(new URL('../../../routes/portal.routes.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

  it('marks every response before any route (its own handlers and both aliased v2 routers)', () => {
    const mark = source.indexOf('portalRouter.use(noResponseLog);');
    expect(mark).toBeGreaterThan(-1);
    expect(source).toContain('import { noResponseLog } from "../v2/middlewares/no-response-log";');
    for (const later of ['portalRouter.use(portalCoreRouter);', 'portalRouter.use(portalQuotesRouter);', 'portalRouter.use(portalWritesRouter);', 'portalRouter.get("/vip"']) {
      expect(source.indexOf(later)).toBeGreaterThan(mark);
    }
  });
});

describe('server/index.ts', () => {
  const index = readFileSync(fileURLToPath(new URL('../../../index.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

  it('uses the shared request logger and never logs a request body', () => {
    expect(index).toContain('app.use(createRequestLogger((line) => log(line)));');
    expect(index).not.toMatch(/log\([^)]*req\.body|JSON\.stringify\(req\.body/);
  });
});
