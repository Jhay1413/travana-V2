export const CSV_HEADERS = ["Tour Operator", "Phone", "Weblink", "Username", "Password", "Commission Rate", "Balance Due (weeks)"] as const;

export const TEMPLATE_FILE_NAME = "tour-operators-template.csv";
export const EXPORT_FILE_NAME = "tour-operators.csv";

const EXAMPLE = "Example Holidays,0203 000 0000,https://trade.example.com,agent01,Password123,10,14";

/** The header line plus one example row (verbatim from the design). */
export function templateCsv(): string {
  return `${CSV_HEADERS.join(",")}\n${EXAMPLE}\n`;
}
