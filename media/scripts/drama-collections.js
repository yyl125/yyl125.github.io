/* Public NeoDB collections: no token, item links, ratings, or visible item titles. */
(() => {
  'use strict';
  function button(label) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'drama-button';
    element.textContent = label;
    return element;
  }
  async function request(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function render(root, title, items, index, descriptionTemplate, supplementTemplate) {
    const heading = document.createElement('div');
    heading.className = 'drama-title good-title';
    heading.setAttribute('role', 'heading');
    heading.setAttribute('aria-level', '3');
    const info = document.createElement('div');
    info.className = 'item-info drama-info';
    const description = descriptionTemplate
      ? descriptionTemplate.cloneNode(true)
      : document.createElement('div');
    description.classList.add('good-note', 'drama-description');
    description.hidden = !description.textContent.trim();
    const supplement = supplementTemplate ? supplementTemplate.cloneNode(true) : document.createElement('p');
    supplement.classList.add('card-text');
    if (!supplementTemplate) {
      const small = document.createElement('small');
      small.className = 'text-gray-400';
      small.textContent = '\u00a0';
      supplement.append(small);
    }
    info.append(heading, description, supplement);
    root.classList.add('shelf-item');
    heading.textContent = title || '剧单';
    const stage = document.createElement('div');
    stage.className = 'drama-stage';
    const track = document.createElement('div');
    track.id = `drama-track-${index}`;
    track.className = 'drama-track';
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', `${heading.textContent}，${items.length} 张海报`);
    items.forEach(item => {
      const poster = document.createElement('div');
      poster.className = 'drama-poster shelf-item';
      const image = document.createElement('img');
      image.className = 'item-cover';
      image.alt = ''; // 海报只作为视觉收藏，不输出名称。
      image.loading = 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      const missing = () => {
        const placeholder = document.createElement('span');
        placeholder.className = 'drama-missing';
        placeholder.textContent = '暂无海报';
        poster.replaceChildren(placeholder);
      };
      image.addEventListener('error', missing, { once: true });
      try {
        const url = new URL(item.cover_image_url);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid image');
        image.src = url.href;
        poster.append(image);
      } catch (_) { missing(); }
      track.append(poster);
    });
    // 单项目的两张叠层仅作装饰，不计入条目数量或参与交互。
    if (items.length === 1) {
      for (let layer = 0; layer < 2; layer++) {
        const ghost = track.firstElementChild.cloneNode(true);
        ghost.classList.add('drama-poster-placeholder');
        ghost.setAttribute('aria-hidden', 'true');
        track.append(ghost);
      }
    }
    const compactInteraction = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
    const originalPosters = Array.from(track.children);
    let activePoster = 0;
    let gesture = null;
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.setAttribute('aria-controls', track.id);
    indicator.className = 'drama-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.hidden = items.length < 2;
    const ticks = document.createElement('span');
    ticks.className = 'drama-indicator-track';
    const tickCount = 3;
    for (let tick = 0; tick < tickCount; tick++) ticks.append(document.createElement('i'));
    const position = document.createElement('span');
    indicator.append(ticks, position);
    const updateIndicator = () => {
      let current = activePoster;
      if (!compactInteraction.matches) {
        current = 0;
        if (track.classList.contains('is-expanded')) {
          const step = track.firstElementChild.getBoundingClientRect().width + 16;
          const atEnd = track.scrollWidth > track.clientWidth && track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
          current = atEnd ? items.length - 1 : Math.round(track.scrollLeft / step);
        }
      }
      current = Math.max(0, Math.min(items.length - 1, current));
      position.textContent = `${current + 1} / ${items.length}`;
      // 桌面端通过指针和焦点控制保持纯指示，不使用 disabled 改变颜色。
      indicator.tabIndex = compactInteraction.matches ? 0 : -1;
      indicator.setAttribute('aria-hidden', String(!compactInteraction.matches));
      indicator.setAttribute('aria-label', `第 ${current + 1} / ${items.length} 张海报，点击回到第一张`);
      Array.from(ticks.children).forEach((tick, index) => {
        tick.classList.toggle('is-active', index === 1);
        tick.classList.toggle('is-empty', (index === 0 && current === 0) || (index === 2 && current === items.length - 1));
      });
    };
    const toggle = button('展开');
    toggle.classList.add('drama-toggle');
    toggle.setAttribute('aria-controls', track.id);
    toggle.setAttribute('aria-expanded', 'false');
    const navigation = document.createElement('div');
    navigation.className = 'drama-navigation';
    navigation.hidden = true;
    const previous = button('←');
    const next = button('→');
    previous.setAttribute('aria-label', '上一张海报');
    next.setAttribute('aria-label', '下一张海报');
    navigation.append(previous, next);
    const update = () => {
      previous.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      updateIndicator();
    };
    const move = direction => track.scrollBy({ left: direction * (track.firstElementChild.getBoundingClientRect().width + 16), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', event => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); track.scrollLeft = event.key === 'Home' ? 0 : track.scrollWidth;
      } else if (event.key === 'Escape') { toggle.click(); toggle.focus(); }
    });
    let transitionAnimations = [];
    let transitionLayer = null;
    const clearTransition = () => {
      transitionAnimations.forEach(animation => animation.cancel());
      transitionAnimations = [];
      if (transitionLayer) transitionLayer.remove();
      transitionLayer = null;
    };
    const capturePosters = () => {
      const viewport = track.getBoundingClientRect();
      return originalPosters.map(poster => {
        const rect = poster.getBoundingClientRect();
        return {
          x: poster.offsetLeft - track.scrollLeft, y: poster.offsetTop,
          width: poster.offsetWidth,
          transform: getComputedStyle(poster).transform,
          visible: rect.width > 0 && rect.right > viewport.left && rect.left < viewport.right
        };
      });
    };
    const animatePosters = (before, expanded) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof track.animate !== 'function') return;
      const options = { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' };
      const animate = (element, frames) => {
        const animation = element.animate(frames, options);
        transitionAnimations.push(animation);
      };
      originalPosters.forEach((poster, index) => {
        const previousState = before[index];
        if (getComputedStyle(poster).display === 'none') {
          // 收起时让仍在视口内的后续海报淡出，避免突然消失。
          if (previousState.visible && !expanded) {
            if (!transitionLayer) {
              transitionLayer = document.createElement('div');
              transitionLayer.className = 'drama-transition-layer';
              transitionLayer.setAttribute('aria-hidden', 'true');
              artwork.append(transitionLayer);
            }
            const ghost = poster.cloneNode(true);
            Object.assign(ghost.style, { display: 'block', position: 'absolute', left: `${previousState.x}px`, top: `${previousState.y}px`, width: `${previousState.width}px`, transform: previousState.transform });
            transitionLayer.append(ghost);
            animate(ghost, [{ opacity: 1 }, { opacity: 0 }]);
          }
          return;
        }
        const finalTransform = getComputedStyle(poster).transform;
        const startTransform = previousState.visible
          ? `translate(${previousState.x - (poster.offsetLeft - track.scrollLeft)}px, ${previousState.y - poster.offsetTop}px) ${previousState.transform === 'none' ? '' : previousState.transform}`
          : `translate(12px, 0) ${finalTransform === 'none' ? '' : finalTransform}`;
        animate(poster, [
          { transform: startTransform, opacity: previousState.visible ? 1 : 0 },
          { transform: finalTransform, opacity: 1 }
        ]);
      });
      const layer = transitionLayer;
      Promise.allSettled(transitionAnimations.map(animation => animation.finished)).then(() => {
        if (layer) layer.remove();
        if (transitionLayer === layer) transitionLayer = null;
      });
    };
    toggle.addEventListener('click', () => {
      if (compactInteraction.matches) return;
      const before = capturePosters();
      clearTransition();
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? '收起' : '展开';
      root.classList.toggle('is-expanded', expanded);
      stage.classList.toggle('is-expanded', expanded);
      track.classList.toggle('is-expanded', expanded);
      navigation.hidden = !expanded;
      if (expanded) track.tabIndex = 0;
      else { track.removeAttribute('tabindex'); track.scrollLeft = 0; }
      animatePosters(before, expanded);
      update();
    });
    const artwork = document.createElement('div');
    artwork.className = 'drama-artwork';
    artwork.append(track, indicator, toggle, navigation);
    stage.append(artwork);
    root.classList.toggle('is-single', items.length === 1);
    if (items.length === 1) toggle.hidden = true;
    root.replaceChildren(stage, info);
    const syncInteraction = () => {
      clearTransition();
      if (compactInteraction.matches) {
        root.classList.remove('is-expanded');
        stage.classList.remove('is-expanded');
        track.classList.remove('is-expanded');
        track.removeAttribute('tabindex');
        track.scrollLeft = 0;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '展开';
        navigation.hidden = true;
      } else {
        originalPosters.forEach(poster => track.append(poster));
        activePoster = 0;
      }
      root.classList.toggle('is-touch', compactInteraction.matches);
      track.setAttribute('aria-label', `${heading.textContent}，${items.length} 张海报${compactInteraction.matches && items.length > 1 ? '，左右滑动切换' : ''}`);
      gesture = null;
      resetTouchStyles();
      update();
    };
    let touchAnimations = [];
    let touchSettling = false;
    let touchSequence = 0;
    let finishTouchMotion = null;
    let touchFrame = 0;
    let pendingTouchPose = null;
    let touchProgress = 0;
    let touchGeometry = null;
    const flushTouchPose = () => {
      if (touchFrame) cancelAnimationFrame(touchFrame);
      touchFrame = 0;
      if (pendingTouchPose) {
        const { direction, progress } = pendingTouchPose;
        pendingTouchPose = null;
        poseTouch(direction, progress);
      }
    };
    const warmedImages = new WeakSet();
    const resetTouchStyles = () => {
      const shift = track.clientWidth * .1;
      originalPosters.forEach((poster, index) => {
        ['transform', 'zIndex', 'display', 'left', 'opacity', 'visibility'].forEach(property => { poster.style[property] = ''; });
        if (compactInteraction.matches && items.length > 1) {
          const distance = index - activePoster;
          const previousCount = activePoster === items.length - 1 ? 2 : 1;
          const nextCount = activePoster === 0 ? 2 : 1;
          const visible = distance >= -previousCount && distance <= nextCount;
          const depth = Math.min(2, Math.abs(distance));
          poster.style.display = 'block';
          poster.style.visibility = visible ? 'visible' : 'hidden';
          poster.style.left = '10%';
          poster.style.zIndex = String(3 - depth);
          poster.style.transform = `translateX(${shift * distance}px) scale(${depth === 0 ? 1 : depth === 1 ? .94 : .88}) rotate(${distance === 0 ? 0 : Math.sign(distance) * (depth === 1 ? 3 : 5)}deg)`;
          // 稳定节点，预先解码即将浏览的图片，减少首次入场时的空白。
          if (Math.abs(distance) <= 2) {
            const image = poster.querySelector('img');
            if (image && !warmedImages.has(image)) {
              warmedImages.add(image);
              image.loading = 'eager';
              if (typeof image.decode === 'function') image.decode().catch(() => {});
            }
          }
        }
      });
    };
    const cancelTouchMotion = () => {
      touchSequence++;
      finishTouchMotion = null;
      if (touchFrame) cancelAnimationFrame(touchFrame);
      touchFrame = 0;
      pendingTouchPose = null;
      touchAnimations.forEach(animation => animation.cancel());
      touchAnimations = [];
      touchSettling = false;
      resetTouchStyles();
      gesture = null;
    };
    const canMoveTouch = direction => activePoster + direction >= 0 && activePoster + direction < items.length;
    const poseTouch = (direction, progress) => {
      const front = originalPosters[activePoster];
      const second = originalPosters[activePoster + 1];
      const third = originalPosters[activePoster + 2];
      const width = touchGeometry ? touchGeometry.width : front.offsetWidth;
      const shift = touchGeometry ? touchGeometry.shift : track.clientWidth * .1;
      if (!canMoveTouch(direction)) {
        // 首尾仅做轻微阻尼回弹，不借用另一端的海报。
        front.style.transform = `translateX(${-direction * width * .12 * progress}px)`;
        return;
      }
      if (direction === 1) {
        front.style.transform = `translateX(${-shift * progress}px) scale(${1 - .06 * progress}) rotate(${-3 * progress}deg)`;
        front.style.zIndex = '3';
        // 下一张逐渐接管前景，避免拖动到固定阈值时突然换层。
        if (second) { second.style.zIndex = '4'; second.style.opacity = String(progress); }
        if (second) second.style.transform = `translateX(${shift * (1 - progress)}px) scale(${.94 + .06 * progress}) rotate(${3 * (1 - progress)}deg)`;
        if (third) third.style.transform = `translateX(${shift * (2 - progress)}px) scale(${.88 + .06 * progress}) rotate(${5 - 2 * progress}deg)`;
      } else {
        const incoming = originalPosters[activePoster - 1];
        incoming.style.display = 'block';
        incoming.style.left = '10%';
        incoming.style.visibility = 'visible';
        incoming.style.zIndex = '4';
        incoming.style.opacity = String(progress);
        incoming.style.transform = `translateX(${-shift * (1 - progress)}px) scale(${.94 + .06 * progress}) rotate(${-3 * (1 - progress)}deg)`;
        front.style.transform = `translateX(${shift * progress}px) scale(${1 - .06 * progress}) rotate(${3 * progress}deg)`;
        if (second && second !== incoming) second.style.transform = `translateX(${shift * (1 + progress)}px) scale(${.94 - .06 * progress}) rotate(${3 + 2 * progress}deg)`;
      }
    };
    const settleTouch = (direction, commit) => {
      commit = commit && canMoveTouch(direction);
      const sequence = ++touchSequence;
      touchSettling = true;
      // 让前后叠层一起到达最终布局，包括本次入场和退场的外围海报。
      const targetIndex = commit ? activePoster + direction : activePoster;
      const participants = originalPosters.filter((poster, index) => Math.abs(index - activePoster) <= 3 || Math.abs(index - targetIndex) <= 3);
      const before = new Map(participants.map(poster => {
        const style = getComputedStyle(poster);
        return [poster, { transform: style.transform, opacity: style.opacity, zIndex: style.zIndex, visible: style.visibility !== 'hidden' }];
      }));
      const previousIndex = activePoster;
      if (commit) activePoster += direction;
      resetTouchStyles();
      const targets = participants.map(poster => {
        const style = getComputedStyle(poster);
        return { poster, transform: style.transform, zIndex: style.zIndex, visible: style.visibility !== 'hidden' };
      });
      activePoster = previousIndex;
      // 显隐由动画的透明度衔接，结束后再提交最终 visibility。
      const incomingPoster = canMoveTouch(direction) ? originalPosters[previousIndex + direction] : null;
      targets.forEach(({ poster, visible }) => {
        if (visible || before.get(poster).visible) poster.style.visibility = 'visible';
        // 接牌层在完整过渡期间保持前景，最终再恢复叠放层级。
        if (poster === incomingPoster) poster.style.zIndex = '4';
      });
      const finish = () => {
        if (sequence !== touchSequence) return;
        touchSequence++;
        finishTouchMotion = null;
        if (commit) {
          activePoster += direction;
        }
        resetTouchStyles();
        touchAnimations.forEach(animation => animation.cancel());
        touchAnimations = [];
        touchSettling = false;
        track.setAttribute('aria-label', `${heading.textContent}，第 ${activePoster + 1} / ${items.length} 张海报，左右滑动切换`);
        updateIndicator();
      };
      finishTouchMotion = finish;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof track.animate !== 'function') { finish(); return; }
      targets.forEach(({ poster, transform, zIndex, visible }) => {
        const start = before.get(poster);
        if (!start.visible && !visible) return;
        if (start.transform === transform && start.visible === visible && start.zIndex === zIndex) return;
        const isIncoming = poster === incomingPoster;
        const motionZ = isIncoming ? '4' : start.zIndex;
        touchAnimations.push(poster.animate([
          { transform: start.transform, opacity: start.visible ? Number(start.opacity) : 0, zIndex: motionZ },
          { transform, opacity: isIncoming ? (commit ? 1 : 0) : (visible ? 1 : 0), zIndex: motionZ }
        ], { duration: commit ? Math.round(260 + 80 * (1 - touchProgress)) : 240, easing: 'cubic-bezier(.25, .8, .25, 1)', fill: 'both' }));
      });
      Promise.allSettled(touchAnimations.map(animation => animation.finished)).then(finish);
    };
    indicator.addEventListener('pointerup', event => {
      if (compactInteraction.matches && event.pointerType === 'touch') indicator.blur();
    });
    indicator.addEventListener('click', () => {
      if (!compactInteraction.matches || items.length < 2) return;
      if (touchSettling && finishTouchMotion) finishTouchMotion();
      if (activePoster === 0) return;
      if (touchFrame) cancelAnimationFrame(touchFrame);
      touchFrame = 0;
      pendingTouchPose = null;
      gesture = null;
      resetTouchStyles();
      touchProgress = 0;
      settleTouch(-activePoster, true);
    });
    let scrollGesture = null;
    track.addEventListener('touchstart', event => {
      if (!compactInteraction.matches || items.length < 2 || event.touches.length !== 1) { scrollGesture = null; return; }
      const touch = event.touches[0];
      scrollGesture = { x: touch.clientX, y: touch.clientY, axis: null };
    }, { passive: true });
    track.addEventListener('touchmove', event => {
      if (!scrollGesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - scrollGesture.x);
      const dy = Math.abs(touch.clientY - scrollGesture.y);
      if (!scrollGesture.axis && Math.max(dx, dy) >= 6) scrollGesture.axis = dx > dy * 1.25 ? 'x' : 'y';
      if (scrollGesture.axis === 'x' && event.cancelable) event.preventDefault();
    }, { passive: false });
    const clearScrollGesture = () => { scrollGesture = null; };
    track.addEventListener('touchend', clearScrollGesture, { passive: true });
    track.addEventListener('touchcancel', clearScrollGesture, { passive: true });
    track.addEventListener('pointerdown', event => {
      if (!compactInteraction.matches || items.length < 2 || event.pointerType !== 'touch' || !event.isPrimary) return;
      if (touchSettling && finishTouchMotion) finishTouchMotion();
      touchGeometry = { width: originalPosters[activePoster].offsetWidth, shift: track.clientWidth * .1 };
      touchProgress = 0;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, direction: 0 };
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      const direction = dx < 0 ? 1 : -1;
      if (gesture.direction !== direction) {
        if (touchFrame) cancelAnimationFrame(touchFrame);
        touchFrame = 0;
        pendingTouchPose = null;
        resetTouchStyles();
      }
      gesture.direction = direction;
      const progress = Math.min(.95, Math.abs(dx) / (touchGeometry.width * 1.1));
      touchProgress = progress;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pendingTouchPose = { direction, progress };
        if (!touchFrame) touchFrame = requestAnimationFrame(flushTouchPose);
      }
    });
    track.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      const direction = dx < 0 ? 1 : -1;
      const moved = gesture.direction !== 0;
      flushTouchPose();
      gesture = null;
      const commit = canMoveTouch(direction) && Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy) * 1.25;
      if (!commit && !moved) return;
      if (commit && !moved && !matchMedia('(prefers-reduced-motion: reduce)').matches) poseTouch(direction, 0);
      settleTouch(direction, commit);
    });
    track.addEventListener('pointercancel', () => {
      if (!gesture) return;
      const direction = gesture.direction;
      flushTouchPose();
      gesture = null;
      if (direction) settleTouch(direction, false);
      else resetTouchStyles();
    });
    compactInteraction.addEventListener('change', cancelTouchMotion);
    compactInteraction.addEventListener('change', syncInteraction);
    syncInteraction();
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
  }
  document.querySelectorAll('[data-collection-url]').forEach((root, index) => {
    // 在加载状态替换内容前保存模板中的 good-note，重试时也能保留。
    const descriptionTemplate = root.querySelector('.good-note');
    const supplementTemplate = root.querySelector('.card-text');
    async function load() {
      root.setAttribute('aria-busy', 'true');
      const status = document.createElement('p');
      status.className = 'drama-status';
      status.setAttribute('role', 'status');
      status.textContent = '正在加载剧单…';
      root.replaceChildren(status);
      try {
        const source = new URL(root.dataset.collectionUrl);
        const match = source.pathname.match(/^\/collection\/([A-Za-z0-9]+)\/?$/);
        if (source.origin !== 'https://neodb.social' || !match) throw new Error('Invalid collection URL');
        const base = `${source.origin}/api/collection/${match[1]}`;
        const metadata = await request(base);
        const items = [], seen = new Set();
        for (let page = 1, pages = 1; page <= pages; page++) {
          const payload = await request(`${base}/item/?page=${page}`);
          if (!Array.isArray(payload.data) || !Number.isInteger(payload.pages) || payload.pages < 0) throw new Error('Invalid collection data');
          pages = payload.pages;
          payload.data.forEach(entry => {
            const item = entry.item;
            if (!item || !['movie', 'tv'].includes(item.category)) return;
            const key = item.uuid || item.id;
            if (!key || seen.has(key)) return;
            seen.add(key); items.push(item);
          });
        }
        if (items.length) render(root, metadata.title, items, index, descriptionTemplate, supplementTemplate);
        else status.textContent = '这个剧单暂时没有电影或剧集。';
      } catch (error) {
        status.textContent = '剧单加载失败，请稍后重试。';
        const retry = button('重试');
        retry.addEventListener('click', load);
        root.append(retry);
        console.warn('NeoDB 剧单加载失败', error);
      } finally { root.setAttribute('aria-busy', 'false'); }
    }
    load();
  });
})();
