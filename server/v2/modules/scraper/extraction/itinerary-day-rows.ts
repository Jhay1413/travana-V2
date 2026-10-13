// Day-row itinerary reader for a PICKED itinerary section (spec.itinerarySection).
// PURE: no I/O, no AI. It reads layouts the whole-page readers in
// extraction.interpreter.ts (parseItineraryTable / parsePortListItinerary) miss,
// and is only ever run on the text of a section an agent pointed at, so it can
// afford to be more permissive than they are:
//
//   Day 1                         Sat 12 Jun                1 | Sat 12 Jun 2027 | Southampton | | 17:00
//   Sat 12 Jun                    Barcelona                 2 | Sun 13 Jun 2027 | At sea
//   Southampton, England          08:00 - 18:00             3 | Mon 14 Jun 2027 | Vigo | 08:00 | 18:00
//   Depart 17:00
//   Day 2: Vigo, Spain - Arrive 08:00 Depart 18:00
//   Day 3
//   At sea
//
// Output matches the other readers: { day, description, sub_description? }, with
// the arrive/depart times kept as printed in sub_description.

export interface ItineraryRow {
  day: number;
  description: string;
  sub_description?: string;
}

const MAX_DAYS = 60;
const MAX_DAY_RANGE = 21;
const MAX_BLOCK_LINES = 6;
const MAX_LINE_CHARS = 80;

const TIME_TOKEN = String.raw`(?:\b\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?(?![\d:])|\b\d{1,2}\s?[ap]\.?m\b\.?)`;
const TIME_TOKEN_RE = new RegExp(TIME_TOKEN, 'gi');
const TIME_WORD_RE = /\b(?:depart(?:s|ure|ing)?|arriv(?:e|es|al|ing)|dep|arr|at|from|until|till|to|onboard|all aboard|by)\b/gi;

// A day cell: a number, "Day 3", or a range ("8 - 9", "Days 8-9").
const DAY_ONLY_RE = /^(?:days?\s*)?(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?[\s.:)\t]*$/i;
// "Day 2: Vigo, Spain - Arrive 08:00 Depart 18:00" (the word "Day" is required inline, a
// bare leading number is far too common in prose).
const DAY_INLINE_RE = /^days?\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*[:.\-–—)]?\s+(\S.*)$/i;

const MONTH_RE = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;
const MONTH_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WEEKDAY = String.raw`(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+)?`;
const DATE_DM_RE = new RegExp(String.raw`^${WEEKDAY}(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?$`, 'i');
const DATE_MD_RE = new RegExp(String.raw`^${WEEKDAY}([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$`, 'i');
const DATE_NUMERIC_RE = new RegExp(String.raw`^${WEEKDAY}(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$`, 'i');

interface ParsedDate {
  month: number; // 0-11
  day: number;
  year?: number;
}

function parseDateLine(line: string): ParsedDate | null {
  const t = line.trim();
  let m = DATE_DM_RE.exec(t);
  if (m && MONTH_RE.test(m[2])) return { day: Number(m[1]), month: MONTH_INDEX[m[2].slice(0, 3).toLowerCase()], year: m[3] ? Number(m[3]) : undefined };
  m = DATE_MD_RE.exec(t);
  if (m && MONTH_RE.test(m[1])) return { day: Number(m[2]), month: MONTH_INDEX[m[1].slice(0, 3).toLowerCase()], year: m[3] ? Number(m[3]) : undefined };
  m = DATE_NUMERIC_RE.exec(t);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return { day: Number(m[1]), month: Number(m[2]) - 1, year };
  }
  return null;
}

/** True for a line that is only a calendar date ("Sat 12 Jun", "12 June 2027"). */
export function isDateLine(line: string): boolean {
  const d = parseDateLine(line);
  return d !== null && d.day >= 1 && d.day <= 31;
}

/** True for a line that is only clock times and depart/arrive words ("Depart 17:00", "08:00 - 18:00"). */
export function isTimeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const times = t.match(TIME_TOKEN_RE);
  if (!times) return false;
  const rest = t.replace(TIME_TOKEN_RE, ' ').replace(TIME_WORD_RE, ' ').replace(/[\s\-–—,;:|/()&]+/g, '');
  return rest.length === 0;
}

