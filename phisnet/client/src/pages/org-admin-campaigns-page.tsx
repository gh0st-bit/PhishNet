import CampaignsPage from "@/pages/campaigns-page";

// Org-admin scoped campaigns view.
// Reuse the admin campaigns UI; backend must enforce organization scoping
// when requests include the org-admin session.
export default function OrgAdminCampaignsPage() {
  return <CampaignsPage />;
}
