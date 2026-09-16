/** Exact cosine similarity for persisted vectors, computed without a SQL cross join. */
export function cosineSimilarity(left: number[], right: number[]): number {
 if (left.length !== right.length || !left.length) return 0;
 let dot = 0, leftSquared = 0, rightSquared = 0;
 for (let i = 0; i < left.length; i++) {
  const a = left[i]!, b = right[i]!;
  dot += a * b; leftSquared += a * a; rightSquared += b * b;
 }
 const denominator = Math.sqrt(leftSquared * rightSquared);
 return denominator > 0 ? Math.max(-1, Math.min(1, dot / denominator)) : 0;
}
