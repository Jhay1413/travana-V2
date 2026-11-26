import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({ db: {} }));
vi.mock('../../utils/ai-model', () => ({ CHAT_MODEL: 'm', getOpenAI: vi.fn() }));
vi.mock('../usage/usage.service', () => ({ usageService: {} }));
vi.mock('./portal-pin-reset.repository', () => ({ portalPinResetRepository: {} }));
vi.mock('./portal-auth.service', () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock('./portal-passports.service', () => ({
  portalPassportsService: { list: vi.fn(), savePassport: vi.fn(), createPassenger: vi.fn() },
}));
vi.mock('./portal-passport-read.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./portal-passport-read.service')>();
  return { ...actual, portalPassportReadService: { read: vi.fn() } };
});

import { AppError } from '../../utils/error-handler';
import { portalAuthService } from './portal-auth.service';
import { PASSPORT_NOT_AN_IMAGE_MESSAGE, PASSPORT_TOO_LARGE_MESSAGE, PASSPORT_UNREADABLE_MESSAGE, portalPassportReadService } from './portal-passport-read.service';
import { portalPassportsRouter } from './portal-passports.routes';
import { portalPassportsService } from './portal-passports.service';

const ID = '3f6c9a52-1d2b-4e8f-9a41-0b7c5d6e8f10';
const GOOD = {
  firstName: 'Jane Anne', surname: 'Smith', dateOfBirth: '1985-03-14', nationality: 'British Citizen', sex: 'F',
  passportNumber: 'AB1234567', passportIssueDate: '2020-05-01', passportExpiry: '2030-05-01',
};
const SAVED = { id: ID, isLead: false, firstName: 'Jane Anne', surname: 'Smith', passportLast4: '4567' };

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/portal', portalPassportsRouter);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2/portal`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: 'c1', email: 'a@b.com' });
});

const auth = { Authorization: 'Bearer t', 'Content-Type': 'application/json' };

async function send(method: string, path: string, body?: unknown, headers: Record<string, string> = auth) {
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
}

describe('GET /passengers', () => {
  it('returns the signed-in customer\'s list; nothing in the request can name another customer', async () => {
    vi.mocked(portalPassportsService.list).mockResolvedValue([SAVED] as never);
    const r = await send('GET', '/passengers?clientId=other');
    expect(r).toEqual({ status: 200, body: [SAVED] });
    expect(portalPassportsService.list).toHaveBeenCalledWith('c1');
  });

  it('401 {error} without a session, never reaching the service', async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError('Unauthorized', 401));
    expect(await send('GET', '/passengers', undefined, {})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(portalPassportsService.list).not.toHaveBeenCalled();
  });
});

describe('PUT /passengers/:id/passport', () => {
  it('200 with the saved passenger, for the session customer', async () => {
    vi.mocked(portalPassportsService.savePassport).mockResolvedValue(SAVED as never);
    const r = await send('PUT', `/passengers/${ID}/passport`, GOOD);
    expect(r).toEqual({ status: 200, body: SAVED });
    expect(portalPassportsService.savePassport).toHaveBeenCalledWith('c1', ID, GOOD);
  });

  it('accepts "lead" as the id', async () => {
    vi.mocked(portalPassportsService.savePassport).mockResolvedValue(SAVED as never);
    expect((await send('PUT', '/passengers/lead/passport', GOOD)).status).toBe(200);
    expect(portalPassportsService.savePassport).toHaveBeenCalledWith('c1', 'lead', GOOD);
  });

  it('400 {error} with the first plain message for an invalid body, before the service', async () => {
    const r = await send('PUT', `/passengers/${ID}/passport`, { ...GOOD, passportNumber: '12' });
    expect(r).toEqual({ status: 400, body: { error: 'Passport number must be 6 to 12 letters or digits' } });
    expect(portalPassportsService.savePassport).not.toHaveBeenCalled();
  });

  it('400 for an id that is not a uuid or "lead"', async () => {
    expect((await send('PUT', '/passengers/abc/passport', GOOD)).status).toBe(400);
  });

  it('404 {error} when the passenger is not this customer\'s', async () => {
    vi.mocked(portalPassportsService.savePassport).mockRejectedValue(new AppError('Passenger not found', 404));
    expect(await send('PUT', `/passengers/${ID}/passport`, GOOD)).toEqual({ status: 404, body: { error: 'Passenger not found' } });
  });

  it('503 with the code when saving is not available yet', async () => {
    vi.mocked(portalPassportsService.savePassport).mockRejectedValue(new AppError('later', 503, true, 'PASSPORTS_UNAVAILABLE'));
    expect(await send('PUT', `/passengers/${ID}/passport`, GOOD)).toEqual({ status: 503, body: { error: 'later', code: 'PASSPORTS_UNAVAILABLE' } });
  });

  it('there is no way to read a full number back or delete a passenger', async () => {
    expect((await send('GET', `/passengers/${ID}/passport`)).status).toBe(404);
    expect((await send('GET', `/passengers/${ID}`)).status).toBe(404);
    expect((await send('DELETE', `/passengers/${ID}`)).status).toBe(404);
  });
});

