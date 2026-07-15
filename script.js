const grid = document.getElementById("grid");
const emptyState = document.getElementById("empty-state");
const lightbox = document.getElementById("lightbox");
const lightboxCanvas = document.getElementById("lightbox-image");
const lightboxGifImg = document.getElementById("lightbox-image-gif");
const lightboxData = document.getElementById("lightbox-data");
const lightboxClose = document.getElementById("lightbox-close");

let lastFocusedCard = null;
let currentIndex = -1;
let worksData = [];
let layoutsData = {};
let loadedLightboxImg = null;
let lightboxResizeObserver = null;

let zoomLevel = 1;
let targetZoomLevel = 1;
let panX = 0;
let panY = 0;
let targetPanX = 0;
let targetPanY = 0;
let isAnimating = false;
let animationFrameId = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

function createRow() {
  const row = document.createElement("div");
  row.style.cssText = `
    display: flex;
    gap: var(--card-gap, 8px);
    grid-column: 1 / -1;
  `;
  return row;
}

function buildCard(work, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${work.title}`);
  card.dataset.index = index;
  card.style.setProperty("--glow-src", `url("works/${work.file}")`);

  const container = document.createElement("div");
  container.className = "card__img-container";

  if (work.isAnimated) {
    const img = document.createElement("img");
    img.src = `works/${work.file}`;
    img.alt = work.title;
    img.loading = "lazy";
    img.decoding = "async";
    container.appendChild(img);
  } else {
    const canvas = document.createElement("canvas");
    canvas.className = "card__canvas";
    canvas.width = work.width;
    canvas.height = work.height;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", work.title);
    const img = new Image();
    img.src = `works/${work.file}`;
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
    };
    container.appendChild(canvas);
  }

  const tooltip = document.createElement("span");
  tooltip.className = "card__tooltip";
  if (work.title.includes(",")) {
    const parts = work.title.split(",");
    const first = parts[0].trim();
    const second = parts.slice(1).join(",").trim();
    tooltip.innerHTML = `<span class="card__tooltip-primary">${first}</span><span class="card__tooltip-secondary">${second}</span>`;
  } else {
    tooltip.innerHTML = `<span class="card__tooltip-primary">${work.title}</span>`;
  }
  container.appendChild(tooltip);

  card.appendChild(container);
  return card;
}

function toDisplayName(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function drawLightboxImage() {
  if (!loadedLightboxImg) return;
  const frame = document.querySelector(".lightbox__frame");
  const cs = getComputedStyle(frame);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const cw = frame.clientWidth - padX;
  const ch = frame.clientHeight - padY;
  if (cw <= 0 || ch <= 0) return;

  const iw = loadedLightboxImg.naturalWidth;
  const ih = loadedLightboxImg.naturalHeight;
  const imgAspect = iw / ih;
  const conAspect = cw / ch;

  let dw, dh, ox, oy;
  if (imgAspect > conAspect) {
    dw = cw;
    dh = cw / imgAspect;
    ox = 0;
    oy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * imgAspect;
    ox = (cw - dw) / 2;
    oy = 0;
  }

  const zoomedDw = dw * zoomLevel;
  const zoomedDh = dh * zoomLevel;
  const drawX = ox + panX;
  const drawY = oy + panY;

  if (lightboxCanvas.hidden) {
    lightboxGifImg.style.width = `${dw}px`;
    lightboxGifImg.style.height = `${dh}px`;
    lightboxGifImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    lightboxGifImg.style.transformOrigin = "0 0";
    return;
  }

  lightboxCanvas.width = cw;
  lightboxCanvas.height = ch;
  const ctx = lightboxCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(loadedLightboxImg, drawX, drawY, zoomedDw, zoomedDh);
}

function animatePan() {
  const zoomDiff = targetZoomLevel - zoomLevel;
  const panDiffX = targetPanX - panX;
  const panDiffY = targetPanY - panY;

  const stillZooming = Math.abs(zoomDiff) > 0.001;
  const stillPanningX = Math.abs(panDiffX) > 0.5;
  const stillPanningY = Math.abs(panDiffY) > 0.5;

  if (!stillZooming && !stillPanningX && !stillPanningY) {
    zoomLevel = targetZoomLevel;
    panX = targetPanX;
    panY = targetPanY;
    isAnimating = false;
    drawLightboxImage();
    return;
  }

  zoomLevel += zoomDiff * 0.15;
  panX += panDiffX * 0.15;
  panY += panDiffY * 0.15;
  drawLightboxImage();
  animationFrameId = requestAnimationFrame(animatePan);
}

function setZoom(level, anchorPx, anchorPy) {
  const frame = document.querySelector(".lightbox__frame");
  const cs = getComputedStyle(frame);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const cw = frame.clientWidth - padX;
  const ch = frame.clientHeight - padY;

  const iw = loadedLightboxImg.naturalWidth;
  const ih = loadedLightboxImg.naturalHeight;
  const imgAspect = iw / ih;
  const conAspect = cw / ch;

  let dw, dh, ox, oy;
  if (imgAspect > conAspect) {
    dw = cw;
    dh = cw / imgAspect;
    ox = 0;
    oy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * imgAspect;
    ox = (cw - dw) / 2;
    oy = 0;
  }

  const oldZoom = zoomLevel;
  const newZoom = Math.max(0.1, Math.min(8, level));

  const anchorX = anchorPx * cw;
  const anchorY = anchorPy * ch;

  const imgX = ox + panX;
  const imgY = oy + panY;

  const anchorOffsetX = anchorX - imgX;
  const anchorOffsetY = anchorY - imgY;

  const anchorRatioX = anchorOffsetX / (dw * oldZoom);
  const anchorRatioY = anchorOffsetY / (dh * oldZoom);

  const newImgX = anchorX - anchorRatioX * (dw * newZoom);
  const newImgY = anchorY - anchorRatioY * (dh * newZoom);

  targetZoomLevel = newZoom;
  targetPanX = newImgX - ox;
  targetPanY = newImgY - oy;

  if (!isAnimating) {
    isAnimating = true;
    animatePan();
  }
}

function resetZoom() {
  targetZoomLevel = 1;
  targetPanX = 0;
  targetPanY = 0;

  if (!isAnimating) {
    isAnimating = true;
    animatePan();
  }
}

function resetZoomImmediate() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  zoomLevel = 1;
  targetZoomLevel = 1;
  panX = 0;
  panY = 0;
  targetPanX = 0;
  targetPanY = 0;
  isAnimating = false;
}

function openLightbox(work, triggerEl, index) {
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;

  if (work.isAnimated) {
    lightboxCanvas.hidden = true;
    lightboxGifImg.hidden = false;
    lightboxGifImg.src = `works/${work.file}`;
    lightboxGifImg.onload = () => {
      if (currentIndex !== index) return;
      loadedLightboxImg = lightboxGifImg;
      zoomLevel = 1.05;
      targetZoomLevel = 1;
      panX = 0;
      panY = 0;
      targetPanX = 0;
      targetPanY = 0;
      isAnimating = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animatePan();
      if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
      lightboxResizeObserver = new ResizeObserver(drawLightboxImage);
      lightboxResizeObserver.observe(
        document.querySelector(".lightbox__frame"),
      );
    };
  } else {
    lightboxGifImg.src = "";
    lightboxGifImg.onload = null;
    lightboxGifImg.hidden = true;
    lightboxCanvas.hidden = false;
    const img = new Image();
    img.src = `works/${work.file}`;
    img.onload = () => {
      if (currentIndex !== index) return;
      loadedLightboxImg = img;
      zoomLevel = 1.05;
      targetZoomLevel = 1;
      panX = 0;
      panY = 0;
      targetPanX = 0;
      targetPanY = 0;
      isAnimating = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animatePan();
      if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
      lightboxResizeObserver = new ResizeObserver(drawLightboxImage);
      lightboxResizeObserver.observe(
        document.querySelector(".lightbox__frame"),
      );
    };
  }

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  lightboxClose.focus();
}

function navigateLightbox(direction) {
  const next = (currentIndex + direction + worksData.length) % worksData.length;
  openLightbox(worksData[next], null, next);
}

function handleCardActivation(card) {
  const index = parseInt(card.dataset.index, 10);
  if (!isNaN(index) && worksData[index]) {
    openLightbox(worksData[index], card, index);
  }
}

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

function closeLightbox() {
  lightbox.hidden = true;
  if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  loadedLightboxImg = null;
  lightboxGifImg.onload = null;
  lightboxGifImg.src = "";
  lightboxGifImg.style.width = "";
  lightboxGifImg.style.height = "";
  lightboxGifImg.style.transform = "";
  lightboxGifImg.hidden = true;
  lightboxCanvas.hidden = false;
  zoomLevel = 1;
  targetZoomLevel = 1;
  panX = 0;
  panY = 0;
  targetPanX = 0;
  targetPanY = 0;
  isAnimating = false;
  isDragging = false;
  document.body.style.overflow = "";
  if (lastFocusedCard) lastFocusedCard.focus();
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox
  .querySelector(".lightbox__backdrop")
  .addEventListener("click", closeLightbox);
document.addEventListener("keydown", (event) => {
  if (lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") navigateLightbox(-1);
  if (event.key === "ArrowRight") navigateLightbox(1);
});

const frame = document.querySelector(".lightbox__frame");

frame.addEventListener(
  "wheel",
  (event) => {
    if (!loadedLightboxImg) return;
    event.preventDefault();

    const rect = frame.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const cs = getComputedStyle(frame);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = frame.clientWidth - padX;
    const ch = frame.clientHeight - padY;

    const normX = Math.max(0, Math.min(1, mouseX / cw));
    const normY = Math.max(0, Math.min(1, mouseY / ch));

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newTargetZoom = targetZoomLevel * zoomFactor;

    setZoom(newTargetZoom, normX, normY);
  },
  { passive: false },
);

frame.addEventListener("dblclick", (event) => {
  if (!loadedLightboxImg) return;

  if (Math.abs(targetZoomLevel - 1) > 0.001) {
    resetZoom();
  } else {
    const rect = frame.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const cs = getComputedStyle(frame);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = frame.clientWidth - padX;
    const ch = frame.clientHeight - padY;
    const normX = Math.max(0, Math.min(1, mouseX / cw));
    const normY = Math.max(0, Math.min(1, mouseY / ch));
    setZoom(2, normX, normY);
  }
});

let initialPinchDistance = null;
let initialZoomLevel = null;
let pinchCenterX = 0;
let pinchCenterY = 0;

frame.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      const rect = frame.getBoundingClientRect();
      const cs = getComputedStyle(frame);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const cw = frame.clientWidth - padX;
      const ch = frame.clientHeight - padY;

      initialPinchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );
      initialZoomLevel = zoomLevel;

      pinchCenterX = ((touch1.clientX + touch2.clientX) / 2 - rect.left) / cw;
      pinchCenterY = ((touch1.clientY + touch2.clientY) / 2 - rect.top) / ch;

      pinchCenterX = Math.max(0, Math.min(1, pinchCenterX));
      pinchCenterY = Math.max(0, Math.min(1, pinchCenterY));
    }
  },
  { passive: false },
);

frame.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length === 2 && initialPinchDistance !== null) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );

      const scale = currentDistance / initialPinchDistance;
      setZoom(initialZoomLevel * scale, pinchCenterX, pinchCenterY);
    }
  },
  { passive: false },
);

frame.addEventListener("touchend", (event) => {
  if (event.touches.length < 2) {
    initialPinchDistance = null;
    initialZoomLevel = null;
  }
});

frame.addEventListener("pointerdown", (event) => {
  if (!loadedLightboxImg || event.pointerType === "touch") return;

  event.preventDefault();
  isDragging = true;
  frame.classList.add("lightbox__frame--grabbing");
  dragStartX = event.clientX;
  dragStartY = event.clientY;

  if (isAnimating) {
    zoomLevel = targetZoomLevel;
    panX = targetPanX;
    panY = targetPanY;
    isAnimating = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  }
});

frame.addEventListener("pointermove", (event) => {
  if (!isDragging) return;

  const dx = event.clientX - dragStartX;
  const dy = event.clientY - dragStartY;
  dragStartX = event.clientX;
  dragStartY = event.clientY;

  panX += dx;
  panY += dy;

  drawLightboxImage();
});

frame.addEventListener("pointerup", (event) => {
  if (!isDragging) return;
  isDragging = false;
  frame.classList.remove("lightbox__frame--grabbing");
});

frame.addEventListener("pointerleave", (event) => {
  if (isDragging) {
    isDragging = false;
    frame.classList.remove("lightbox__frame--grabbing");
  }
});

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".card") || event.target.closest(".lightbox")) {
    event.preventDefault();
  }
});

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
    const rowDiv = createRow(rowColCount);

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
  const rowDiv = createRow(works.length);
  for (const work of works) {
    const card = buildCard(work, globalFlat.length);
    card.style.flex = "1";
    card.style.aspectRatio = `${work.width} / ${work.height}`;
    globalFlat.push(work);
    rowDiv.appendChild(card);
  }
  fragment.appendChild(rowDiv);
}

function render(works) {
  if (!works.length) {
    emptyState.hidden = false;
    grid.hidden = true;
    return;
  }

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

  function slug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function makeHeading(tag, className, text, icon, id) {
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
    return el;
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
  grid.appendChild(fragment);

  const animated = grid.querySelectorAll(".section-heading, .card");
  animated.forEach((el, i) => {
    el.style.setProperty("--enter-delay", `${i * 60}ms`);
  });

  const subtitle = document.getElementById("site-subtitle");
  if (subtitle && orderedSections.length) {
    const folder = orderedSections[0].folder;
    subtitle.textContent = folder;
    subtitle.href = `#section-${slug(folder)}`;
  }

  renderNav(orderedSections);
}

