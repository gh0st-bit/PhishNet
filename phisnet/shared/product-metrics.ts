export const METRIC_DEFINITIONS = {
  queued: "Recipient waiting for the delivery worker.",
  accepted:
    "Transport accepted the message; inbox placement is not established.",
  delivered: "Delivery confirmed by a provider callback, when available.",
  opened:
    "An observed image load or explicit local-inbox read; not proof of reading.",
  clicked:
    "A unique recipient with an observed click not classified as automated.",
  submitted: "A unique recipient who submitted the training form.",
  reported: "A unique recipient who reported a matched simulation.",
  completed: "Assigned learning recorded as completed.",
} as const;
export type Dataset = "all" | "customer" | "demo";
export function rate(count: number, accepted: number) {
  return accepted > 0 ? Math.round((count / accepted) * 1000) / 10 : 0;
}
