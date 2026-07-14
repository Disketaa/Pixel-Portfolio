const grid = document.getElementById('grid');
const emptyState = document.getElementById('empty-state');
const workCount = document.getElementById('work-count');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');

const lightboxData = document.getElementById('lightbox-data');
const lightboxClose = document.getElementById('lightbox-close');

let lastFocusedCard = null;
let currentIndex = -1;
let worksData = [];

function buildCard(work, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open ${work.file}`);
  card.dataset.index = index;

  const img = document.createElement('img');
  img.src = `works/${work.file}`;
  img.alt = work.file;
  img.loading = 'lazy';
  img.decoding = 'async';

  if (work.isAnimated) {
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = 'gif';
    card.appendChild(badge);
  }

  card.appendChild(img);
  return card;
}

function openLightbox(work, triggerEl, index) {
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;
  lightboxImage.src = `works/${work.file}`;
  lightboxImage.alt = work.file;
  lightboxData.textContent = `${work.width}\u00d7${work.height}px \u00b7 ${work.isAnimated ? 'animated' : 'static'} \u00b7 added ${work.addedAt}`;
  lightboxImage.style.width = '';
  lightboxImage.style.height = '';

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