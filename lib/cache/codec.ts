type Encoded = null | string | number | boolean | ["date", string] | ["array", Encoded[]] | ["object", [string, Encoded][]] | ["undefined"];
function encode(value: unknown): Encoded {
 if (value === undefined) return ["undefined"];
 if (value instanceof Date) return ["date", value.toISOString()];
 if (Array.isArray(value)) return ["array", value.map(encode)];
 if (value !== null && typeof value === "object") return ["object", Object.entries(value).map(([key, item]) => [key, encode(item)])];
 return value as null | string | number | boolean;
}
function decode(value: Encoded): unknown {
 if (!Array.isArray(value)) return value;
 switch (value[0]) {
  case "undefined": return undefined;
  case "date": return new Date(value[1]);
  case "array": return value[1].map(decode);
  case "object": return Object.fromEntries(value[1].map(([key, item]) => [key, decode(item)]));
 }
}
export const serializeCachedData = (value: unknown) => JSON.stringify(encode(value));
export const deserializeCachedData = <T>(value: string): T => decode(JSON.parse(value)) as T;
