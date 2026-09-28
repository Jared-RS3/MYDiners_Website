/* =====================================================================
   MY Diners — the loader
   ---------------------------------------------------------------------
   A card over the whole page is the sign on the wall at the
   restaurant (title.webp). It signs "my diners", lights up, and
   slides up off the hero (after vesperat.framer.website).

     sign   each letter rises out of a blur, one after another. It
            starts once the script font is in, so no letter lands in
            a stand-in face
     light  the halo behind the letters flickers on
     hold   the card waits for the hero to be drawn: the still and
            the cut-out, or with WebGL the first frame of hero.js
            (it sends "hero:ready")
     slide  the card slides up and away, the hero copy rises in
            underneath, and the page can scroll

   With reduced motion <html> never gets .intro (see the <head>), and
   the card never shows.
   ===================================================================== */
(() => {
  const root   = document.documentElement;
  const loader = document.getElementById('loader');
  const stage  = document.getElementById('top');
  clearTimeout(window.__introBail);
  if (!loader) return;
  if (!root.classList.contains('intro')) return loader.remove();

  const LIGHT = 700;      // ms the halo takes to flicker on (@keyframes lightup)
  const HOLD = 350;       // ms the lit sign rests before it slides
  const MAX = 6500;       // slide by then, whatever is still loading
  const wait = ms => new Promise(ok => setTimeout(ok, ms));

  /* the page stays put under the card */
  const KEYS = [' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'];
  const block = e => {
    if (e.type === 'keydown' && !KEYS.includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const opts = { passive: false, capture: true };
  ['wheel', 'touchmove', 'keydown'].forEach(t => window.addEventListener(t, block, opts));

  /* --- sign ----------------------------------------------------------- */
  const letters = loader.querySelectorAll('.loader__sig span');
  const last = letters[letters.length - 1];
  const font = document.fonts
    ? Promise.race([document.fonts.load('1em "Mr Dafoe"', 'my diners'), wait(2500)]).catch(() => {})
    : Promise.resolve();
  const signed = font.then(() => {
    loader.classList.add('is-signing');
    return Promise.race([
      new Promise(ok => last.addEventListener('animationend', ok, { once: true })),
      wait(2500)
    ]);
  }).then(() => {
    loader.classList.add('is-lit');
    return wait(LIGHT + HOLD);
  });

  /* --- hold ----------------------------------------------------------- */
  const decoded = img => !img ? Promise.resolve() : (img.complete ? Promise.resolve() : new Promise(ok => {
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', ok, { once: true });
  })).then(() => img.decode ? img.decode().catch(() => {}) : null);
  const drawn = root.classList.contains('gl')
    ? new Promise(ok => document.addEventListener('hero:ready', ok, { once: true }))
    : Promise.all([decoded(document.getElementById('heroImg')), decoded(document.getElementById('heroCut'))]);

  /* --- slide ---------------------------------------------------------- */
  let gone = false;
  function slide() {
    if (gone) return;
    gone = true;
    loader.classList.add('is-out');
    ['wheel', 'touchmove', 'keydown'].forEach(t => window.removeEventListener(t, block, opts));
    setTimeout(() => stage && stage.classList.add('is-in'), 200);
    const card = loader.firstElementChild;
    const done = () => loader.remove();
    card.addEventListener('transitionend', e => { if (e.target === card) done(); });
    setTimeout(done, 1500);
  }

  Promise.race([Promise.all([signed, drawn]), wait(MAX)]).then(slide);
})();
