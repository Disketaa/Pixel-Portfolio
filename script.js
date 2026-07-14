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

function calcIntDims(nativeW, nativeH, maxW, maxH, threshold) {
  if (nativeW < 1 || nativeH < 1) return { w: 1, h: 1 };
  const up = Math.min(Math.floor(maxW / nativeW), Math.floor(maxH / nativeH));
  if (up >= 1) return { w: nativeW * up, h: nativeH * up };
  if (threshold && nativeW <= maxW * threshold && nativeH <= maxH * threshold) {
    return { w: nativeW, h: nativeH };
  }
  for (let div = 2; div <= 100; div++) {
    const w = Math.ceil(nativeW / div);
    const h = Math.ceil(nativeH / div);
    if (w <= maxW && h <= maxH) return { w, h };
  }
  return { w: 1, h: 1 };
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

  const root = document.documentElement;
  const zoom = parseFloat(getComputedStyle(root).getPropertyValue('--zoom-level')) || 180;
  const pad = parseFloat(getComputedStyle(root).getPropertyValue('--card-padding')) || 8;
  const content = zoom - pad * 2;
  const maxW = content * work.gridSpan.col;
  const maxH = content * work.gridSpan.row;
  const scale = calcIntDims(work.width, work.height, maxW, maxH, 1.3);
  img.style.width = `${scale.w}px`;
  img.style.height = `${scale.h}px`;

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
  const scale = calcIntDims(work.width, work.height, availW, availH);
  lightboxImage.style.width = `${scale.w}px`;
  lightboxImage.style.height = `${scale.h}px`;

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

loadManifest();