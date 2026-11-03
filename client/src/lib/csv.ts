import Papa from "papaparse";

/** Parse CSV text into a table of trimmed cells, dropping fully empty lines. */
export function parseCsvText(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy" });
  return result.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

export function isCsvFile(name: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(name.trim());
}

/** Saves text as a file in the browser. */
export function downloadCsv(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

