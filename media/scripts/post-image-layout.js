(function () {
  'use strict';

  var content = document.getElementById('post-content');
  if (!content) return;

  function isWhitespaceText(node) {
    return node.nodeType === 3 && !node.textContent.trim();
  }

  function isImageOnlyBlock(element) {
    if (!element || element.parentElement !== content) return false;
    if (element.matches('pre, table, blockquote, ul, ol, .link-card')) return false;

    var images = element.querySelectorAll('img:not([no-view])');
    if (images.length !== 1) return false;

    var image = images[0];
    if (image.closest('pre, code, table, .link-card')) return false;

    if (element.tagName === 'FIGURE') {
      return Array.prototype.every.call(element.childNodes, function (node) {
        if (isWhitespaceText(node)) return true;
        if (node.nodeType !== 1) return false;
        return node.tagName === 'IMG' || node.tagName === 'A' || node.tagName === 'FIGCAPTION';
      });
    }

    if (element.tagName !== 'P') return false;
    return Array.prototype.every.call(element.childNodes, function (node) {
      if (isWhitespaceText(node)) return true;
      if (node.nodeType !== 1) return false;
      return node.tagName === 'IMG' || (node.tagName === 'A' && node.querySelectorAll('img').length === 1 && !node.textContent.trim());
    });
  }

  function markSingle(block) {
    block.classList.add('post-image-single');
  }

  function makeGallery(blocks) {
    var shell = document.createElement('div');
    shell.className = 'post-image-gallery-shell';

    var gallery = document.createElement('div');
    gallery.className = 'post-image-gallery';
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-label', blocks.length + ' 张文章图片');

    var count = document.createElement('span');
    count.className = 'post-image-gallery-count';
    count.setAttribute('aria-hidden', 'true');
    count.innerHTML = '<i class="ri-gallery-line"></i><b>' + blocks.length + '</b>';

    var previous = document.createElement('button');
    previous.className = 'post-image-gallery-nav post-image-gallery-nav-prev';
    previous.type = 'button';
    previous.setAttribute('aria-label', '查看上一张图片');
    previous.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';

    var next = document.createElement('button');
    next.className = 'post-image-gallery-nav post-image-gallery-nav-next';
    next.type = 'button';
    next.setAttribute('aria-label', '查看下一张图片');
    next.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

    blocks[0].before(shell);
    shell.appendChild(gallery);
    shell.appendChild(previous);
    shell.appendChild(next);
    shell.appendChild(count);
    blocks.forEach(function (block) {
      block.classList.add('post-image-gallery-item');
      gallery.appendChild(block);
    });

    function updateNavigation() {
      var remaining = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
      shell.classList.toggle('is-static', remaining <= 1);
      previous.disabled = gallery.scrollLeft <= 1;
      next.disabled = gallery.scrollLeft >= remaining - 1;
    }

    function move(direction) {
      var item = gallery.querySelector('.post-image-gallery-item');
      var gap = parseFloat(window.getComputedStyle(gallery).gap) || 0;
      var distance = item ? item.getBoundingClientRect().width + gap : gallery.clientWidth * .8;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gallery.scrollBy({ left: direction * distance, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    previous.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    gallery.addEventListener('scroll', updateNavigation, { passive: true });
    window.addEventListener('resize', updateNavigation);
    window.addEventListener('load', updateNavigation, { once: true });
    if (window.ResizeObserver) new ResizeObserver(updateNavigation).observe(gallery);
    window.requestAnimationFrame(updateNavigation);
  }

  var runs = [];
  var current = [];

  Array.prototype.forEach.call(content.children, function (element) {
    if (isImageOnlyBlock(element)) {
      current.push(element);
      return;
    }
    if (current.length) runs.push(current);
    current = [];
  });
  if (current.length) runs.push(current);

  runs.forEach(function (blocks) {
    if (blocks.length === 1) markSingle(blocks[0]);
    else makeGallery(blocks);
  });
})();
