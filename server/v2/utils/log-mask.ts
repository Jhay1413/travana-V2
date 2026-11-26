const TOKEN_PATHS: ReadonlyArray<RegExp> = [
  /^(\/api\/public\/quote\/)[^/]+/,
  /^(\/view-quote\/)[^/]+/,
  /^(\/api\/v2\/quotes\/preview\/)[^/]+/,
];

/** The request path with a quote share token replaced by :token, for the request log. */
export function maskQuoteTokenPath(path: string): string {
  for (const pattern of TOKEN_PATHS) {
    if (pattern.test(path)) return path.replace(pattern, "$1:token");
  }
  return path;
}

/** Public quote routes never log their response bodies: they carry the whole quote. */
export function isQuoteTokenPath(path: string): boolean {
  return TOKEN_PATHS.some((pattern) => pattern.test(path));
}
