interface OrderableOption {
  value: string;
}

/**
 * Orders SearchableSelect options for display. With `selectedFirst` on and no search text,
 * the selected option moves to the top (the rest keep their order). Anything else (feature
 * off, an active search, nothing selected, or a selected value not in the list) returns the
 * options untouched.
 */
export function orderOptions<T extends OrderableOption>(
  options: T[],
  selectedValue: string,
  search: string,
  selectedFirst: boolean,
): T[] {
  if (!selectedFirst || search || !selectedValue) return options;
  const index = options.findIndex((opt) => opt.value === selectedValue);
  if (index <= 0) return options;
  return [options[index], ...options.slice(0, index), ...options.slice(index + 1)];
}
