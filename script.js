const grid = document.getElementById('grid');
const emptyState = document.getElementById('empty-state');
const workCount = document.getElementById('work-count');
const lightbox = document.getElementById('lightbox');
const lightboxCanvas = document.getElementById('lightbox-image');
const lightboxData = document.getElementById('lightbox-data');
const lightboxClose = document.getElementById('lightbox-close');

let lastFocusedCard = null;
let currentIndex = -1;
let worksData = [];
let loadedLightboxImg = null;
let lightboxResizeObserver = null;

function buildCard(work, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open ${work.file}`);
  card.dataset.index = index;

  if (work.isAnimated) {
    const img = document.createElement('img');
    img.src = `works/${work.file}`;
    img.alt = work.file;
    img.loading = 'lazy';
    img.decoding = 'async';
    card.appendChild(img);
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = 'gif';
    card.appendChild(badge);
  } else {
    const canvas = document.createElement('canvas');
    canvas.className = 'card__canvas';
    canvas.width = work.width;
    canvas.height = work.height;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', work.file);
    const img = new Image();
    img.src = `works/${work.file}`;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
    };
    card.appendChild(canvas);
  }

  return card;
}

function drawLightboxImage() {
  if (!loadedLightboxImg) return;
  const frame = document.querySelector('.lightbox__frame');
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
    dw = cw; dh = cw / imgAspect;
    ox = 0; oy = (ch - dh) / 2;
  } else {
    dh = ch; dw = ch * imgAspect;
    ox = (cw - dw) / 2; oy = 0;
  }

  lightboxCanvas.width = cw;
  lightboxCanvas.height = ch;
  const ctx = lightboxCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(loadedLightboxImg, ox, oy, dw, dh);
}

function openLightbox(work, triggerEl, index) {
  currentIndex = index;
  if (triggerEl) lastFocusedCard = triggerEl;
  lightboxData.textContent = `${work.width}\u00d7${work.height}px \u00b7 ${work.isAnimated ? 'animated' : 'static'} \u00b7 added ${work.addedAt}`;

  const img = new Image();
  img.src = `works/${work.file}`;
  img.onload = () => {
    if (currentIndex !== index) return;
    loadedLightboxImg = img;
    drawLightboxImage();
    if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
    lightboxResizeObserver = new ResizeObserver(drawLightboxImage);
    lightboxResizeObserver.observe(document.querySelector('.lightbox__frame'));
  };

  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
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
  if (lightboxResizeObserver) lightboxResizeObserver.disconnect();
  loadedLightboxImg = null;
  const ctx = lightboxCanvas.getContext('2d');
  ctx.clearRect(0, 0, lightboxCanvas.width, lightboxCanvas.height);
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

document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('.card') || event.target.closest('.lightbox')) {
    event.preventDefault();
  }
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

  const cards = grid.querySelectorAll('.card');
  cards.forEach((card, i) => {
    card.style.setProperty('--enter-delay', `${i * 60}ms`);
    card.classList.add('card-enter');
  });

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