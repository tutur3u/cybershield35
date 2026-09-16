import {expect,test} from "bun:test";
import {cosineSimilarity} from "../lib/db/vector-similarity";

test("cosine ranking preserves direction and ignores magnitude", () => {
 expect(cosineSimilarity([3,4],[6,8])).toBeCloseTo(1,12);
 expect(cosineSimilarity([1,0],[0,1])).toBe(0);
 expect(cosineSimilarity([1,0],[-1,0])).toBe(-1);
 expect(cosineSimilarity([1,1],[1,0])).toBeCloseTo(Math.SQRT1_2,12);
});
test("empty, zero, and incompatible embeddings do not match", () => {
 expect(cosineSimilarity([],[])).toBe(0);
 expect(cosineSimilarity([0,0],[1,1])).toBe(0);
 expect(cosineSimilarity([1],[1,1])).toBe(0);
});
