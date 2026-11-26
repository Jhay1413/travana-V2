import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({ db: {} }));
vi.mock('../client-passenger/client-passenger.repository', () => ({ clientPassengerRepository: { findByClient: vi.fn(), findOne: vi.fn() } }));
vi.mock('../neon-client/neon-client.service', () => ({ neonClientService: {} }));
vi.mock('../notification/notification.repository', () => ({ notificationRepository: { create: vi.fn() } }));
vi.mock('./portal-bookings.service', () => ({ portalBookingsService: { listBookings: vi.fn() } }));
vi.mock('./portal-passports.repository', () => ({
  portalPassportsRepository: {
    findClientIdentity: vi.fn(),
    insertPassenger: vi.fn(),
    updatePassenger: vi.fn(),
    upsertLeadPassport: vi.fn(),
    findAgent: vi.fn(),
  },
}));

import type { ClientPassengerRow } from '@shared/schema';
import { AppError } from '../../utils/error-handler';
import { clientPassengerRepository as staffRepo } from '../client-passenger/client-passenger.repository';
import { notificationRepository } from '../notification/notification.repository';
import { portalBookingsService } from './portal-bookings.service';
import { portalPassportsRepository as repo } from './portal-passports.repository';
import { PASSPORTS_UNAVAILABLE, isNonUkNumber, portalPassportsService as service } from './portal-passports.service';
import type { PortalPassportBody } from './portal-passports.validator';

const NOW = new Date('2026-11-26T12:00:00Z');
const FULL_NUMBER = '123456789';
const KEYS = ['check', 'dateOfBirth', 'firstName', 'hasPassport', 'id', 'isLead', 'nationality', 'passportExpiry', 'passportIssueDate', 'passportLast4', 'sex', 'surname'];

function row(over: Partial<ClientPassengerRow> = {}): ClientPassengerRow {
  return {
    id: 'p1', clientId: 'c1', isLead: false, title: null, firstName: 'Tom', surname: 'Smith', dateOfBirth: '2010-01-01',
    passportNumber: FULL_NUMBER, passportExpiry: '2032-01-01', passportNonUk: false, nationality: 'British', sex: 'M',
    passportIssueDate: '2022-01-01', createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

function trip(departure = '2027-08-01') {
  return [{ id: 'b1', destination: 'Majorca', travel_date: departure, return_date: '2027-08-08' }] as never;
}

const body: PortalPassportBody = {
  firstName: 'Jane Anne', surname: 'Smith', dateOfBirth: '1985-03-14', nationality: 'British Citizen', sex: 'F',
  passportNumber: 'ab1234567', passportIssueDate: '2020-05-01', passportExpiry: '2030-05-01',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.mocked(repo.findClientIdentity).mockResolvedValue({ firstName: 'Ada', surname: 'Lovelace', dateOfBirth: '1980-12-10' });
  vi.mocked(staffRepo.findByClient).mockResolvedValue([]);
  vi.mocked(portalBookingsService.listBookings).mockResolvedValue([]);
  vi.mocked(repo.findAgent).mockResolvedValue({ userId: 'u1', firstName: 'Sam' });
});

describe('list', () => {
  it('always lists the customer first, even with no saved rows, addressed as "lead"', async () => {
    const [lead, ...others] = await service.list('c1', NOW);
    expect(others).toEqual([]);
    expect(lead).toMatchObject({ id: 'lead', isLead: true, firstName: 'Ada', surname: 'Lovelace', dateOfBirth: '1980-12-10', hasPassport: false, passportLast4: null });
    expect(lead?.check).toEqual({ status: 'missing', text: 'Add a passport so it is ready when you book.' });
  });

  it('gives exactly the agreed keys and only the last four characters of the number', async () => {
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ id: 'l1', isLead: true, firstName: '', surname: '' }), row()]);
    const list = await service.list('c1', NOW);
    expect(list).toHaveLength(2);
    for (const p of list) {
      expect(Object.keys(p).sort()).toEqual(KEYS);
      expect(Object.keys(p).some((k) => k.toLowerCase().includes('passportnumber'))).toBe(false);
      expect(p.passportLast4).toBe('6789');
      expect(p.hasPassport).toBe(true);
    }
    expect(JSON.stringify(list)).not.toContain(FULL_NUMBER);
    expect(list[0]).toMatchObject({ id: 'l1', isLead: true, firstName: 'Ada' });
    expect(list[1]).toMatchObject({ id: 'p1', isLead: false, firstName: 'Tom', nationality: 'British', sex: 'M' });
  });

  it('a stored sex outside M/F/X is not passed on', async () => {
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ sex: 'Q' })]);
    expect((await service.list('c1', NOW))[1]?.sex).toBeNull();
  });

  it('is a 404 when the customer record is gone', async () => {
    vi.mocked(repo.findClientIdentity).mockResolvedValue(null);
    await expect(service.list('c1', NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('the check sentence (staff six-month rule against the next live booking)', () => {
    it('ok: valid for the trip', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue(trip());
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: '2028-02-02' })]);
      expect((await service.list('c1', NOW))[1]?.check).toEqual({ status: 'ok', text: 'Valid for your trip to Majorca on 1 August 2027.' });
    });

    it('warning at exactly six months is still a warning (the staff rule is "six months or less")', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue(trip());
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: '2028-02-01' })]);
      expect((await service.list('c1', NOW))[1]?.check).toEqual({
        status: 'warning',
        text: 'This passport has less than 6 months left when you travel on 1 August 2027. Sam will be in touch.',
      });
    });

    it('warning: expires before travel, naming the agent', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue(trip());
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: '2027-03-01' })]);
      expect((await service.list('c1', NOW))[1]?.check).toEqual({
        status: 'warning',
        text: 'This passport expires before you travel on 1 August 2027. Sam will be in touch.',
      });
      expect(repo.findAgent).toHaveBeenCalledWith('c1', 'b1');
    });

    it('warning without an agent name says "Your agent"', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue(trip());
      vi.mocked(repo.findAgent).mockResolvedValue(null);
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: '2027-03-01' })]);
      expect((await service.list('c1', NOW))[1]?.check.text).toBe('This passport expires before you travel on 1 August 2027. Your agent will be in touch.');
    });

    it('missing with a trip names the trip', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue(trip());
      expect((await service.list('c1', NOW))[0]?.check).toEqual({ status: 'missing', text: 'Add a passport for your trip to Majorca on 1 August 2027.' });
    });

    it('a number without an expiry is "missing" (nothing to check)', async () => {
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: null })]);
      expect((await service.list('c1', NOW))[1]?.check.status).toBe('missing');
    });

    it('no upcoming booking: measured from today', async () => {
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ passportExpiry: '2027-02-01' }), row({ id: 'p2', passportExpiry: '2032-01-01' }), row({ id: 'p3', passportExpiry: '2026-01-01' })]);
      const [, soon, fine, expired] = await service.list('c1', NOW);
      expect(soon?.check).toEqual({ status: 'warning', text: 'This passport has less than 6 months left (it expires on 1 February 2027). Sam will be in touch.' });
      expect(fine?.check).toEqual({ status: 'ok', text: 'Valid until 1 January 2032.' });
      expect(expired?.check.text).toBe('This passport expired on 1 January 2026. Sam will be in touch.');
      expect(repo.findAgent).toHaveBeenCalledWith('c1', null);
    });

    it('a booking that has already finished is not "the next trip"', async () => {
      vi.mocked(portalBookingsService.listBookings).mockResolvedValue([{ id: 'b0', destination: 'Rome', travel_date: '2026-05-01', return_date: '2026-05-08' }] as never);
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row()]);
      expect((await service.list('c1', NOW))[1]?.check.text).toBe('Valid until 1 January 2032.');
    });

    it('does not look up the agent when nothing warns', async () => {
      vi.mocked(staffRepo.findByClient).mockResolvedValue([row()]);
      await service.list('c1', NOW);
      expect(repo.findAgent).not.toHaveBeenCalled();
    });
  });
});

