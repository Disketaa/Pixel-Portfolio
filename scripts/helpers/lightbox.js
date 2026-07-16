let frame;
let lightboxEl;
let lightboxCanvas;
let lightboxGifImg;
let lightboxClose;

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

let initialPinchDistance = null;
let initialZoomLevel = null;
let pinchCenterX = 0;
let pinchCenterY = 0;

function getFrameMetrics() {
  const cs = getComputedStyle(frame);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return {
    cw: frame.clientWidth - padX,
    ch: frame.clientHeight - padY,
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
  const { cw, ch } = getFrameMetrics();
  if (cw <= 0 || ch <= 0) return;

  const { dw, dh, ox, oy } = getImageFit(cw, ch, loadedLightboxImg);

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
  const { cw, ch } = getFrameMetrics();
  const { dw, dh, ox, oy } = getImageFit(cw, ch, loadedLightboxImg);

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
  resetView();
  isAnimating = false;
}

export function openLightbox(work, triggerEl, workList, index) {
  worksData = workList;
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;

  if (work.isAnimated) {
    lightboxCanvas.hidden = true;
    lightboxGifImg.hidden = false;
    lightboxGifImg.src = `assets/works/${work.file}`;
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
    img.src = `assets/works/${work.file}`;
    img.onload = () => {
      if (currentIndex !== index) return;
      initLightboxView(img);
    };
  }

  lightboxEl.hidden = false;
  document.body.style.overflow = "hidden";
  lightboxClose.focus();
}

export function navigateLightbox(direction) {
  const next = (currentIndex + direction + worksData.length) % worksData.length;
  openLightbox(worksData[next], null, worksData, next);
}

export function closeLightbox() {
  lightboxEl.hidden = true;
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
  resetView();
  isAnimating = false;
  isDragging = false;
  document.body.style.overflow = "";
  if (lastFocusedCard) lastFocusedCard.focus();
}

export function initLightbox(opts) {
  frame = opts.frame;
  lightboxEl = opts.lightbox;
  lightboxCanvas = opts.canvas;
  lightboxGifImg = opts.gifImg;
  lightboxClose = opts.close;

  lightboxClose.addEventListener("click", closeLightbox);
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
    "touchstart",
    (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        const rect = frame.getBoundingClientRect();
        const { cw, ch } = getFrameMetrics();

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

  frame.addEventListener("pointerup", () => {
    if (!isDragging) return;
    isDragging = false;
    frame.classList.remove("lightbox__frame--grabbing");
  });

  frame.addEventListener("pointerleave", () => {
    if (isDragging) {
      isDragging = false;
      frame.classList.remove("lightbox__frame--grabbing");
    }
  });
}
