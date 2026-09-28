/* =====================================================================
   MY Diners — page behaviour
   ---------------------------------------------------------------------
   The loader lives in loader.js and the hero's goo in hero.js;
   nothing here touches either.
   Below it:

     about      the paragraph assembles letter by letter as you scroll:
                each letter grows out of a dot in its own place
     biryani    one dish, carried down the page from About into the
                carousel's first slot, the way naughtyberry's cup travels
     specials   a 3D carousel. The dish in front leans toward the
                pointer; the others wait, small and faint, at the edges
     spiral     a line of type running along a band over the marble
     reviews    the word and Masala Bhai hold still; star cards pop in
                one by one and stick in their slots around him
     occasions  the statement fills in word by word
     visit      the route between the two tables draws itself
   ===================================================================== */
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motion  = !reduced && window.gsap && window.ScrollTrigger;

  /* --- small things ------------------------------------------------ */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* the local time in the restaurants */
  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' });
  const footClock = $('#footClock');
  const tick = () => {
    const t = fmt.format(new Date());
    if (clock) clock.textContent = t;
    if (footClock) footClock.textContent = t;
  };
  if (clock || footClock) { tick(); setInterval(tick, 15000); }

  /* the footer's sign-off: one span per letter, so each can hop */
  const footWord = $('.foot__word');
  if (footWord) {
    footWord.innerHTML = footWord.textContent.split('').map(c =>
      c === ' ' ? '<span class="fl fl--gap" aria-hidden="true"></span>' : `<span class="fl" aria-hidden="true"><span>${c}</span></span>`).join('');
  }

  /* the drifting row of occasions loops, so it is doubled */
  const track = $('.rail__track');
  if (track && !reduced) {
    $$('.occ', track).forEach(c => {
      const copy = c.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    });
  }

  /* FAQ: one open at a time */
  $$('.qa').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) $$('.qa').forEach(o => { if (o !== d) o.open = false; });
  }));

  /* menu tabs */
  const tabs = $$('.menu__tabs button');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.tab;
    tabs.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    $$('.menu__list').forEach(l => {
      const on = l.dataset.list === name;
      l.classList.toggle('is-on', on);
      if (on && motion) {
        gsap.fromTo($$('li', l), { yPercent: 70, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: 0.05 });
      }
    });
  }));

  /* things that lean toward the pointer */
  function lean(el, target, deg) {
    if (!el || reduced || !fine) return;
    el.addEventListener('pointermove', e => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      (target() || el).style.transform = `perspective(900px) rotateY(${x * deg}deg) rotateX(${-y * deg}deg)`;
    });
    el.addEventListener('pointerleave', () => { const t = target() || el; t.style.transform = ''; });
  }
  lean($('#menuCard'), () => $('#menuCard'), 10);

  /* buttons that pull toward the pointer */
  if (fine && !reduced) {
    $$('.btn--solid, .car__nav').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.25}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  /* ================================================================
     SPECIALS — the 3D carousel
     ================================================================ */
  const car = $('#car');
  if (car) {
    const items = $$('.car__item', car);
    const n = items.length;
    const name = $('#carName'), desc = $('#carDesc'), price = $('#carPrice');
    const idx = $('#carIdx'), total = $('#carTotal'), bar = $('#carBar');
    let active = 0, lastDir = -1;

    total.textContent = String(n).padStart(2, '0');

    /* where each dish stands relative to the one in front */
    const offsetOf = i => {
      let o = i - active;
      if (n > 2) { o = ((o % n) + n) % n; if (o > n / 2) o -= n; }
      else if (o !== 0) o = -lastDir;          // with two, the other waits on the side it left by
      return o;
    };

    /* the neighbours are hints, not rivals: half size, faint, and far
       enough out to leave clear space around the dish in front. On a
       phone there is no room for them at all. */
    function layout() {
      const phone = innerWidth <= 720;
      const gap = Math.min(innerWidth * 0.4, 600);
      items.forEach((it, i) => {
        const o = offsetOf(i), a = Math.abs(o);
        const shown = a === 0 || (a === 1 && !phone);
        it.dataset.pos = o;
        it.style.zIndex = o === 0 ? 3 : 1;
        it.style.transform = `translateX(${o * gap}px) rotateY(${-o * 24}deg) scale(${a ? 0.5 : 1})`;
        it.style.opacity = shown ? (a ? 0.3 : 1) : 0;
        it.style.filter = a ? 'saturate(.5) blur(2px)' : 'none';
        it.style.pointerEvents = shown ? '' : 'none';
        it.setAttribute('aria-hidden', String(o !== 0));
      });
    }

    function info() {
      const it = items[active];
      const set = () => {
        name.textContent = it.dataset.name;
        desc.textContent = it.dataset.desc;
        price.textContent = it.dataset.price;
      };
      idx.textContent = String(active + 1).padStart(2, '0');
      bar.style.width = ((active + 1) / n * 100) + '%';
      if (!motion) return set();
      gsap.timeline()
        .to([name, desc, price], { opacity: 0, y: 14, duration: 0.25, ease: 'power2.in', stagger: 0.03 })
        .add(set)
        .to([name, desc, price], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 });
    }

    /* the word hops, letter by letter, every time the dish changes */
    const word = $('#carWord');
    word.innerHTML = word.textContent.split('').map(c => `<span class="cw">${c}</span>`).join('');
    const hop = () => motion && gsap.fromTo($$('.cw', word), { yPercent: 0 },
      { keyframes: [{ yPercent: -14, duration: 0.22, ease: 'power2.out' }, { yPercent: 0, duration: 0.5, ease: 'bounce.out' }], stagger: 0.035 });

    function go(dir) {
      lastDir = dir;
      active = (active + dir + n) % n;
      layout(); info(); hop();
    }

    $('#carPrev').addEventListener('click', () => go(-1));
    $('#carNext').addEventListener('click', () => go(1));
    items.forEach((it, i) => it.addEventListener('click', () => {
      const o = offsetOf(i);
      if (o) go(o > 0 ? 1 : -1);
    }));

    /* swipe / drag */
    let downX = null;
    car.addEventListener('pointerdown', e => { if (!e.target.closest('button')) downX = e.clientX; });
    addEventListener('pointerup', e => {
      if (downX === null) return;
      const dx = e.clientX - downX; downX = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    });

    /* arrow keys, while it is on screen */
    let onScreen = false;
    new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }, { threshold: 0.4 }).observe(car);
    addEventListener('keydown', e => {
      if (!onScreen || e.target.closest('input,textarea,select')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });

    /* the dish in front leans toward the pointer */
    lean(car, () => $('.car__item[data-pos="0"] .car__tilt', car), 18);

    layout();
    addEventListener('resize', layout);
  }

  /* ================================================================
     THE SPIRALS — type running along a path
     Each path starts well off to the left, so the text can be walked
     along it with a positive startOffset, which every browser draws.
     The line is repeated to cover the path, and its offset wraps by
     exactly one repeat, so the loop has no seam.
     ================================================================ */
  const LEAD = 1560;                         // path length before it comes on screen
  const snakes = [
    { text: $('#snakeText'), path: $('#snakePath'), speed: 70 }
  ].filter(s => s.text && s.path);

  function fillSnake(s) {
    const svg = s.path.ownerSVGElement;
    const unitText = s.text.textContent;
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    probe.setAttribute('class', s.text.parentNode.getAttribute('class'));
    probe.textContent = unitText;
    svg.appendChild(probe);
    s.unit = probe.getComputedTextLength() || 800;
    probe.remove();
    s.base = LEAD - s.unit;
    const reps = Math.ceil((s.path.getTotalLength() - s.base) / s.unit) + 1;
    s.text.textContent = unitText.repeat(reps);
    s.offset = 0;
    s.text.setAttribute('startOffset', s.base.toFixed(1));
  }
  const startSnakes = () => {
    snakes.forEach(fillSnake);
    if (reduced) return;
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const boost = 1 + Math.min(4, Math.abs(window.__lenisVelocity || 0) * 0.08);
      snakes.forEach(s => {
        s.offset = (((s.offset + s.speed * boost * dt) % s.unit) + s.unit) % s.unit;
        s.text.setAttribute('startOffset', (s.base + s.offset).toFixed(1));
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startSnakes);

  /* the route on the map is revealed through a mask, so it can keep
     its dotted stroke while it draws */
  const route = $('#route');
  let routeMask = null;
  if (route) {
    const ns = 'http://www.w3.org/2000/svg', svg = route.ownerSVGElement;
    const defs = document.createElementNS(ns, 'defs');
    const mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', 'routeMask');
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    routeMask = document.createElementNS(ns, 'path');
    routeMask.setAttribute('d', route.getAttribute('d'));
    Object.entries({ fill: 'none', stroke: '#fff', 'stroke-width': '24', 'stroke-linecap': 'round', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': reduced ? '0' : '1' })
      .forEach(([k, v]) => routeMask.setAttribute(k, v));
    mask.appendChild(routeMask); defs.appendChild(mask); svg.prepend(defs);
    route.setAttribute('mask', 'url(#routeMask)');
  }

  if (!motion) return;

  /* ================================================================ */
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, touchMultiplier: 1.3 });
    lenis.on('scroll', e => { window.__lenisVelocity = e.velocity; ScrollTrigger.update(); });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    }));
  }

  /* nav: the brand bows out and the order pill drops in once About
     has covered the hero */
  const nav = $('#nav'), order = $('#order');
  ScrollTrigger.create({
    trigger: '#about', start: 'top 12%',
    onEnter: () => { nav.classList.add('is-past'); order?.classList.add('is-on'); },
    onLeaveBack: () => { nav.classList.remove('is-past'); order?.classList.remove('is-on'); }
  });

  /* --- split helpers ---------------------------------------------- */
  function splitChars(el) {
    const chars = [];
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = node => {
      Array.from(node.childNodes).forEach(nd => {
        if (nd.nodeType === 3) {
          const frag = document.createDocumentFragment();
          nd.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const wd = document.createElement('span');
            wd.className = 'wd'; wd.setAttribute('aria-hidden', 'true');
            for (const c of part) {
              const ch = document.createElement('span');
              ch.className = 'ch'; ch.textContent = c;
              wd.appendChild(ch); chars.push(ch);
            }
            frag.appendChild(wd);
          });
          nd.replaceWith(frag);
        } else if (nd.nodeType === 1) walk(nd);
      });
    };
    walk(el);
    return chars;
  }

  function splitWords(el, cls, inner) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => inner
      ? `<span class="${cls}" aria-hidden="true"><span>${w}</span></span>`
      : `<span class="${cls}" aria-hidden="true">${w}</span>`).join(' ');
    return $$(inner ? `.${cls} > span` : `.${cls}`, el);
  }

  /* --- about: letters grow out of dots ---------------------------- */
  const aboutText = $('[data-chars]');
  if (aboutText) {
    const chars = splitChars(aboutText);
    gsap.fromTo(chars,
      { scale: 0.12, opacity: 0.35, yPercent: 35 },
      {
        scale: 1, opacity: 1, yPercent: 0, ease: 'power2.out',
        stagger: { each: 0.012 },
        scrollTrigger: { trigger: aboutText, start: 'top 92%', end: 'bottom 55%', scrub: 0.5 }
      });
  }

  gsap.fromTo('#pot', { yPercent: 38, scale: 0.88 }, {
    yPercent: 0, scale: 1, ease: 'none',
    scrollTrigger: { trigger: '#pot', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
  });

  /* --- the biryani travels from About into the carousel -------------
     The way naughtyberry's cup does: one dish, carried down the page
     between the two places it sits. It is a single image laid over the
     page in document coordinates, flown from the About slot to the
     carousel's first slot while the two real images stand hidden, so
     there is only ever one biryani on screen. Its path is read off the
     two slots every frame, so it lands wherever the carousel has put
     the biryani, and flies home again on the way back up.             */
  const potImg = $('#potImg'), carBir = $('#carBiryani');
  if (potImg && carBir) {
    const pot = $('#pot');
    const trav = new Image();
    trav.className = 'traveller'; trav.alt = ''; trav.setAttribute('aria-hidden', 'true');
    trav.src = carBir.getAttribute('src');
    document.body.appendChild(trav);

    /* the dish's visible box inside an img, allowing for object-fit:
       contain, in document coordinates */
    const content = img => {
      const r = img.getBoundingClientRect();
      const ar = (img.naturalWidth / img.naturalHeight) || (1254 / 921);
      let w = r.width, h = r.width / ar;
      if (h > r.height) { h = r.height; w = h * ar; }
      return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, w, h };
    };
    const mix = (a, b, t) => a + (b - a) * t;

    let p = 0, state = '';
    const place = () => {
      const now = p <= 0 ? 'home' : p >= 1 ? 'landed' : 'flying';
      if (now !== state) {
        state = now;
        potImg.style.visibility = now === 'home' ? '' : 'hidden';
        carBir.style.visibility = now === 'landed' ? '' : 'hidden';
        pot.classList.toggle('is-away', now !== 'home');
        trav.style.visibility = now === 'flying' ? 'visible' : 'hidden';
      }
      if (now !== 'flying') return;
      const a = content(potImg), b = content(carBir);
      const arc = Math.sin(Math.PI * p);          // 0 at both ends, 1 half way
      const e = p * p * (3 - 2 * p);
      const phone = innerWidth <= 720;
      const w = mix(a.w, b.w, e) * (1 + (phone ? 0.04 : 0.14) * arc);
      const h = w * a.h / a.w;
      /* straight down it moves with the scroll, so it holds its place
         on screen; it swings out to the side and tips toward you on the
         way, and is square again by the time it lands. The swing never
         takes it past the edge of the screen. */
      const room = Math.max(0, (innerWidth - w) / 2 - 12);
      const x = mix(a.x, b.x, p) + arc * Math.min(innerWidth * 0.2, 280, room);
      const y = mix(a.y, b.y, p);
      trav.style.width = w.toFixed(1) + 'px';
      trav.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px) perspective(900px) rotateX(${(arc * 22).toFixed(2)}deg) rotate(${(arc * -9).toFixed(2)}deg)`;
    };

    ScrollTrigger.create({
      trigger: pot, start: 'center 50%',
      endTrigger: '#car', end: 'center 50%',
      onUpdate: self => { p = self.progress; },
      onRefresh: self => { p = self.progress; }
    });
    gsap.ticker.add(place);
  }

  /* --- specials: the controls rise in (the stage itself stays put, so
     the biryani has somewhere to land) ------------------------------- */
  gsap.from('.car__foot', {
    y: 30, opacity: 0, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '#car', start: 'top 70%' }
  });
  gsap.from($$('.cw'), {
    yPercent: 100, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05,
    scrollTrigger: { trigger: '#car', start: 'top 80%' }
  });

  /* --- statements: word by word ------------------------------------ */
  $$('[data-words]').forEach(el => {
    const words = splitWords(el, 'w', true);
    gsap.fromTo(words, { yPercent: 110 }, {
      yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.04,
      scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' }
    });
  });

  /* ...and filling in, the way naughtyberry's story does */
  $$('[data-fill]').forEach(el => {
    const words = splitWords(el, 'fw', false);
    gsap.fromTo(words, { color: 'rgba(202,47,96,.28)' }, {
      color: '#3A312C', ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 45%', scrub: 0.4 }
    });
  });

  /* --- menu rows land one after another ---------------------------- */
  gsap.from('.menu__list.is-on li', {
    yPercent: 70, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06,
    scrollTrigger: { trigger: '.menu__lists', start: 'top 80%' }
  });

  /* --- reviews ------------------------------------------------------ */
  gsap.fromTo('#revWord', { yPercent: 30, scale: 0.86 }, {
    yPercent: 0, scale: 1, ease: 'none',
    scrollTrigger: { trigger: '#reviews', start: 'top bottom', end: 'top top', scrub: 0.6 }
  });
  /* the photo settles as it arrives: word, photo and cut-out scale
     together, since they share one frame */
  gsap.fromTo('#revFrame', { scale: 1.12 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '#reviews', start: 'top bottom', end: 'top top', scrub: 0.6 }
  });
  /* the cards pop into their slots one at a time while the section
     is pinned, and stay there */
  const cards = $$('.review');
  if (cards.length) {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '#reviews', start: 'top top', end: 'bottom bottom', scrub: 0.5 }
    });
    cards.forEach((c, i) => {
      const tilt = parseFloat(c.dataset.tilt) || 0;
      tl.fromTo(c, { opacity: 0, scale: 0.5, y: 60, rotate: tilt * 3 },
        { opacity: 1, scale: 1, y: 0, rotate: tilt * 0.5, duration: 1, ease: 'back.out(1.6)' }, i * 0.8);
    });
    tl.to({}, { duration: 1 });              // a beat with all six up before it lets go
  }

  /* --- footer: the word comes up, then Masala Bhai rises behind it -- */
  if ($('#footSign')) {
    gsap.timeline({ scrollTrigger: { trigger: '#footSign', start: 'top 95%', end: 'bottom bottom', scrub: 0.6 } })
      .fromTo('.foot__word .fl', { yPercent: 100 }, { yPercent: 0, ease: 'power3.out', stagger: 0.04, duration: 0.6 }, 0)
      .fromTo('#footBhai', { xPercent: -50, x: 0, yPercent: 70 }, { xPercent: -50, x: 0, yPercent: 12, ease: 'power2.out', duration: 1 }, 0.25);
  }

  /* --- visit: the line closes up, the route draws, the pins drop ---- */
  $$('[data-track]').forEach(el => {
    gsap.fromTo(el, { letterSpacing: '0.45em', opacity: 0.25 }, {
      letterSpacing: '0em', opacity: 1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 55%', scrub: 0.5 }
    });
  });
  if (routeMask) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#map', start: 'top 80%', end: 'bottom 60%', scrub: 0.6 } });
    tl.from('#pinJhb', { scale: 0, y: -40, duration: 0.15, ease: 'back.out(2)' }, 0)
      .to(routeMask, { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, ease: 'none' }, 0.1)
      .from('#pinCpt', { scale: 0, y: -40, duration: 0.15, ease: 'back.out(2)' }, 0.8);
  }

  /* fonts change every measurement above, so re-measure once they land */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
