export function slugify(name: string) {
  return (name || "merchant")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "merchant";
}
