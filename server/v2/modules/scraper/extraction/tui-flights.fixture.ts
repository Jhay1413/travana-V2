// A real TUI deepText excerpt. The flight cards come BEFORE the "Your flights"
// heading, and the return card carries a "+1 day" overnight marker. Derived
// section labels for it are startLabel "Durations", endLabel "Selected".
export const TUI_DEEP_TEXT = [
  'Dates', '5 nights', '-£701', 'pp', 'Durations',
  'Out Wednesday 12th May 2027, Depart from Manchester, 11:10. Arrive at Montego Bay, 14:50. Direct Flight, duration: 9 hours 40 minutes, with TUI Airways. Return Wednesday 26th May 2027, Depart from Montego Bay, 16:50. Arrive at Manchester, 07:40, the next day. Direct Flight, duration: 8 hours 50 minutes, with TUI Airways. Flight selected',
  'OUT', 'Wed', '12', 'May', '2027', '11:10', 'Manchester', 'MAN', 'Direct', '9', 'h', '40', 'm', '14:50', 'Montego Bay', 'MBJ', 'TUI Airways',
  'RTN', 'Wed', '26', 'May', '2027', '+1 day', ',', 'tooltip', ',', 'Your flight arrives the next day', '16:50', 'Montego Bay', 'MBJ', 'Direct', '8', 'h', '50', 'm', '07:40', 'Manchester', 'MAN', 'TUI Airways',
  'Selected', 'Your flights', '1', 'flight available', 'Your room',
].join('\n');
