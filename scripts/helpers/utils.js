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

export function buildTitleHTML(file, primaryClass, secondaryClass, counter) {
  const title = toDisplayName(file);
  let html = "";
  if (title.includes(",")) {
    const parts = title.split(",");
    const first = parts[0].trim();
    const second = parts.slice(1).join(",").trim();
    html = `<span class="${primaryClass}">${first}</span><span class="${secondaryClass}">${second}</span>`;
  } else {
    html = `<span class="${primaryClass}">${title}</span>`;
  }
  if (counter) {
    const current = counter.current + 1;
    const total = counter.total;
    return `<div class="card__tooltip-left">${html}</div><div class="card__tooltip-counter"><span class="current">${current}</span><span class="divider">/</span><span class="total">${total}</span></div>`;
  }
  return html;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
