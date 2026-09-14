import type { ArticleContent } from "./schemas";

/** Field tools may suggest only the fields their labels promise to change. */
export function scopeArticleProposal<T extends ArticleContent>(action: string, current: ArticleContent, proposal: T): T {
  if (action === "claim_check") return { ...proposal, ...current };
  if (action === "description") return { ...proposal, ...current, description: proposal.description };
  if (action === "title_description") return { ...proposal, ...current, title: proposal.title, description: proposal.description };
  return proposal;
}