describe('savePassport', () => {
  beforeEach(() => {
    vi.mocked(staffRepo.findOne).mockResolvedValue(row());
    vi.mocked(repo.updatePassenger).mockResolvedValue(row());
    vi.mocked(repo.upsertLeadPassport).mockResolvedValue(row({ id: 'l1', isLead: true }));
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row()]);
  });

  it("another customer's (or a missing) passenger is a 404 and nothing is written or notified", async () => {
    vi.mocked(staffRepo.findOne).mockResolvedValue(null);
    await expect(service.savePassport('c1', '3f6c9a52-1d2b-4e8f-9a41-0b7c5d6e8f10', body)).rejects.toMatchObject({ statusCode: 404, message: 'Passenger not found' });
    expect(staffRepo.findOne).toHaveBeenCalledWith('c1', '3f6c9a52-1d2b-4e8f-9a41-0b7c5d6e8f10');
    expect(repo.updatePassenger).not.toHaveBeenCalled();
    expect(repo.upsertLeadPassport).not.toHaveBeenCalled();
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('a row that disappears between the check and the write is also a 404', async () => {
    vi.mocked(repo.updatePassenger).mockResolvedValue(null);
    await expect(service.savePassport('c1', 'p1', body)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('writes the normalised details to the passenger and returns the portal shape (never the full number)', async () => {
    const saved = await service.savePassport('c1', 'p1', body);
    expect(repo.updatePassenger).toHaveBeenCalledWith('c1', 'p1', {
      firstName: 'Jane Anne', surname: 'Smith', dateOfBirth: '1985-03-14', passportNumber: 'AB1234567', passportExpiry: '2030-05-01',
      passportNonUk: true, nationality: 'British Citizen', sex: 'F', passportIssueDate: '2020-05-01',
    });
    expect(Object.keys(saved).sort()).toEqual(KEYS);
    expect(JSON.stringify(saved)).not.toContain(FULL_NUMBER);
  });

  it('a nine-digit number is a UK-style number; anything else is flagged non-UK for the staff rules', () => {
    expect(isNonUkNumber('123456789')).toBe(false);
    expect(isNonUkNumber('AB1234567')).toBe(true);
    expect(isNonUkNumber('1234567890')).toBe(true);
  });

  it('blank optional details are stored as null', async () => {
    await service.savePassport('c1', 'p1', { ...body, nationality: '', sex: null, passportIssueDate: undefined });
    expect(repo.updatePassenger).toHaveBeenCalledWith('c1', 'p1', expect.objectContaining({ nationality: null, sex: null, passportIssueDate: null }));
  });

  it('"lead" writes passport details only: the lead name and date of birth stay on the client record', async () => {
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ id: 'l1', isLead: true })]);
    await service.savePassport('c1', 'lead', body);
    const written = vi.mocked(repo.upsertLeadPassport).mock.calls[0]?.[1];
    expect(written).toEqual({ passportNumber: 'AB1234567', passportExpiry: '2030-05-01', passportNonUk: true, nationality: 'British Citizen', sex: 'F', passportIssueDate: '2020-05-01' });
    expect(written).not.toHaveProperty('firstName');
    expect(written).not.toHaveProperty('dateOfBirth');
    expect(staffRepo.findOne).not.toHaveBeenCalled();
    expect(repo.updatePassenger).not.toHaveBeenCalled();
  });

  it("the lead row's own id also goes to the lead write, not the non-lead update", async () => {
    vi.mocked(staffRepo.findOne).mockResolvedValue(row({ id: 'l1', isLead: true }));
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ id: 'l1', isLead: true })]);
    await service.savePassport('c1', 'l1', body);
    expect(repo.upsertLeadPassport).toHaveBeenCalledTimes(1);
    expect(repo.updatePassenger).not.toHaveBeenCalled();
  });

  it('tells the agent, with no passport number in the message', async () => {
    await service.savePassport('c1', 'p1', body);
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    const n = vi.mocked(notificationRepository.create).mock.calls[0]?.[0];
    expect(n).toMatchObject({ userId: 'u1', type: 'portal_passport_updated', title: 'Passport details updated', link: '/clients/c1', read: false });
    expect(JSON.stringify(n)).not.toMatch(/AB1234567|1234567/);
  });

  it('a failing notification never fails the save', async () => {
    vi.mocked(notificationRepository.create).mockRejectedValue(new Error('db'));
    await expect(service.savePassport('c1', 'p1', body)).resolves.toBeDefined();
  });

  it('no agent to tell is fine', async () => {
    vi.mocked(repo.findAgent).mockResolvedValue(null);
    await expect(service.savePassport('c1', 'p1', body)).resolves.toBeDefined();
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('before the schema is pushed (Postgres 42703) it is a clean 503, not a crash', async () => {
    vi.mocked(repo.updatePassenger).mockRejectedValue(Object.assign(new Error('column "nationality" does not exist'), { code: '42703' }));
    await expect(service.savePassport('c1', 'p1', body)).rejects.toMatchObject({ statusCode: 503, message: PASSPORTS_UNAVAILABLE, code: 'PASSPORTS_UNAVAILABLE' });
  });

  it('other database errors are not disguised', async () => {
    vi.mocked(repo.updatePassenger).mockRejectedValue(new Error('boom'));
    await expect(service.savePassport('c1', 'p1', body)).rejects.not.toBeInstanceOf(AppError);
  });
});

