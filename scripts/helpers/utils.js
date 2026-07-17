export function toDisplayName(file) {
  return file
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTitleHTML(file, primaryClass, secondaryClass) {
  const title = toDisplayName(file);
  if (title.includes(",")) {
    const parts = title.split(",");
    const first = parts[0].trim();
    const second = parts.slice(1).join(",").trim();
    return `<span class="${primaryClass}">${first}</span><span class="${secondaryClass}">${second}</span>`;
  }
  return `<span class="${primaryClass}">${title}</span>`;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
