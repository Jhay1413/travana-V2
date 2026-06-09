import { opportunitiesRepository, type OpportunityFilters } from './opportunities.repository';
import type { Scope } from '../../utils/scope';

function formatClientName(title: string | null, firstName: string | null, surname: string | null): string {
  return [title !== 'NULL' ? title : '', firstName, surname].filter(Boolean).join(' ') || 'Unknown';
}

// Price the customer actually pays: sales price − discount + service charge.
// Mirrors the quote/booking detail page so list and detail totals agree.
function netTotalPrice(salesPrice: unknown, discounts: unknown, serviceCharge: unknown): number {
  const sales = parseFloat(salesPrice as string) || 0;
  const disc = parseFloat(discounts as string) || 0;
  const svc = parseFloat(serviceCharge as string) || 0;
  return sales - disc + svc;
}

export const opportunitiesService = {
  async getEnquiries(filters: OpportunityFilters) {
    const { rows, total } = await opportunitiesRepository.findEnquiries(filters);
    const items = rows.map((r) => ({
      id: r.id, transactionId: r.transactionId, clientId: r.clientId,
      clientName: formatClientName(r.clientTitle, r.clientFirstName, r.clientSurname),
      clientPhone: r.clientPhone || '', agentName: r.agentFirstName || r.agentName || '',
      title: r.title || 'Untitled', status: r.status || 'NEW_LEAD',
      travelDate: r.travelDate, dateCreated: r.dateCreated,
      adults: r.adults || 0, children: r.children || 0, budget: parseFloat(r.budget as string) || 0, nights: r.nights || 0,
    }));
    return { items, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getQuotes(filters: OpportunityFilters) {
    const { rows, total } = await opportunitiesRepository.findQuotes(filters);
    const items = rows.map((r) => ({
      id: r.id, transactionId: r.transactionId, clientId: r.clientId,
      clientName: formatClientName(r.clientTitle, r.clientFirstName, r.clientSurname),
      clientPhone: r.clientPhone || '', agentName: r.agentFirstName || r.agentName || '',
      title: r.title || 'Untitled', status: r.status || 'DRAFT',
      travelDate: r.travelDate, dateCreated: r.dateCreated,
      salesPrice: parseFloat(r.salesPrice as string) || 0,
      totalPrice: netTotalPrice(r.salesPrice, r.discounts, r.serviceCharge),
      commission: parseFloat(r.commission as string) || 0,
      nights: r.nights || 0, adults: r.adults || 0, children: r.children || 0,
    }));
    return { items, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getBookings(filters: OpportunityFilters) {
    const { rows, total } = await opportunitiesRepository.findBookings(filters);
    const items = rows.map((r) => ({
      id: r.id, transactionId: r.transactionId, clientId: r.clientId,
      clientName: formatClientName(r.clientTitle, r.clientFirstName, r.clientSurname),
      clientPhone: r.clientPhone || '', agentName: r.agentFirstName || r.agentName || '',
      title: r.title || 'Untitled', status: r.status || 'BOOKED',
      travelDate: r.travelDate, dateCreated: r.dateCreated,
      salesPrice: parseFloat(r.salesPrice as string) || 0,
      totalPrice: netTotalPrice(r.salesPrice, r.discounts, r.serviceCharge),
      commission: parseFloat(r.commission as string) || 0,
      nights: r.nights || 0, adults: r.adults || 0, children: r.children || 0,
      haysRef: r.haysRef || '', supplierRef: r.supplierRef || '',
    }));
    return { items, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getAgents(scope: Scope) {
    return opportunitiesRepository.findAgents(scope);
  },
};
