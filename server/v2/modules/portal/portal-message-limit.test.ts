import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The one shared writes router is mounted under BOTH /api/v2/portal and the legacy /api/portal. A customer message over
// the cap must be refused with a plain 400 on both, before it reaches the service, whatever the express body limit is.

vi.mock('./portal-auth.service', () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock('./portal-webauthn.service', () => ({ portalWebauthnService: {}, BIOMETRIC_LOGIN_FAILED: 'x', REGISTRATION_FAILED: 'y' }));
vi.mock('./portal-deals.service', () => ({ portalDealsService: {} }));
vi.mock('./portal-bookings.service', () => ({ portalBookingsService: {} }));
vi.mock('./portal.service', () => ({ portalService: { sendMessage: vi.fn(async () => undefined), submitQuoteRequest: vi.fn(async () => undefined) } }));

import { portalAuthService } from './portal-auth.service';
import { portalService } from './portal.service';
import { portalWritesRouter } from './portal-writes.routes';

let server: Server;
let base: string;

beforeAll(() => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v2/portal', portalWritesRouter);
  app.use('/api/portal', portalWritesRouter);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.mocked(portalService.sendMessage).mockClear();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: 'c1', email: 'a@b.com' });
});

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: string } };
}

describe.each(['/api/portal/message', '/api/v2/portal/message'])('POST %s', (path) => {
  it('refuses an over-long message with a plain 400 and never reaches the service', async () => {
    const r = await post(path, { text: 'x'.repeat(80_000) });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'That message is too long. Please keep it under 5,000 characters.' });
    expect(portalService.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses a message of exactly 5001 characters and accepts one of 5000', async () => {
    expect((await post(path, { text: 'x'.repeat(5001) })).status).toBe(400);
    expect((await post(path, { text: 'x'.repeat(5000) })).status).toBe(200);
    expect(portalService.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('refuses a blank or missing message', async () => {
    expect((await post(path, { text: '   ' })).body).toEqual({ error: 'Message text required' });
    expect((await post(path, {})).status).toBe(400);
  });
});

describe.each(['/api/portal/quote-request', '/api/v2/portal/quote-request'])('POST %s', (path) => {
  it('refuses an over-long field with a plain 400', async () => {
    const r = await post(path, { destination: 'x'.repeat(100_000) });
    expect(r.status).toBe(400);
    expect(portalService.submitQuoteRequest).not.toHaveBeenCalled();
  });
});