describe('POST /passengers', () => {
  it('201 with the new passenger', async () => {
    vi.mocked(portalPassportsService.createPassenger).mockResolvedValue(SAVED as never);
    expect(await send('POST', '/passengers', GOOD)).toEqual({ status: 201, body: SAVED });
    expect(portalPassportsService.createPassenger).toHaveBeenCalledWith('c1', GOOD);
  });

  it('400 for an invalid body', async () => {
    expect((await send('POST', '/passengers', { ...GOOD, surname: '' })).status).toBe(400);
    expect(portalPassportsService.createPassenger).not.toHaveBeenCalled();
  });
});

describe('POST /passports/read', () => {
  function upload(bytes: Buffer, field = 'photo', type = 'image/jpeg') {
    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(bytes)], { type }), 'p.jpg');
    return fetch(`${base}/passports/read`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: form });
  }

  it('hands the in-memory photo to the read service for the session customer and returns its fields', async () => {
    const fields = { surname: 'Smith', mrzVerified: false };
    vi.mocked(portalPassportReadService.read).mockResolvedValue(fields as never);
    const res = await upload(Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fields);
    const [clientId, photo] = vi.mocked(portalPassportReadService.read).mock.calls[0] ?? [];
    expect(clientId).toBe('c1');
    expect(Buffer.isBuffer(photo)).toBe(true);
    expect((photo as Buffer).length).toBe(6);
  });

  it('400 when there is no photo', async () => {
    const res = await fetch(`${base}/passports/read`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: new FormData() });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: PASSPORT_NOT_AN_IMAGE_MESSAGE });
  });

  it('400 when the photo is under the wrong field name (nothing is read)', async () => {
    const res = await upload(Buffer.from([0xff, 0xd8, 0xff]), 'file');
    expect(res.status).toBe(400);
    expect(portalPassportReadService.read).not.toHaveBeenCalled();
  });

  it('413 with a plain message when the photo is over 8 MB, before the service', async () => {
    const res = await upload(Buffer.alloc(8 * 1024 * 1024 + 10, 1));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: PASSPORT_TOO_LARGE_MESSAGE });
    expect(portalPassportReadService.read).not.toHaveBeenCalled();
  });

  it('401 without a session, before the upload is even parsed', async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError('Unauthorized', 401));
    const res = await upload(Buffer.from([0xff, 0xd8, 0xff]));
    expect(res.status).toBe(401);
    expect(portalPassportReadService.read).not.toHaveBeenCalled();
  });

  it('passes the service\'s 422, 429 and 503 straight through as {error, code}', async () => {
    vi.mocked(portalPassportReadService.read).mockRejectedValueOnce(new AppError(PASSPORT_UNREADABLE_MESSAGE, 422, true, 'UNREADABLE'));
    let res = await upload(Buffer.from([0xff, 0xd8, 0xff]));
    expect([res.status, await res.json()]).toEqual([422, { error: PASSPORT_UNREADABLE_MESSAGE, code: 'UNREADABLE' }]);

    vi.mocked(portalPassportReadService.read).mockRejectedValueOnce(new AppError('slow down', 429, true, 'RATE_LIMITED', { retryAfterSeconds: 30 }));
    res = await upload(Buffer.from([0xff, 0xd8, 0xff]));
    expect([res.status, await res.json()]).toEqual([429, { error: 'slow down', code: 'RATE_LIMITED', retryAfterSeconds: 30 }]);

    vi.mocked(portalPassportReadService.read).mockRejectedValueOnce(new AppError('unavailable', 503, true, 'UNAVAILABLE'));
    res = await upload(Buffer.from([0xff, 0xd8, 0xff]));
    expect([res.status, await res.json()]).toEqual([503, { error: 'unavailable', code: 'UNAVAILABLE' }]);
  });
});

