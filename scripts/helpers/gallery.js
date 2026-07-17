import { toDisplayName, slug, buildTitleHTML } from "./utils.js";
import { openLightbox } from "./lightbox.js";

let worksData = [];
let layoutsData = {};

let gridEl = null;
let gifObserver = null;

function createRow() {
  const row = document.createElement("div");
  row.style.cssText = `
    display: flex;
    gap: var(--gap, 8px);
    grid-column: 1 / -1;
  `;
  return row;
}

function buildCard(work, index) {
  const card = document.createElement("article");
  card.className = "card bg-checker";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${toDisplayName(work.file)}`);
  card.dataset.index = index;
  card.style.setProperty("--glow-src", `url("/assets/art/${work.file}")`);

  const container = document.createElement("div");
  container.className = "card__img-container";

  if (work.isAnimated) {
    const img = document.createElement("img");
    img.dataset.originalSrc = `assets/art/${work.file}`;
    img.alt = toDisplayName(work.file);
    img.loading = "lazy";
    img.decoding = "async";
    container.appendChild(img);
  } else {
    const canvas = document.createElement("canvas");
    canvas.className = "card__canvas";
    canvas.width = work.width;
    canvas.height = work.height;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", toDisplayName(work.file));
    const img = new Image();
    img.src = `assets/art/${work.file}`;
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
    };
    container.appendChild(canvas);
  }

  const tooltip = document.createElement("span");
  tooltip.className = "card__tooltip";
  tooltip.innerHTML = buildTitleHTML(
    work.file,
    "card__tooltip-primary",
    "card__tooltip-secondary",
  );
  container.appendChild(tooltip);

  card.appendChild(container);
  return card;
}

function getLayoutKey(work) {
  const parts = work.file.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function renderLayout(works, layout, fragment, globalFlat) {
  const byFile = {};
  for (const w of works) byFile[w.file] = w;

  const ordered = [];
  for (const filePath of layout.order) {
    const w = byFile[filePath];
    if (w) ordered.push(w);
  }

  let slotIdx = 0;

  for (let row = 0; row < layout.cols.length; row++) {
    const rowColCount = layout.cols[row];
    const rowDiv = createRow();
    rowDiv.style.setProperty("--cols", Math.ceil(rowColCount / 2));

    for (let col = 0; col < rowColCount; col++) {
      const work = ordered[slotIdx];
      if (work) {
        const card = buildCard(work, globalFlat.length);
        card.style.flex = "1";
        card.style.aspectRatio = `${work.width} / ${work.height}`;
        globalFlat.push(work);
        rowDiv.appendChild(card);
      }
      slotIdx++;
    }
    fragment.appendChild(rowDiv);
  }
}

function renderFallback(works, fragment, globalFlat) {
  if (!works.length) return;
  const rowDiv = createRow();
  rowDiv.style.setProperty("--cols", Math.ceil(works.length / 2));
  for (const work of works) {
    const card = buildCard(work, globalFlat.length);
    card.style.flex = "1";
    card.style.aspectRatio = `${work.width} / ${work.height}`;
    globalFlat.push(work);
    rowDiv.appendChild(card);
  }
  fragment.appendChild(rowDiv);
}

function handleCardActivation(card) {
  const index = parseInt(card.dataset.index, 10);
  if (!isNaN(index) && worksData[index]) {
    openLightbox(worksData[index], card, worksData, index);
  }
}

export function initGallery(grid) {
  gridEl = grid;

  grid.addEventListener("click", (event) => {
    const card = event.target.closest(".card");
    if (card) handleCardActivation(card);
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const card = event.target.closest(".card");
      if (card) {
        event.preventDefault();
        handleCardActivation(card);
      }
    }
  });

  gifObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target;
        if (!img.dataset.originalSrc) return;
        if (entry.isIntersecting) {
          if (!img.src) {
            img.src = img.dataset.originalSrc;
          } else if (img.dataset.paused) {
            img.src = img.dataset.paused;
            delete img.dataset.paused;
          }
        } else {
          if (img.src) {
            img.dataset.paused = img.src;
            img.src = "";
          }
        }
      });
    },
    { rootMargin: "200px" },
  );
}

function makeHeading(tag, className, text, icon, id, links) {
  const el = document.createElement(tag);
  el.className = className;
  if (id) el.id = id;
  const box = document.createElement("span");
  box.className = "section-heading__box";
  if (icon) {
    const img = document.createElement("img");
    img.className = "section-heading__icon";
    img.src = icon;
    img.alt = "";
    img.loading = "lazy";
    img.draggable = false;
    box.appendChild(img);
  }
  const span = document.createElement("span");
  span.className = "section-heading__text";
  span.textContent = text;
  box.appendChild(span);
  el.appendChild(box);
  const underline = document.createElement("span");
  underline.className = "section-heading__underline";
  el.appendChild(underline);
  if (links && links.length) {
    const linksContainer = document.createElement("span");
    linksContainer.className = "section-heading__links";
    for (const link of links) {
      const a = document.createElement("a");
      a.className = "section-heading__link";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const img = document.createElement("img");
      img.src = link.icon;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      a.appendChild(img);
      linksContainer.appendChild(a);
    }
    el.appendChild(linksContainer);
  }
  return el;
}

export function render(works, layouts) {
  layoutsData = layouts;
  if (!works.length) return { worksData: [], orderedSections: [] };

  const rootWorks = [];
  const folderMap = {};

  for (const work of works) {
    if (!work.folder) {
      rootWorks.push(work);
    } else {
      if (!folderMap[work.folder]) folderMap[work.folder] = {};
      const subKey = work.subfolder || "";
      if (!folderMap[work.folder][subKey]) {
        folderMap[work.folder][subKey] = [];
      }
      folderMap[work.folder][subKey].push(work);
    }
  }

  const flatData = [];
  const fragment = document.createDocumentFragment();

  function renderGroup(groupWorks) {
    if (!groupWorks.length) return;
    const key = getLayoutKey(groupWorks[0]);
    const layout = layoutsData[key];
    if (layout) {
      renderLayout(groupWorks, layout, fragment, flatData);
    } else {
      renderFallback(groupWorks, fragment, flatData);
    }
  }

  if (rootWorks.length) {
    renderGroup(rootWorks);
  }

  const orderedSections = [];
  const seen = new Set();
  for (const key of Object.keys(layoutsData)) {
    const parts = key.split("/");
    const folder = parts[0];
    const sub = parts.length > 1 ? parts.slice(1).join("/") : "";
    const id = `${folder}::${sub}`;
    if (seen.has(id)) continue;
    seen.add(id);
    orderedSections.push({ folder, sub });
  }
  for (const folderName of Object.keys(folderMap).sort()) {
    const subs = folderMap[folderName];
    for (const subName of Object.keys(subs).sort()) {
      const id = `${folderName}::${subName}`;
      if (seen.has(id)) continue;
      seen.add(id);
      orderedSections.push({ folder: folderName, sub: subName });
    }
  }

  let lastFolder = null;
  for (const { folder, sub } of orderedSections) {
    if (folder !== lastFolder) {
      const folderLayout = layoutsData[folder];
      fragment.appendChild(
        makeHeading(
          "h2",
          "section-heading",
          toDisplayName(folder),
          folderLayout && folderLayout.icon,
          `section-${slug(folder)}`,
          folderLayout && folderLayout.links,
        ),
      );
      lastFolder = folder;
    }
    if (sub) {
      const subLayout = layoutsData[`${folder}/${sub}`];
      fragment.appendChild(
        makeHeading(
          "h3",
          "section-heading section-heading--sub",
          toDisplayName(sub),
          subLayout && subLayout.icon,
          `section-${slug(sub)}`,
        ),
      );
    }
    const group = folderMap[folder] && folderMap[folder][sub];
    if (group) renderGroup(group);
  }

  worksData = flatData;
  gridEl.appendChild(fragment);

  const animated = gridEl.querySelectorAll(".section-heading, .card");
  animated.forEach((el, i) => {
    el.style.setProperty("--enter-delay", `${i * 60}ms`);
  });

  if (gifObserver) {
    const gifImgs = gridEl.querySelectorAll(".card img");
    gifImgs.forEach((img) => {
      if (img.dataset.originalSrc && img.dataset.originalSrc.includes(".gif")) {
        gifObserver.observe(img);
      }
    });
  }

  const subtitle = document.getElementById("site-subtitle");
  if (subtitle && orderedSections.length) {
    const folder = orderedSections[0].folder;
    subtitle.textContent = folder;
  }

  return { worksData: flatData, orderedSections };
}