function clean(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

// A port/description line: short prose with letters, no currency.
function isDescription(line: string): boolean {
  if (!line || line.length > MAX_LINE_CHARS) return false;
  if (!/[A-Za-z]{2,}/.test(line)) return false;
  if (/[£$€]/.test(line)) return false;
  if (/^\*/.test(line)) return false;
  return !isDateLine(line) && !isTimeLine(line);
}

interface Block {
  start?: number;
  end?: number;
  date?: ParsedDate;
  description?: string;
  times: string[];
  lines: number;
}

function newBlock(start?: number, end?: number): Block {
  return { start, end, times: [], lines: 0 };
}

function applyLine(block: Block, line: string): void {
  if (block.lines >= MAX_BLOCK_LINES) return;
  block.lines++;
  if (isDateLine(line)) {
    if (!block.date) block.date = parseDateLine(line) ?? undefined;
    return;
  }
  if (isTimeLine(line)) {
    block.times.push(line);
    return;
  }
  if (!block.description && isDescription(line)) block.description = line;
}

// "Vigo, Spain - Arrive 08:00 Depart 18:00" -> port + the trailing time phrase.
function splitInline(rest: string): { description: string; times: string[] } {
  const firstTime = rest.search(new RegExp(String.raw`(?:\b(?:depart(?:s|ure)?|arriv(?:e|es|al)|dep|arr)\.?\s*(?:at\s+)?)?${TIME_TOKEN}`, 'i'));
  if (firstTime <= 0) return { description: rest, times: [] };
  const description = rest.slice(0, firstTime).replace(/[\s\-–—,;:|(]+$/, '').trim();
  const tail = rest.slice(firstTime).replace(/[\s)]+$/, '').trim();
  return { description, times: tail && isTimeLine(tail.replace(/\b(?:depart(?:s|ure)?|arriv(?:e|es|al)|dep|arr)\b/gi, ' ')) ? [tail] : [] };
}

function pipeCells(line: string): string[] | null {
  const cells = line.includes('|') ? line.split('|') : line.includes('\t') ? line.split('\t') : null;
  if (!cells) return null;
  const trimmed = cells.map(clean);
  return trimmed.filter(Boolean).length >= 2 ? trimmed : null;
}

function blockFromCells(cells: string[]): Block | null {
  const first = cells.find(Boolean) ?? '';
  const m = DAY_ONLY_RE.exec(first);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  const block = newBlock(start, end > start && end - start <= MAX_DAY_RANGE ? end : start);
  let skippedFirst = false;
  for (const cell of cells) {
    if (!cell) continue;
    if (!skippedFirst) {
      skippedFirst = true;
      continue;
    }
    applyLine(block, cell);
  }
  return block;
}

// Sequential day numbers from the block dates when every date parses and runs forwards
// (so a sea day left out of the list still leaves a gap), else null.
function daysFromDates(blocks: Block[]): number[] | null {
  if (!blocks.every((b) => b.date)) return null;
  const out: number[] = [];
  let year = blocks[0].date?.year ?? 2001;
  let prevMonth = blocks[0].date?.month ?? 0;
  let base = 0;
  for (let i = 0; i < blocks.length; i++) {
    const d = blocks[i].date as ParsedDate;
    if (d.year) year = d.year;
    else if (i > 0 && d.month < prevMonth) year++;
    prevMonth = d.month;
    const ms = Date.UTC(year, d.month, d.day);
    if (Number.isNaN(ms)) return null;
    const dayNumber = Math.round(ms / 86_400_000);
    if (i === 0) base = dayNumber;
    const n = dayNumber - base + 1;
    if (i > 0 && n <= out[i - 1]) return null;
    out.push(n);
  }
  return out[out.length - 1] <= MAX_DAYS ? out : null;
}

/**
 * Reads day rows out of a picked itinerary section. Returns [] unless at least two
 * days with a port/description were found.
 */
export function parseItineraryDayRows(sectionText: string): ItineraryRow[] {
  const lines = sectionText.split('\n').map(clean);
  const blocks: Block[] = [];
  let current: Block | null = null;

  const push = (b: Block | null): void => {
    if (b && b.description) blocks.push(b);
  };

  for (const line of lines) {
    if (!line) continue;
    const cells = pipeCells(line);
    if (cells) {
      const piped = blockFromCells(cells);
      if (piped) {
        push(current);
        current = null;
        blocks.push(piped);
      }
      continue;
    }
    const dayOnly = DAY_ONLY_RE.exec(line);
    if (dayOnly) {
      push(current);
      const start = Number(dayOnly[1]);
      const end = dayOnly[2] ? Number(dayOnly[2]) : start;
      current = newBlock(start, end > start && end - start <= MAX_DAY_RANGE ? end : start);
      continue;
    }
    const inline = DAY_INLINE_RE.exec(line);
    if (inline) {
      push(current);
      const start = Number(inline[1]);
      const end = inline[2] ? Number(inline[2]) : start;
      current = newBlock(start, end > start && end - start <= MAX_DAY_RANGE ? end : start);
      const { description, times } = splitInline(inline[3]);
      if (description && isDescription(description)) current.description = description;
      current.times.push(...times);
      current.lines = 1;
      continue;
    }
    if (isDateLine(line)) {
      // A date straight after a "Day N" line belongs to that day; otherwise it opens a new row.
      if (current && current.start !== undefined && !current.date && !current.description) {
        applyLine(current, line);
      } else {
        push(current);
        current = newBlock();
        applyLine(current, line);
      }
      continue;
    }
    if (current) applyLine(current, line);
  }
  push(current);

  // Rows with a printed day number win; date-only rows are used only when there are none.
  const numbered = blocks.filter((b) => b.start !== undefined);
  const rows: ItineraryRow[] = [];
  const emit = (b: Block, days: number[]): void => {
    for (const day of days) {
      rows.push({ day, description: b.description as string, ...(b.times.length ? { sub_description: b.times.join(', ') } : {}) });
    }
  };

  if (numbered.length >= 2) {
    let last = 0;
    for (const b of numbered) {
      const start = b.start as number;
      const end = b.end ?? start;
      if (start <= last || end > MAX_DAYS) continue; // days only ever run forwards
      const days: number[] = [];
      for (let d = start; d <= end; d++) days.push(d);
      emit(b, days);
      last = end;
    }
  } else {
    const dated = blocks.filter((b) => b.start === undefined);
    if (dated.length >= 2) {
      const days = daysFromDates(dated) ?? dated.map((_, i) => i + 1);
      dated.forEach((b, i) => emit(b, [days[i]]));
    }
  }
  return rows.length >= 2 && rows.length <= MAX_DAYS ? rows : [];
}
