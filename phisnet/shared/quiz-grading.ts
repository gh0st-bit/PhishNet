export function answerMatches(
  type: string,
  provided: unknown,
  expected: unknown,
) {
  if (provided === undefined || provided === null) return false;
  if (type === "multiple_select")
    return (
      Array.isArray(provided) &&
      Array.isArray(expected) &&
      new Set(provided).size === provided.length &&
      JSON.stringify([...provided].sort()) ===
        JSON.stringify([...expected].sort())
    );
  if (type === "fill_blank")
    return (
      typeof provided === "string" &&
      typeof expected === "string" &&
      provided.trim().toLowerCase() === expected.trim().toLowerCase()
    );
  if (type === "true_false")
    return String(provided).toLowerCase() === String(expected).toLowerCase();
  return JSON.stringify(provided) === JSON.stringify(expected);
}
