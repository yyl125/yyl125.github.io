/* Keep DOM order; place each card at the earliest available horizontal position. */
(function () {
  'use strict';
  const desktop = window.matchMedia('(min-width: 576px)');
  document.querySelectorAll('.card-columns').forEach(function (container) {
    const cards = Array.from(container.children).filter(function (card) {
      return card.classList.contains('card');
    });
    let frame = 0;
    function layout() {
      frame = 0;
      if (!desktop.matches) {
        container.classList.remove('is-masonry');
        container.style.removeProperty('height');
        cards.forEach(function (card) {
          ['width', 'left', 'top'].forEach(function (name) { card.style.removeProperty(name); });
        });
        return;
      }
      const style = getComputedStyle(container);
      const left = parseFloat(style.paddingLeft) || 0;
      const right = parseFloat(style.paddingRight) || 0;
      const top = parseFloat(style.paddingTop) || 0;
      const bottom = parseFloat(style.paddingBottom) || 0;
      const gap = parseFloat(style.columnGap) || 0;
      const verticalGap = parseFloat(getComputedStyle(document.documentElement).fontSize) * .75;
      const width = (container.clientWidth - left - right - gap * 2) / 3;
      if (width <= 0) return;
      container.classList.add('is-masonry');
      cards.forEach(function (card) { card.style.width = width + 'px'; });
      // Read heights together after assigning widths, including unloaded image placeholders.
      const heights = cards.map(function (card) { return card.getBoundingClientRect().height; });
      const ends = [top, top, top];
      let previousTop = top;
      let previousColumn = -1;
      cards.forEach(function (card, index) {
        let nextTop = Infinity;
        let nextColumn = 0;
        ends.forEach(function (end, column) {
          // A same-height card must appear to the right of its predecessor.
          const candidate = Math.max(end, previousTop + (column <= previousColumn ? verticalGap : 0));
          if (candidate < nextTop) { nextTop = candidate; nextColumn = column; }
        });
        card.style.left = (left + nextColumn * (width + gap)) + 'px';
        card.style.top = nextTop + 'px';
        ends[nextColumn] = nextTop + heights[index] + verticalGap;
        previousTop = nextTop;
        previousColumn = nextColumn;
      });
      const height = cards.length ? Math.max.apply(null, ends) - verticalGap + bottom : top + bottom;
      container.style.height = height + 'px';
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(layout);
    }
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(container);
      cards.forEach(function (card) { observer.observe(card); });
    }
    container.addEventListener('load', schedule, true);
    container.addEventListener('error', schedule, true);
    window.addEventListener('resize', schedule);
    if (document.fonts) document.fonts.ready.then(schedule);
    layout();
  });
})();
