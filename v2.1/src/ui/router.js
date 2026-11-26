const pages = ['overview', 'workout', 'food', 'nutrition', 'apple-health'];

export function initRouter({ onPageChange } = {}) {
  const sections = [...document.querySelectorAll('[data-page]')];
  const links = [...document.querySelectorAll('[data-nav]')];
  let current = null;

  function navigate() {
    let page = location.hash.slice(2);
    if (!pages.includes(page)) {
      page = 'overview';
      if (location.hash !== '#/overview') history.replaceState(null, '', '#/overview');
    }
    sections.forEach(section => { section.hidden = section.dataset.page !== page; });
    links.forEach(link => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (current !== page) {
      current = page;
      onPageChange?.(page);
      const title = document.querySelector(`[data-page="${page}"] [data-page-title]`);
      title?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  window.addEventListener('hashchange', navigate);
  document.querySelector('.skip[href="#main"]')?.addEventListener('click', event => {
    event.preventDefault();
    const main = document.querySelector('#main');
    main?.focus({ preventScroll: true });
    main?.scrollIntoView({ block: 'start' });
  });
  navigate();
  return { navigate, get page() { return current; } };
}
