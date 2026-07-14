const grid = document.getElementById('grid');
const emptyState = document.getElementById('empty-state');
const workCount = document.getElementById('work-count');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxData = document.getElementById('lightbox-data');
const lightboxClose = document.getElementById('lightbox-close');

let lastFocusedCard = null;
let currentIndex = -1;
let worksData = [];

function calcIntDims(nativeW, nativeH, maxW, maxH) {
  if (nativeW < 1 || nativeH < 1) return { w: 1, h: 1 };

  const area = nativeW * nativeH;
  const cropCap = area < 1000 ? 0.10 : area < 50000 ? 0.15 : 0.25;

  const fit = Math.min(Math.floor(maxW / nativeW), Math.floor(maxH / nativeH));
  const fill = Math.max(Math.ceil(maxW / nativeW), Math.ceil(maxH / nativeH));

  if (fill <= fit) return { w: nativeW * fill, h: nativeH * fill };

  if (fit >= 1) {
    for (let s = fill; s >= fit; s--) {
      const w = nativeW * s;
      const h = nativeH * s;
      const cw = Math.max(0, w - maxW) / w;
      const ch = Math.max(0, h - maxH) / h;
      if (cw <= cropCap && ch <= cropCap) return { w, h };
    }
    return { w: nativeW * fit, h: nativeH * fit };
  }

  for (let div = 1; div <= 100; div++) {
    const w = Math.ceil(nativeW / div);
    const h = Math.ceil(nativeH / div);
    const cw = Math.max(0, w - maxW) / w;
    const ch = Math.max(0, h - maxH) / h;
    if (cw <= cropCap && ch <= cropCap) return { w, h };
  }

  for (let div = 2; div <= 100; div++) {
    const w = Math.ceil(nativeW / div);
    const h = Math.ceil(nativeH / div);
    if (w <= maxW && h <= maxH) return { w, h };
  }
  return { w: 1, h: 1 };
}

function clampSpan(value) {
  return Math.min(value, 2);
}

function buildCard(work, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open ${work.title}`);
  card.dataset.index = index;

  card.style.setProperty('--col-desktop', work.gridSpan.col);
  card.style.setProperty('--row-desktop', work.gridSpan.row);
  card.style.setProperty('--col-mobile', clampSpan(work.gridSpan.col));
  card.style.setProperty('--row-mobile', clampSpan(work.gridSpan.row));
  card.style.setProperty('--aspect-ratio', work.ratio);

  const frame = document.createElement('div');
  frame.className = 'card__frame';

  const img = document.createElement('img');
  img.src = `works/${work.file}`;
  img.alt = work.title;
  img.loading = 'lazy';
  img.decoding = 'async';

  frame.appendChild(img);

  if (work.isAnimated) {
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = 'gif';
    frame.appendChild(badge);
  }

  const label = document.createElement('span');
  label.className = 'card__label';
  label.textContent = work.title;

  card.append(frame, label);
  return card;
}

function sizeCard(card) {
  const idx = parseInt(card.dataset.index, 10);
  const work = worksData[idx];
  if (!work) return;
  const frame = card.querySelector('.card__frame');
  const img = card.querySelector('img');
  if (!frame || !img) return;
  const maxW = frame.clientWidth;
  const maxH = frame.clientHeight;
  if (maxW < 1 || maxH < 1) return;
  const dims = calcIntDims(work.width, work.height, maxW, maxH);
  img.style.width = `${dims.w}px`;
  img.style.height = `${dims.h}px`;
}

function sizeAllCards() {
  document.querySelectorAll('.card').forEach(sizeCard);
}

function openLightbox(work, triggerEl, index) {
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;
  lightboxImage.src = `works/${work.file}`;
  lightboxImage.alt = work.title;
  lightboxTitle.textContent = work.title;
  lightboxData.textContent = `${work.width}\u00d7${work.height}px \u00b7 ${work.isAnimated ? 'animated' : 'static'} \u00b7 added ${work.addedAt}`;

  const root = document.documentElement;
  const framePad = parseFloat(getComputedStyle(root).getPropertyValue('--lightbox-frame-padding')) || 24;
  const availH = window.innerHeight * 0.72 - framePad * 2;
  const panelW = Math.min(window.innerWidth * 0.96, parseFloat(getComputedStyle(root).getPropertyValue('--lightbox-max-width')) || 1400);
  const availW = panelW - framePad * 2;
  const dims = calcIntDims(work.width, work.height, availW, availH);
  lightboxImage.style.width = `${dims.w}px`;
  lightboxImage.style.height = `${dims.h}px`;

  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function navigateLightbox(direction) {
  const next = currentIndex + direction;
  if (next >= 0 && next < worksData.length) {
    openLightbox(worksData[next], null, next);
  }
}

function handleCardActivation(card) {
  const index = parseInt(card.dataset.index, 10);
  if (!isNaN(index) && worksData[index]) {
    openLightbox(worksData[index], card, index);
  }
}

grid.addEventListener('click', (event) => {
  const card = event.target.closest('.card');
  if (card) handleCardActivation(card);
});

grid.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const card = event.target.closest('.card');
    if (card) {
      event.preventDefault();
      handleCardActivation(card);
    }
  }
});

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = '';
  document.body.style.overflow = '';
  if (lastFocusedCard) lastFocusedCard.focus();
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.querySelector('.lightbox__backdrop').addEventListener('click', closeLightbox);
document.addEventListener('keydown', (event) => {
  if (lightbox.hidden) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') navigateLightbox(-1);
  if (event.key === 'ArrowRight') navigateLightbox(1);
});

function render(works) {
  worksData = works;
  if (!works.length) {
    emptyState.hidden = false;
    grid.hidden = true;
    workCount.textContent = 'no works yet';
    return;
  }

  const fragment = document.createDocumentFragment();
  works.forEach((work, index) => fragment.appendChild(buildCard(work, index)));
  grid.appendChild(fragment);
  sizeAllCards();

  const label = works.length === 1 ? 'piece' : 'pieces';
  workCount.textContent = `${works.length} ${label} on the wall`;
}

function loadManifest() {
  const inline = document.getElementById('manifest-data');
  if (inline) {
    try {
      render(JSON.parse(inline.textContent));
    } catch (_) {
      render([]);
    }
  } else {
    render([]);
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(sizeAllCards, 120);
});

loadManifest();