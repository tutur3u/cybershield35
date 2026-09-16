/** Fixed-width UTC text preserves chronological ordering, including source microseconds. */
export function utcTimestamp(value: Date): string {
 return value.toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}
