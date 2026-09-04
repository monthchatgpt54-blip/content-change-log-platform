export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function datedReference(prefix: string, sequence?: number) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = sequence
    ? String(sequence).padStart(3, "0")
    : crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}
