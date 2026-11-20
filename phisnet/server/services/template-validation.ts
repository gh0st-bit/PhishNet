export const SUPPORTED_TEMPLATE_VARIABLES = [
  "FirstName",
  "LastName",
  "Email",
  "SenderName",
  "Position",
  "Department",
  "TrackingURL",
  "CredentialCaptureLink",
] as const;
export function unknownTemplateVariables(html: string) {
  return [
    ...new Set(
      Array.from(
        html.matchAll(/{{\s*\.?([A-Za-z][A-Za-z0-9_]*)\s*}}/g),
        (m) => m[1],
      ).filter((key) => !SUPPORTED_TEMPLATE_VARIABLES.includes(key as any)),
    ),
  ];
}
export function assertTemplateVariables(html: string) {
  const unknown = unknownTemplateVariables(html);
  if (unknown.length)
    throw Object.assign(
      new Error("Unsupported template variables: " + unknown.join(", ")),
      { status: 400 },
    );
}
