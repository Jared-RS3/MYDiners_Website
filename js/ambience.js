/* =====================================================================
   MY Diners — the air in the hero
   ---------------------------------------------------------------------
   The still already has sun coming in through a window on the top
   left (its shadows run down to the right). This layer puts that light
   in the air: shafts fanning out from the same corner, slowly
   breathing, and dust drifting through the room that glints where it
   crosses a shaft. The pointer stirs the dust. (After daybreaktech.)

   It is its own canvas over the goo (js/hero.js), so it never touches
   the goo, the headline or the loader. With reduced motion or no WebGL it simply isn't drawn, and
   it stops whenever the hero is out of sight.
   ===================================================================== */
(() => {
  const stage  = document.getElementById('top');
  const canvas = document.getElementById('heroAir');
  if (!stage || !canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return;

  const small = matchMedia('(max-width: 820px)').matches;
  const COUNT = small ? 70 : 140;   // motes
  const FADE  = 2.5;                // seconds for the light to come up

  /* --- the light, shared by both passes ------------------------------
     p and the source are in frame heights (x runs 0..aspect), y up. The
     shafts are a fan of angles from the source, made of a few sines at
     odd ratios so they never visibly repeat, and they fall off with
     distance. */
  const LIGHT = `
uniform vec2  uSrc;
uniform float uTime, uAspect;
float shafts(vec2 p){
  vec2 d = p - uSrc;
  float a = atan(d.x, -d.y);                       // 0 straight down, + to the right
  float r = length(d);
  float s = .55 + .45 * sin(a * 23. + uTime * .16);
  s *= .6 + .4 * sin(a * 37. - uTime * .11 + 1.3);
  s *= .7 + .3 * sin(a * 9. + uTime * .07 + 4.);
  s = pow(s, 2.2);
  float fan = smoothstep(.2, .5, a) * (1. - smoothstep(.95, 1.25, a));   // along the photo's window shadows
  float fall = exp(-r * .55) * smoothstep(0., .3, p.y);
  return s * fan * fall;
}`;

  const RAYS_V = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

  /* On a cream wall, light alone has nowhere to go, so the room is
     dimmed a touch away from the window (warm cocoa, heavier toward
     the far corner) and the shafts cut gold through that shade. */
  const RAYS_F = `
precision mediump float;
varying vec2 vUv;
uniform float uFade;
${LIGHT}
void main(){
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float s = shafts(p);
  float far = length(p - uSrc) / length(vec2(uAspect, 1.) - uSrc);
  float aS = (.02 + .07 * smoothstep(.15, 1., far)) * (1. - clamp(s * 1.6, 0., 1.));
  float glow = exp(-length(p - uSrc) * 1.6) * .25;  // the haze where it comes in
  float aL = clamp(s * .4 + glow, 0., .45);
  vec3 col = vec3(1., .87, .64) * aL + vec3(.227, .16, .12) * aS * (1. - aL);
  float a = aL + aS * (1. - aL);
  gl_FragColor = vec4(col, a) * uFade;
}`;

  const DUST_V = `
attribute vec3 aMote;      // x, y (frame heights), size in css px
attribute vec2 aLook;      // base brightness, tint (0 warm .. 1 blossom)
uniform float uPR, uFade;
varying float vA;
varying float vTint;
${LIGHT}
void main(){
  vec2 p = aMote.xy;
  gl_Position = vec4(p.x / uAspect * 2. - 1., p.y * 2. - 1., 0., 1.);
  gl_PointSize = aMote.z * uPR;
  /* big motes are out of focus: softer and fainter */
  float focus = 1. / (1. + aMote.z * .06);
  vA = (aLook.x + shafts(p) * 4.) * focus * uFade;
  vTint = aLook.y;
}`;

  const DUST_F = `
precision mediump float;
varying float vA;
varying float vTint;
void main(){
  float r = length(gl_PointCoord - .5) * 2.;
  float a = clamp(vA * pow(max(1. - r, 0.), 1.5), 0., 1.);
  vec3 c = mix(vec3(1., .97, .9), vec3(.965, .765, .824), vTint);    // paper light, the page pink
  gl_FragColor = vec4(c * a, a);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const program = (v, f) => {
    const vs = compile(gl.VERTEX_SHADER, v), fs = compile(gl.FRAGMENT_SHADER, f);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const rays = program(RAYS_V, RAYS_F), dust = program(DUST_V, DUST_F);
  if (!rays || !dust) return;
  const uni = (p, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)]));
  const UR = uni(rays, ['uSrc', 'uTime', 'uAspect', 'uFade']);
  const UD = uni(dust, ['uSrc', 'uTime', 'uAspect', 'uFade', 'uPR']);

  /* one triangle that covers the screen */
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(rays, 'aPos');

  /* --- the motes ---------------------------------------------------- */
  const mote = new Float32Array(COUNT * 3), look = new Float32Array(COUNT * 2);
  const vel = new Float32Array(COUNT * 2), rise = new Float32Array(COUNT), phase = new Float32Array(COUNT);
  let aspect = 1;
  for (let i = 0; i < COUNT; i++) {
    const big = Math.random() < .12;
    mote[i * 3 + 1] = Math.random();
    mote[i * 3 + 2] = big ? 12 + Math.random() * 12 : 2.5 + Math.pow(Math.random(), 2) * 6;
    look[i * 2]     = .5 + Math.random() * .5;
    look[i * 2 + 1] = Math.random() < .2 ? 1 : 0;
    rise[i]  = (.006 + Math.random() * .014) * (big ? .5 : 1);   // frame heights per second
    phase[i] = Math.random() * 6.283;
  }
  const bMote = gl.createBuffer(), bLook = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bLook);
  gl.bufferData(gl.ARRAY_BUFFER, look, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, bMote);
  gl.bufferData(gl.ARRAY_BUFFER, mote, gl.DYNAMIC_DRAW);
  const aMote = gl.getAttribLocation(dust, 'aMote'), aLook = gl.getAttribLocation(dust, 'aLook');

  /* --- the pointer stirs them --------------------------------------- */
  let mx = -9, my = -9, mvx = 0, mvy = 0, sx = 0, sy = 0;
  function point(cx, cy) {
    const box = stage.getBoundingClientRect();
    const x = (cx - box.left) / box.height, y = 1 - (cy - box.top) / box.height;
    if (mx > -9) { mvx += x - mx; mvy += y - my; }
    mx = x; my = y;
    kick();
  }
  stage.addEventListener('pointermove', e => point(e.clientX, e.clientY));
  stage.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) point(t.clientX, t.clientY); }, { passive: true });
  stage.addEventListener('pointerleave', () => { mx = my = -9; });

  function step(t, dt) {
    const R = .14;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3, k = i * 2;
      let x = mote[j], y = mote[j + 1];
      /* the pointer pushes them aside and drags them along its wake */
      const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
      if (d < R) {
        const f = (1 - d / R) * (1 - d / R);
        vel[k]     += (dx / (d + 1e-4) * .35 * dt + mvx * .5) * f;
        vel[k + 1] += (dy / (d + 1e-4) * .35 * dt + mvy * .5) * f;
      }
      const damp = Math.pow(.2, dt);
      vel[k] *= damp; vel[k + 1] *= damp;
      x += vel[k] + Math.sin(t * .3 + phase[i]) * .006 * dt;
      y += vel[k + 1] + rise[i] * dt;
      /* wrap round the frame, with a margin so they don't pop */
      if (y > 1.05) { y -= 1.1; x = Math.random() * aspect; }
      if (y < -.05) y += 1.1;
      if (x > aspect + .05) x -= aspect + .1;
      if (x < -.05) x += aspect + .1;
      mote[j] = x; mote[j + 1] = y;
    }
    mvx = mvy = 0;
  }

  /* --- size, visibility --------------------------------------------- */
  let pr = 1;
  function resize() {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(box.width * pr);
    canvas.height = Math.round(box.height * pr);
    aspect = box.width / box.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  new ResizeObserver(resize).observe(stage);
  for (let i = 0; i < COUNT; i++) mote[i * 3] = Math.random() * aspect;

  /* the hero is pinned while About slides over it, so "in view" means
     the stage is on screen and About hasn't covered it yet */
  const about = document.getElementById('about');
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); }).observe(stage);
  const visible = () => onScreen && !document.hidden && (!about || about.getBoundingClientRect().top > 0);
  addEventListener('scroll', () => kick(), { passive: true });
  document.addEventListener('visibilitychange', () => kick());

  /* --- the loop ------------------------------------------------------ */
  gl.enable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  let raf = 0, last = 0, clock = 0;

  function frame(now) {
    raf = 0;
    if (!visible()) { last = 0; return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : .016;
    last = now; clock += dt;
    step(clock, dt);

    /* the light leans a touch with the pointer, like looking round */
    const tx = mx > -9 ? (mx / aspect - .5) * .08 : 0, ty = mx > -9 ? (my - .5) * .04 : 0;
    sx += (tx - sx) * Math.min(1, dt * 2); sy += (ty - sy) * Math.min(1, dt * 2);
    const src = [-.08 * aspect + sx, 1.45 + sy];
    const fade = Math.min(1, clock / FADE);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(rays);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2fv(UR.uSrc, src); gl.uniform1f(UR.uTime, clock);
    gl.uniform1f(UR.uAspect, aspect); gl.uniform1f(UR.uFade, fade);
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aPos);

    gl.useProgram(dust);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2fv(UD.uSrc, src); gl.uniform1f(UD.uTime, clock);
    gl.uniform1f(UD.uAspect, aspect); gl.uniform1f(UD.uFade, fade); gl.uniform1f(UD.uPR, pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, bMote);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mote);
    gl.enableVertexAttribArray(aMote);
    gl.vertexAttribPointer(aMote, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bLook);
    gl.enableVertexAttribArray(aLook);
    gl.vertexAttribPointer(aLook, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, COUNT);
    gl.disableVertexAttribArray(aMote);
    gl.disableVertexAttribArray(aLook);

    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible()) raf = requestAnimationFrame(frame); }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); canvas.remove(); });
  kick();
})();
