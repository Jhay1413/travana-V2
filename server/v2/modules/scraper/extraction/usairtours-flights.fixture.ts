// USAirtours / travelconline-shaped deal page: outbound flight -> accommodation ->
// return flight, so ONE "Flights Section" box cannot hold both directions.
// `deep: true` reproduces deepText, which puts "(LHR)" on its own line.

export interface UsaLeg {
  airline: string;
  flightNo: string; // as printed, e.g. "VS 25"
  dep: string;
  from: [string, string]; // [name, code]
  duration: string;
  arr: string;
  to: [string, string];
  overnight?: string; // e.g. "+1 day"
}

export interface UsaPage {
  day: string; // "21"
  month: string; // "Aug"
  retDay: string;
  retMonth: string;
  out: UsaLeg[];
  ret: UsaLeg[];
  summary: string; // "21 Aug 2027 - 27 Aug 2027"
  deep?: boolean;
}

function airport(name: string, code: string, deep: boolean): string[] {
  return deep ? [name, `(${code})`] : [`${name} (${code})`];
}

function legLines(leg: UsaLeg, deep: boolean): string[] {
  return [
    `${leg.airline} - ${leg.flightNo}`,
    'Direct',
    leg.dep,
    ...airport(leg.from[0], leg.from[1], deep),
    leg.duration,
    leg.arr,
    ...airport(leg.to[0], leg.to[1], deep),
    ...(leg.overnight ? [leg.overnight] : []),
  ];
}

export const HOTEL_COPY = [
  'Moxy NYC Times Square ',
  'Modern rooms a short walk from Broadway, with a rooftop bar and a fitness centre.',
  'Guests can enjoy breakfast in the lobby and a lively evening atmosphere.',
];

export function usaPage(p: UsaPage): string {
  const deep = p.deep === true;
  const fare = ['PACKAGE FARE (ITX)', ' 1 PC', ''];
  const outbound = p.out.flatMap((leg, idx) => [...legLines(leg, deep), ...(idx === p.out.length - 1 ? fare : [])]);
  const returning = p.ret.flatMap((leg, idx) => [...legLines(leg, deep), ...(idx === p.ret.length - 1 ? fare : [])]);
  const firstOut = p.out[0].flightNo.replace(/\s+/g, '');
  const firstRet = p.ret[0].flightNo.replace(/\s+/g, '');
  return [
    'Created: Monday, October 12, 2026 - Departure: Saturday, August 21, 2027',
    'View details',
    'Included services',
    p.day, p.month, 'Departure transport',
    'Departure',
    ...outbound,
    'View details',
    `Transport:  ${firstOut}`,
    'Transport type: 339',
    'Cabin Class: Economy',
    p.day, p.month, 'Accommodation',
    '5 Nights',
    'USAirtours recommended',
    '16 more pictures',
    ...HOTEL_COPY,
    'View details',
    p.retDay, p.retMonth, 'Return transport',
    'Return',
    ...returning,
    'View details',
    `Transport:  ${firstRet}`,
    'Transport type: 351',
    'Cabin Class: Economy',
    'Price per person From',
    '£1,088',
    'Based on 2 adults and 1 child',
    '(£3,265 Total Price )',
    'Trip summary',
    '2 Adults + 1 Children',
    p.summary,
    'Nights',
    '5',
  ].join('\n');
}

export const DEAL_A: UsaPage = {
  day: '21', month: 'Aug', retDay: '26', retMonth: 'Aug', summary: '21 Aug 2027 - 27 Aug 2027',
  out: [{ airline: 'Virgin Atlantic Airways', flightNo: 'VS 25', dep: '20:05', from: ['Heathrow London', 'LHR'], duration: '7h 45m', arr: '22:50', to: ['John F Kennedy Intl', 'JFK'] }],
  ret: [{ airline: 'Virgin Atlantic Airways', flightNo: 'VS 138', dep: '23:00', from: ['John F Kennedy Intl', 'JFK'], duration: '7h', arr: '11:00', to: ['Heathrow London', 'LHR'], overnight: '+1 day' }],
};

// A different deal, same layout: other airports, dates, times and carrier.
export const DEAL_B: UsaPage = {
  day: '4', month: 'Sep', retDay: '11', retMonth: 'Sep', summary: '4 Sep 2027 - 12 Sep 2027',
  out: [{ airline: 'British Airways', flightNo: 'BA 283', dep: '10:15', from: ['Gatwick London', 'LGW'], duration: '11h 5m', arr: '13:20', to: ['Los Angeles Intl', 'LAX'] }],
  ret: [{ airline: 'British Airways', flightNo: 'BA 282', dep: '17:40', from: ['Los Angeles Intl', 'LAX'], duration: '10h 30m', arr: '11:10', to: ['Gatwick London', 'LGW'], overnight: '+1 day' }],
};
