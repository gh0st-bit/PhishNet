import Papa from "papaparse";
import { z } from "zod";
export function previewEmployees(
  csv: string,
  mapping: { email: string; firstName?: string; lastName?: string },
) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors = parsed.errors.filter(
    (e) => e.code !== "UndetectableDelimiter",
  );
  if (errors.length)
    throw Object.assign(
      new Error("CSV could not be parsed: " + errors[0].message),
      { status: 400 },
    );
  if (!parsed.meta.fields?.includes(mapping.email))
    throw Object.assign(new Error("Choose an existing email column"), {
      status: 400,
    });
  if (parsed.data.length > 1000)
    throw Object.assign(new Error("Import at most 1,000 rows at a time"), {
      status: 400,
    });
  const seen = new Set<string>();
  return {
    columns: parsed.meta.fields,
    rows: parsed.data.map((row, index) => {
      const email = (row[mapping.email] || "").trim().toLowerCase();
      let error = "";
      if (!z.email().safeParse(email).success) error = "Invalid email address";
      else if (seen.has(email)) error = "Duplicate email in this file";
      seen.add(email);
      return {
        row: index + 2,
        email,
        firstName: (row[mapping.firstName || ""] || "").trim().slice(0, 100),
        lastName: (row[mapping.lastName || ""] || "").trim().slice(0, 100),
        error,
      };
    }),
  };
}
