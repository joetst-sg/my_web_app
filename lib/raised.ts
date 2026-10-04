// Amount raised for crowdfunding products (shown instead of a price).
// Plain module: used by both server and client components.
export const raisedOf = (p: { source_name: string | null; campaign_raised: number | string | null; campaign_currency: string | null }) =>
  p.source_name ? { amount: p.campaign_raised, currency: p.campaign_currency } : null
