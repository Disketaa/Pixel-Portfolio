import { buildTitleHTML } from "./utils.js";

let frame;
let lightboxEl;
let lightboxCanvas;
let lightboxGifImg;
let lightboxClose;
let lightboxPrev;
let lightboxNext;
let lightboxTitle;

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

const evCache = [];
let prevPinchDist = -1;
let pinchStartZoom = 1;
let pinchAnchorX = 0.5;
let pinchAnchorY = 0.5;
let velX = 0;
let velY = 0;
let momentumId = null;
let lastMoveTime = 0;
let smoothVelX = 0;
let smoothVelY = 0;
let lastPointerType = "mouse";

function getFrameMetrics() {
  const cs = getComputedStyle(document.documentElement);
  const pad = parseFloat(cs.getPropertyValue("--lightbox-frame-padding")) || 24;
  return {
    cw: frame.clientWidth,
    ch: frame.clientHeight,
    pad,
  };
}

function getImageFit(cw, ch, img) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const conAspect = cw / ch;
  if (imgAspect > conAspect) {
    const dw = cw;
    const dh = cw / imgAspect;
    return { dw, dh, ox: 0, oy: (ch - dh) / 2 };
  }
  const dh = ch;
  const dw = ch * imgAspect;
  return { dw, dh, ox: (cw - dw) / 2, oy: 0 };
}

function resetView() {
  targetZoomLevel = 1;
  panX = 0;
  panY = 0;
  targetPanX = 0;
  targetPanY = 0;
}

function initLightboxView(img) {
  loadedLightboxImg = img;
  zoomLevel = 1.05;
  resetView();
  isAnimating = true;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animatePan();
  if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
  lightboxResizeObserver = new ResizeObserver(drawLightboxImage);
  lightboxResizeObserver.observe(frame);
}

