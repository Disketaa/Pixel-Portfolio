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

function openLightbox(work, triggerEl, index) {
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;
  lightboxImage.src = `works/${work.file}`;
  lightboxImage.alt = work.title;
  lightboxTitle.textContent = work.title;
  lightboxData.textContent = `${work.width}\u00d7${work.height}px \u00b7 ${work.isAnimated ? 'animated' : 'static'} \u00b7 added ${work.addedAt}`;
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
  fetch('manifest.json')
    .then((response) => response.json())
    .then(render)
    .catch(() => {
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
    });
}

loadManifest();