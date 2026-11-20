import { pool } from "../db";
import { storage } from "../storage";
import type { Campaign, LandingPage } from "@shared/schema";
export async function campaignLanding(
  campaign: Campaign,
): Promise<LandingPage | undefined> {
  const snapshot = (
    await pool.query(
      "SELECT content FROM campaign_content_snapshots WHERE campaign_id=$1 AND organization_id=$2",
      [campaign.id, campaign.organizationId],
    )
  ).rows[0]?.content?.landing;
  if (snapshot)
    return Object.fromEntries(
      Object.entries(snapshot).map(([key, value]) => [
        key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()),
        value,
      ]),
    ) as LandingPage;
  return storage.getLandingPage(campaign.landingPageId);
}
export function trainingFeedback(page: LandingPage) {
  const escape = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  if (!page.enableMicrolearning)
    return "<h1>Simulation complete</h1><p>This was a security awareness exercise. Verify unexpected requests through a trusted channel and report suspicious messages.</p>";
  const tips = Array.isArray(page.learningTips) ? page.learningTips : [];
  return `<h1>Simulation complete</h1><h2>${escape(page.learningTitle || "Pause, verify and report")}</h2><p>${escape(page.learningContent)}</p><ul>${tips.map((t) => `<li>${escape(t)}</li>`).join("")}</ul><p>Do not enter real passwords on a page opened from an unexpected message.</p>`;
}
