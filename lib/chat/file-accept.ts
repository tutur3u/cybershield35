/** Match the same extension and MIME patterns accepted by a native file input. */
export function matchesFileAccept(file: { name: string; type: string }, accept?: string) {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").map((pattern) => pattern.trim().toLowerCase()).filter(Boolean).some((pattern) => {
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}
