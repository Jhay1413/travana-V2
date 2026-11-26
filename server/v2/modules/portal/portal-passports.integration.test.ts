import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeBooking } from '../../test/factories';
import { clientPassengerRepository } from '../client-passenger/client-passenger.repository';
import { portalPassportsService } from './portal-passports.service';
import type { PortalPassportBody } from './portal-passports.validator';

// DB-backed: proves the REAL SQL keeps one customer's passengers away from another, that saved details round-trip,
// and that the full passport number is visible to staff data but never in what the portal returns. Written to run
// under `npm run test:integration` against the disposable test database (needs the passport columns pushed).

const FULL_NUMBER = 'AB1234567';
const ymd = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const body: PortalPassportBody = {
  firstName: 'Jane Anne',
  surname: 'Smith',
  dateOfBirth: '1985-03-14',
  nationality: 'British Citizen',
  sex: 'F',
  passportNumber: FULL_NUMBER.toLowerCase(),
  passportIssueDate: '2020-05-01',
  passportExpiry: '2032-05-01',
};

let orgId: string;
let agent: { id: string };
let a: { id: string };
let b: { id: string };

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: 'agency-passports' });
  orgId = org.id;
  agent = await makeUser({ orgId });
  a = await makeClient({ orgId, firstName: 'Ada', surename: 'Alpha' });
  b = await makeClient({ orgId, firstName: 'Ben', surename: 'Beta' });
});

describe('portal passengers (real database)', () => {
  it('saved details round-trip, upper-cased, and the portal only ever sees the last four characters', async () => {
    const created = await portalPassportsService.createPassenger(a.id, body);
    expect(created).toMatchObject({ isLead: false, firstName: 'Jane Anne', nationality: 'British Citizen', sex: 'F', passportLast4: '4567', passportIssueDate: '2020-05-01', passportExpiry: '2032-05-01', hasPassport: true });

    const list = await portalPassportsService.list(a.id);
    expect(list.map((p) => [p.isLead, p.firstName])).toEqual([[true, 'Ada'], [false, 'Jane Anne']]);
    expect(JSON.stringify(list)).not.toContain(FULL_NUMBER);
  });

  it('staff data holds the full number, upper-cased, with the three new details', async () => {
    await portalPassportsService.createPassenger(a.id, body);
    const rows = await clientPassengerRepository.findByClient(a.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ passportNumber: FULL_NUMBER, nationality: 'British Citizen', sex: 'F', passportIssueDate: '2020-05-01', passportNonUk: true });
  });

  it('the customer is the lead: saving "lead" creates the one lead row and keeps the client record as the identity', async () => {
    const saved = await portalPassportsService.savePassport(a.id, 'lead', { ...body, firstName: 'Someone', surname: 'Else' });
    expect(saved).toMatchObject({ isLead: true, firstName: 'Ada', surname: 'Alpha', passportLast4: '4567' });
    await portalPassportsService.savePassport(a.id, 'lead', body);
    expect((await clientPassengerRepository.findByClient(a.id)).filter((r) => r.isLead)).toHaveLength(1);
  });

  it("customer A cannot write to customer B's passenger (404, nothing changes)", async () => {
    const theirs = await portalPassportsService.createPassenger(b.id, body);
    await expect(portalPassportsService.savePassport(a.id, theirs.id, { ...body, passportNumber: 'ZZ9999999' })).rejects.toMatchObject({ statusCode: 404 });
    const stored = await clientPassengerRepository.findOne(b.id, theirs.id);
    expect(stored?.passportNumber).toBe(FULL_NUMBER);
  });

  it("customer A cannot see customer B's passengers", async () => {
    await portalPassportsService.createPassenger(b.id, { ...body, firstName: 'Secretname' });
    const list = await portalPassportsService.list(a.id);
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('Secretname');
  });

  it("customer A cannot overwrite B's lead row through B's lead row id", async () => {
    const lead = await portalPassportsService.savePassport(b.id, 'lead', body);
    await expect(portalPassportsService.savePassport(a.id, lead.id, { ...body, passportNumber: 'ZZ9999999' })).rejects.toMatchObject({ statusCode: 404 });
    expect((await clientPassengerRepository.findLead(b.id))?.passportNumber).toBe(FULL_NUMBER);
  });

  it('the check is measured against the next live booking', async () => {
    const txn = await makeTransaction({ user_id: agent.id, org_id: orgId, client_id: a.id, status: 'booked' });
    await makeBooking({ transaction_id: txn.id, title: 'Majorca trip', travel_date: ymd(90), num_of_nights: 7, adult: 2, booking_status: 'BOOKED' });
    await portalPassportsService.createPassenger(a.id, { ...body, passportExpiry: ymd(30), passportIssueDate: '2020-05-01' });
    const [, passenger] = await portalPassportsService.list(a.id);
    expect(passenger?.check.status).toBe('warning');
    expect(passenger?.check.text).toContain('expires before you travel');
  });
});