describe('what reaches the service is the parsed, trimmed result (validate() alone passes the original body on)', () => {
  const PADDED = {
    firstName: '  Jane Anne  ', surname: ' Smith ', dateOfBirth: ' 1985-03-14 ', nationality: '  British  ', sex: ' F ',
    passportNumber: '  ab1234567 ', passportIssueDate: ' 2020-05-01 ', passportExpiry: ' 2030-05-01 ',
  };
  const TRIMMED = {
    firstName: 'Jane Anne', surname: 'Smith', dateOfBirth: '1985-03-14', nationality: 'British', sex: 'F',
    passportNumber: 'ab1234567', passportIssueDate: '2020-05-01', passportExpiry: '2030-05-01',
  };

  it('PUT passes trimmed strings and dates', async () => {
    vi.mocked(portalPassportsService.savePassport).mockResolvedValue(SAVED as never);
    expect((await send('PUT', `/passengers/${ID}/passport`, PADDED)).status).toBe(200);
    expect(portalPassportsService.savePassport).toHaveBeenCalledWith('c1', ID, TRIMMED);
  });

  it('POST passes trimmed strings and dates', async () => {
    vi.mocked(portalPassportsService.createPassenger).mockResolvedValue(SAVED as never);
    expect((await send('POST', '/passengers', PADDED)).status).toBe(201);
    expect(portalPassportsService.createPassenger).toHaveBeenCalledWith('c1', TRIMMED);
  });

  it('unknown keys in the body never reach the service', async () => {
    vi.mocked(portalPassportsService.createPassenger).mockResolvedValue(SAVED as never);
    await send('POST', '/passengers', { ...GOOD, isLead: true, clientId: 'other' });
    expect(portalPassportsService.createPassenger).toHaveBeenCalledWith('c1', GOOD);
  });
});

describe('POST /passports/read: abort signal', () => {
  it('gives the read service a signal that is not aborted while the answer is sent', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(portalPassportReadService.read).mockImplementation(async (_c, _p, s) => {
      signal = s;
      return { surname: 'Smith' } as never;
    });
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'p.jpg');
    const res = await fetch(`${base}/passports/read`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: form });
    expect(res.status).toBe(200);
    await res.json();
    await new Promise((r) => setTimeout(r, 20));
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);
  });

  it('aborts the signal when the customer disconnects before the answer', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(portalPassportReadService.read).mockImplementation((_c, _p, s) => {
      signal = s;
      return new Promise(() => undefined);
    });
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'p.jpg');
    const ctl = new AbortController();
    const pending = fetch(`${base}/passports/read`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: form, signal: ctl.signal }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    expect(signal?.aborted).toBe(false);
    ctl.abort();
    await pending;
    await new Promise((r) => setTimeout(r, 100));
    expect(signal?.aborted).toBe(true);
  });
});