function drawLightboxImage() {
  if (!loadedLightboxImg) return;
  const { cw, ch, pad } = getFrameMetrics();
  if (cw <= 0 || ch <= 0) return;

  const fitW = cw - pad;
  const fitH = ch - pad;
  const { dw, dh, ox, oy } = getImageFit(fitW, fitH, loadedLightboxImg);

  const drawOx = ox + pad / 2;
  const drawOy = oy + pad / 2;

  const zoomedDw = dw * zoomLevel;
  const zoomedDh = dh * zoomLevel;
  const drawX = drawOx + panX;
  const drawY = drawOy + panY;

  if (lightboxCanvas.hidden) {
    lightboxGifImg.style.position = "absolute";
    lightboxGifImg.style.left = `${drawOx}px`;
    lightboxGifImg.style.top = `${drawOy}px`;
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
  if (momentumId) {
    cancelAnimationFrame(momentumId);
    momentumId = null;
  }
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
  const { cw, ch, pad } = getFrameMetrics();
  const fitW = cw - pad;
  const fitH = ch - pad;
  const { dw, dh, ox, oy } = getImageFit(fitW, fitH, loadedLightboxImg);

  const drawOx = ox + pad / 2;
  const drawOy = oy + pad / 2;

  const oldZoom = zoomLevel;
  const newZoom = Math.max(0.1, Math.min(8, level));

  const anchorX = anchorPx * cw;
  const anchorY = anchorPy * ch;

  const imgX = drawOx + panX;
  const imgY = drawOy + panY;

  const anchorOffsetX = anchorX - imgX;
  const anchorOffsetY = anchorY - imgY;

  const anchorRatioX = anchorOffsetX / (dw * oldZoom);
  const anchorRatioY = anchorOffsetY / (dh * oldZoom);

  const newImgX = anchorX - anchorRatioX * (dw * newZoom);
  const newImgY = anchorY - anchorRatioY * (dh * newZoom);

  targetZoomLevel = newZoom;
  targetPanX = newImgX - drawOx;
  targetPanY = newImgY - drawOy;

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

export function openLightbox(work, triggerEl, workList, index) {
  worksData = workList;
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;

  if (work.isAnimated) {
    lightboxCanvas.hidden = true;
    lightboxGifImg.hidden = false;
    lightboxGifImg.src = `assets/art/${work.file}`;
    lightboxGifImg.onload = () => {
      if (currentIndex !== index) return;
      initLightboxView(lightboxGifImg);
    };
  } else {
    lightboxGifImg.src = "";
    lightboxGifImg.onload = null;
    lightboxGifImg.hidden = true;
    lightboxCanvas.hidden = false;
    const img = new Image();
    img.src = `assets/art/${work.file}`;
    img.onload = () => {
      if (currentIndex !== index) return;
      initLightboxView(img);
    };
  }

  lightboxEl.hidden = false;
  lightboxTitle.innerHTML = buildTitleHTML(
    work.file,
    "card__tooltip-primary",
    "card__tooltip-secondary",
    { current: index, total: workList.length },
  );
  document.body.style.overflow = "hidden";
  lightboxClose.focus();
}

export function navigateLightbox(direction) {
  const next = (currentIndex + direction + worksData.length) % worksData.length;
  openLightbox(worksData[next], null, worksData, next);
}

export function closeLightbox() {
  lightboxEl.hidden = true;
  lightboxTitle.innerHTML = "";
  if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  loadedLightboxImg = null;
  lightboxGifImg.onload = null;
  lightboxGifImg.src = "";
  lightboxGifImg.style.position = "";
  lightboxGifImg.style.left = "";
  lightboxGifImg.style.top = "";
  lightboxGifImg.style.width = "";
  lightboxGifImg.style.height = "";
  lightboxGifImg.style.transform = "";
  lightboxGifImg.hidden = true;
  lightboxCanvas.hidden = false;
  zoomLevel = 1;
  resetView();
  isAnimating = false;
  isDragging = false;
  velX = 0;
  velY = 0;
  if (momentumId) {
    cancelAnimationFrame(momentumId);
    momentumId = null;
  }
  evCache.length = 0;
  prevPinchDist = -1;
  document.body.style.overflow = "";
  if (lastFocusedCard) lastFocusedCard.focus();
}

export function initLightbox(opts) {
  frame = opts.frame;
  lightboxEl = opts.lightbox;
  lightboxCanvas = opts.canvas;
  lightboxGifImg = opts.gifImg;
  lightboxClose = opts.close;
  lightboxPrev = opts.prev;
  lightboxNext = opts.next;
  lightboxTitle = document.getElementById("lightbox-title");

  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", () => navigateLightbox(-1));
  lightboxNext.addEventListener("click", () => navigateLightbox(1));
  lightboxEl
    .querySelector(".lightbox__backdrop")
    .addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (event) => {
    if (lightboxEl.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") navigateLightbox(-1);
    if (event.key === "ArrowRight") navigateLightbox(1);
  });

  frame.addEventListener(
    "wheel",
    (event) => {
      if (!loadedLightboxImg) return;
      event.preventDefault();

      const rect = frame.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const { cw, ch } = getFrameMetrics();

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
      const { cw, ch } = getFrameMetrics();
      const normX = Math.max(0, Math.min(1, mouseX / cw));
      const normY = Math.max(0, Math.min(1, mouseY / ch));
      setZoom(2, normX, normY);
    }
  });

  frame.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length <= 2) event.preventDefault();
    },
    { passive: false },
  );

  frame.addEventListener("pointerdown", (event) => {
    if (!loadedLightboxImg) return;
    event.preventDefault();
    if (momentumId) {
      cancelAnimationFrame(momentumId);
      momentumId = null;
    }
    evCache.push(event);

    if (evCache.length === 2) {
      isDragging = false;
      frame.classList.remove("lightbox__frame--grabbing");

      const rect = frame.getBoundingClientRect();
      const { cw, ch } = getFrameMetrics();
      const p1 = evCache[0];
      const p2 = evCache[1];

      prevPinchDist = Math.hypot(
        p2.clientX - p1.clientX,
        p2.clientY - p1.clientY,
      );
      pinchStartZoom = zoomLevel;

      pinchAnchorX = Math.max(
        0,
        Math.min(1, ((p1.clientX + p2.clientX) / 2 - rect.left) / cw),
      );
      pinchAnchorY = Math.max(
        0,
        Math.min(1, ((p1.clientY + p2.clientY) / 2 - rect.top) / ch),
      );
    } else if (evCache.length === 1) {
      isDragging = true;
      lastPointerType = event.pointerType;
      frame.classList.add("lightbox__frame--grabbing");
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      smoothVelX = 0;
      smoothVelY = 0;
      lastMoveTime = performance.now();

      if (isAnimating) {
        zoomLevel = targetZoomLevel;
        panX = targetPanX;
        panY = targetPanY;
        isAnimating = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      }
    }
  });

  frame.addEventListener("pointermove", (event) => {
    if (evCache.length === 2) {
      event.preventDefault();
      const idx = evCache.findIndex((e) => e.pointerId === event.pointerId);
      if (idx !== -1) evCache[idx] = event;

      const p1 = evCache[0];
      const p2 = evCache[1];
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);

      if (prevPinchDist > 0) {
        setZoom(
          pinchStartZoom * (dist / prevPinchDist),
          pinchAnchorX,
          pinchAnchorY,
        );
      }
      return;
    }

    if (!isDragging) return;
    event.preventDefault();

    const now = performance.now();
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    const dt = now - lastMoveTime || 16;
    const w = Math.min(dt / 16, 3);
    smoothVelX = smoothVelX * (1 - 0.3 * w) + (dx / dt) * 16 * 0.3 * w;
    smoothVelY = smoothVelY * (1 - 0.3 * w) + (dy / dt) * 16 * 0.3 * w;
    lastMoveTime = now;

    panX += dx;
    panY += dy;

    drawLightboxImage();
  });

  function startMomentum() {
    if (momentumId) cancelAnimationFrame(momentumId);
    const friction = 0.92;
    const minSpeed = 0.1;

    function tick() {
      velX *= friction;
      velY *= friction;

      if (Math.abs(velX) < minSpeed && Math.abs(velY) < minSpeed) {
        momentumId = null;
        return;
      }

      panX += velX;
      panY += velY;
      drawLightboxImage();
      momentumId = requestAnimationFrame(tick);
    }

    momentumId = requestAnimationFrame(tick);
  }

  function removePointer(event) {
    const idx = evCache.findIndex((e) => e.pointerId === event.pointerId);
    if (idx !== -1) evCache.splice(idx, 1);

    if (evCache.length < 2) {
      prevPinchDist = -1;
    }
    if (evCache.length === 0) {
      isDragging = false;
      frame.classList.remove("lightbox__frame--grabbing");

      const stale = performance.now() - lastMoveTime > 60;
      if (
        !stale &&
        lastPointerType === "touch" &&
        (Math.abs(smoothVelX) > 0.3 || Math.abs(smoothVelY) > 0.3)
      ) {
        velX = smoothVelX;
        velY = smoothVelY;
        startMomentum();
      }
      smoothVelX = 0;
      smoothVelY = 0;
    }
  }

  frame.addEventListener("pointerup", removePointer);
  frame.addEventListener("pointercancel", removePointer);
  frame.addEventListener("pointerleave", removePointer);
}
