const grid = document.getElementById("grid");
const emptyState = document.getElementById("empty-state");
const workCount = document.getElementById("work-count");
const lightbox = document.getElementById("lightbox");
const lightboxCanvas = document.getElementById("lightbox-image");
const lightboxData = document.getElementById("lightbox-data");
const lightboxClose = document.getElementById("lightbox-close");

let lastFocusedCard = null;
let currentIndex = -1;
let worksData = [];
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

function buildCard(work, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${work.title}`);
  card.dataset.index = index;

  if (work.isAnimated) {
    const img = document.createElement("img");
    img.src = `works/${work.file}`;
    img.alt = work.title;
    img.loading = "lazy";
    img.decoding = "async";
    card.appendChild(img);
    const badge = document.createElement("span");
    badge.className = "card__badge";
    badge.textContent = "gif";
    card.appendChild(badge);
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
    card.appendChild(canvas);
  }

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
    lightboxResizeObserver.observe(document.querySelector(".lightbox__frame"));
  };

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
});

frame.addEventListener("pointerleave", (event) => {
  if (isDragging) {
    isDragging = false;
  }
});

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".card") || event.target.closest(".lightbox")) {
    event.preventDefault();
  }
});

const COLS = 4;
const ROW_UNIT = 8;

function layoutCollage() {
  const cs = getComputedStyle(grid);
  const colWidths = cs.gridTemplateColumns
    .split(" ")
    .map(parseFloat)
    .filter((n) => !isNaN(n));
  const colWidth = colWidths[0] || 300;
  const gap = parseFloat(cs.columnGap) || 8;
  const pitch = ROW_UNIT + gap;

  grid.querySelectorAll(".card").forEach((card) => {
    const work = worksData[parseInt(card.dataset.index, 10)];
    if (!work) return;
    const { width: w, height: h } = work;
    let colSpan = Math.round(w / colWidth);
    colSpan = Math.max(1, Math.min(COLS, colSpan));
    const cellWidth = colSpan * colWidth + (colSpan - 1) * gap;
    const desiredHeight = (cellWidth * h) / w;
    const rowSpan = Math.max(1, Math.round((desiredHeight + gap) / pitch));
    card.style.gridColumn = `span ${colSpan}`;
    card.style.gridRow = `span ${rowSpan}`;
  });
}

function render(works) {
  if (!works.length) {
    emptyState.hidden = false;
    grid.hidden = true;
    workCount.textContent = "no works yet";
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

  const sortBySize = (a, b) => b.width * b.height - a.width * b.height;
  const flatData = [];

  const fragment = document.createDocumentFragment();

  let idx = 0;
  function addCards(cards) {
    cards.sort(sortBySize);
    for (const work of cards) {
      flatData.push(work);
      fragment.appendChild(buildCard(work, idx++));
    }
  }

  if (rootWorks.length) {
    addCards(rootWorks);
  }

  const folderNames = Object.keys(folderMap).sort();
  for (const folderName of folderNames) {
    const subs = folderMap[folderName];

    const h2 = document.createElement("h2");
    h2.className = "section-heading";
    h2.textContent = toDisplayName(folderName);
    fragment.appendChild(h2);

    const subNames = Object.keys(subs).sort();
    for (const subName of subNames) {
      if (subName) {
        const h3 = document.createElement("h3");
        h3.className = "section-heading section-heading--sub";
        h3.textContent = toDisplayName(subName);
        fragment.appendChild(h3);
      }
      addCards(subs[subName]);
    }
  }

  worksData = flatData;
  grid.appendChild(fragment);

  layoutCollage();

  const cards = grid.querySelectorAll(".card");
  cards.forEach((card, i) => {
    card.style.setProperty("--enter-delay", `${i * 60}ms`);
    card.classList.add("card-enter");
  });

  const label = works.length === 1 ? "piece" : "pieces";
  workCount.textContent = `${works.length} ${label} on the wall`;
}

async function loadManifest() {
  try {
    const res = await fetch("manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const works = await res.json();
    render(Array.isArray(works) ? works : []);
  } catch (err) {
    console.error("Failed to load manifest.json:", err);
    render([]);
  }
}

loadManifest();

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => layoutCollage()).observe(grid);
}
