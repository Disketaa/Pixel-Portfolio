import { slug, clamp } from "./utils.js";

let scrollSpyUpdate = null;
let tagSections = [];
let tagMaxScroll = 0;
let scrollTicking = false;
let scrollIdleTimer = null;

const HEADER_SCROLL_RANGE = 140;

const headerEl = document.querySelector(".site-header");

function updateHeader() {
  if (!headerEl) return;
  const p = Math.min(window.scrollY / HEADER_SCROLL_RANGE, 1);
  headerEl.style.setProperty("--p", p);
}

function setupScrollSpy(nav, headings) {
  const links = Array.from(nav.querySelectorAll(".header-tag"));
  if (!links.length) return;
  if (!headings.length) return;

  scrollSpyUpdate = function update() {
    const offset = 90;
    let activeId = headings[0].id;
    for (const h of headings) {
      if (h.getBoundingClientRect().top - offset <= 0) activeId = h.id;
      else break;
    }
    for (const link of links) {
      link.classList.toggle("is-active", link.dataset.target === activeId);
    }
  };
  scrollSpyUpdate();
}

function cacheTagSections(headings) {
  tagSections = [];
  const tags = document.querySelectorAll(".header-tag");
  if (!tags.length) return;
  const docTopOf = (el) => el.getBoundingClientRect().top + window.scrollY;
  tagMaxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  for (const link of tags) {
    const el = document.getElementById(link.dataset.target);
    if (!el) continue;
    const top = docTopOf(el);
    let nextTop = null;
    for (const h of headings) {
      if (h === el) continue;
      const ht = docTopOf(h);
      if (ht > top && (nextTop === null || ht < nextTop)) nextTop = ht;
    }
    const bottom =
      nextTop !== null ? nextTop : document.documentElement.scrollHeight;
    tagSections.push({ link, top, bottom });
  }
}

function updateTagProgress() {
  if (!tagSections.length) return;
  const scrollY = window.scrollY;
  const vh = window.innerHeight;
  for (const s of tagSections) {
    const startY = s.top - vh;
    const endY = Math.min(s.bottom, tagMaxScroll);
    const denom = endY - startY;
    let progress = 0;
    if (denom > 0) {
      progress = clamp((scrollY - startY) / denom, 0, 1);
    }
    s.link.style.setProperty("--progress", progress.toFixed(4));
  }
}

function onScrollFrame() {
  scrollTicking = false;
  document.documentElement.classList.add("is-scrolling");
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    document.documentElement.classList.remove("is-scrolling");
  }, 150);
  if (typeof scrollSpyUpdate === "function") scrollSpyUpdate();
  updateHeader();
  updateTagProgress();
}

export function renderHeaderTags(orderedSections) {
  const tags = document.getElementById("header-tags");
  if (!tags) return;
  tags.innerHTML = "";
  const frag = document.createDocumentFragment();
  const seenSubs = new Set();

  for (const { folder, sub } of orderedSections) {
    if (sub && !seenSubs.has(`${folder}::${sub}`)) {
      seenSubs.add(`${folder}::${sub}`);
      const link = document.createElement("a");
      link.className = "header-tag";
      link.href = `#section-${slug(sub)}`;
      link.dataset.target = `section-${slug(sub)}`;

      const fill = document.createElement("span");
      fill.className = "header-tag__fill";
      const label = document.createElement("span");
      label.className = "header-tag__label";
      label.textContent = sub;
      link.appendChild(fill);
      link.appendChild(label);

      frag.appendChild(link);
    }
  }

  tags.appendChild(frag);
  const headings = Array.from(
    document.querySelectorAll(".section-heading[id]"),
  );
  setupScrollSpy(tags, headings);
  cacheTagSections(headings);
  updateTagProgress();
}

export function initHeaderScroll() {
  const headerTagsArrow = document.getElementById("header-tags-arrow");
  if (headerTagsArrow) {
    headerTagsArrow.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  updateHeader();

  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScrollFrame);
      }
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    updateHeader();
    cacheTagSections(
      Array.from(document.querySelectorAll(".section-heading[id]")),
    );
    updateTagProgress();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      updateHeader();
    });
  }
}