describe('createPassenger', () => {
  it('adds a non-lead passenger for this customer and returns the portal shape', async () => {
    vi.mocked(repo.insertPassenger).mockResolvedValue(row({ id: 'p9', firstName: 'Jane Anne', passportNumber: 'AB1234567' }));
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ id: 'p9', firstName: 'Jane Anne', passportNumber: 'AB1234567' })]);
    const created = await service.createPassenger('c1', body);
    expect(repo.insertPassenger).toHaveBeenCalledWith('c1', expect.objectContaining({ passportNumber: 'AB1234567', firstName: 'Jane Anne' }));
    expect(repo.upsertLeadPassport).not.toHaveBeenCalled();
    expect(created).toMatchObject({ id: 'p9', isLead: false, passportLast4: '4567' });
    expect(JSON.stringify(created)).not.toContain('AB1234567');
  });

  it('a customer with no saved rows still sees themself as the lead next to the new passenger', async () => {
    vi.mocked(repo.insertPassenger).mockResolvedValue(row({ id: 'p9' }));
    vi.mocked(staffRepo.findByClient).mockResolvedValue([row({ id: 'p9' })]);
    const list = await service.list('c1', NOW);
    expect(list.map((p) => [p.id, p.isLead])).toEqual([['lead', true], ['p9', false]]);
  });

  it('is a clean 503 before the schema is pushed', async () => {
    vi.mocked(repo.insertPassenger).mockRejectedValue(Object.assign(new Error('x'), { cause: { code: '42703' } }));
    await expect(service.createPassenger('c1', body)).rejects.toMatchObject({ statusCode: 503 });
  });
});