function renderNav(orderedSections) {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  nav.innerHTML = "";
  const frag = document.createDocumentFragment();
  const seenFolders = new Set();

  for (const { folder, sub } of orderedSections) {
    if (folder && !seenFolders.has(folder)) {
      seenFolders.add(folder);
      const pageLink = document.createElement("a");
      pageLink.className = "site-nav__link site-nav__link--page";
      pageLink.href = `#section-${slug(folder)}`;
      pageLink.textContent = folder.toUpperCase();
      pageLink.dataset.target = `section-${slug(folder)}`;
      frag.appendChild(pageLink);
    }
    if (sub) {
      const link = document.createElement("a");
      link.className = "site-nav__link";
      link.href = `#section-${slug(sub)}`;
      link.textContent = sub;
      link.dataset.target = `section-${slug(sub)}`;
      frag.appendChild(link);
    }
  }

  nav.appendChild(frag);
  setupScrollSpy(nav);
}

function setupScrollSpy(nav) {
  const links = Array.from(nav.querySelectorAll(".site-nav__link"));
  if (!links.length) return;
  const headings = Array.from(
    document.querySelectorAll(".section-heading[id]"),
  );
  if (!headings.length) return;

  let ticking = false;
  function update() {
    ticking = false;
    const offset = 90;
    let activeId = headings[0].id;
    for (const h of headings) {
      if (h.getBoundingClientRect().top - offset <= 0) activeId = h.id;
      else break;
    }
    for (const link of links) {
      link.classList.toggle("is-active", link.dataset.target === activeId);
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

const homeLinks = document.querySelectorAll(
  ".site-header__home, .site-title__link",
);
homeLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", location.pathname + location.search);
  });
});

async function loadManifest() {
  try {
    const res = await fetch("manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : data.entries || [];
    layoutsData = data.layouts || {};
    render(entries);
  } catch (err) {
    console.error("Failed to load manifest.json:", err);
    render([]);
  }
}

loadManifest();
