/* =====================================================================
   MY Diners — the hero goo
   ---------------------------------------------------------------------
   One WebGL pass redraws the hero still, the headline, and Masala Bhai
   cut out of that same still, so the headline sits behind his head.

     goo    the pointer drags a gooey trail, but it only takes on him.
            Where it passes over Masala Bhai it peels the red jacket
            away to his real outfit underneath (hero-under.webp: the
            white-tee, sunglasses version, stood in the same spot),
            with a wet lip where the light catches it (after cafe-moka)

   Once the first frame is drawn it sends "hero:ready", which the
   loader waits for before it flips away (js/loader.js).

   The page stands without it. With reduced motion or no WebGL, <html>
   never gets .gl (see the <head>), and CSS stacks the still, the <h1>
   and the cut-out instead. If anything fails here, .gl comes off.
   ===================================================================== */
(() => {
  const root   = document.documentElement;
  const stage  = document.getElementById('top');
  const canvas = document.getElementById('heroGl');
  const title  = document.getElementById('heroTitle');
  const photo  = document.getElementById('heroImg');
  const cut    = document.getElementById('heroCut');
  if (!root.classList.contains('gl') || !stage || !canvas || !title || !photo || !cut) return;

  let dead = false, announced = false;
  const announce = () => {
    if (announced) return;
    announced = true;
    document.dispatchEvent(new Event('hero:ready'));
  };
  const fallback = () => {
    if (dead) return;
    dead = true;
    root.classList.remove('gl');
    announce();
  };
  const bail = setTimeout(fallback, 5000);   // nothing drawn by then: show the plain still

  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return fallback();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback(); });

  const UNDER = matchMedia('(max-width: 820px)').matches ? 'assets/hero-under-sm.webp' : 'assets/hero-under.webp';
  const N = 32;             // points in the goo trail
  const THICK = 0.22;       // how fat the goo gets at speed
  const SENS = 20;          // how quickly speed turns into thickness
  const REST = 0.09;        // the pool left under a pointer that has stopped
  const FOLLOW = 0.45;      // how tightly each point chases the one before

  /* --- shaders ------------------------------------------------------ */
  const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define N ${N}
varying vec2 vUv;
uniform sampler2D uPhoto;   // the hero still
uniform sampler2D uCut;     // Masala Bhai, cut out of the same still
uniform sampler2D uText;    // the headline: r = solid, g = outline
uniform sampler2D uUnder;   // his real outfit in the same frame: rgb over the room, a = him
uniform vec2  uRes;
uniform float uPhotoAspect, uHasUnder;
uniform float uTime;
uniform vec3  uTrail[N];    // the goo: x (aspect-corrected), y, radius

const vec3 ROSE  = vec3(.792, .184, .376);
const vec3 PAPER = vec3(.984, .953, .890);
const vec3 COCOA = vec3(.227, .192, .173);

/* object-fit: cover, centred, the way CSS crops the <img> */
vec2 cover(vec2 uv, float ia){
  float ca = uRes.x / uRes.y;
  return (uv - .5) * vec2(min(ca / ia, 1.), min(ia / ca, 1.)) + .5;
}

void main(){
  float ar = uRes.x / uRes.y;
  vec2 uv = vUv;

  /* the goo */
  vec2 p = vec2(uv.x * ar, uv.y);
  float I = 0.;
  vec2 dir = vec2(0.);
  for (int i = 0; i < N; i++) {
    float r = uTrail[i].z;
    if (r > .0001) {
      vec2 d = p - uTrail[i].xy;
      float k = max(0., 1. - length(d) / r);
      I += k * k;
      dir += d * k;
    }
  }
  float goo = smoothstep(.4, .6, I) * uHasUnder;
  float lip = (1. - smoothstep(0., .25, abs(I - .5))) * uHasUnder;
  vec2 nrm = dir / (length(dir) + 1e-4);
  vec2 wob = vec2(sin(uv.y * 15. + uTime * 3.), cos(uv.x * 15. + uTime * 3.)) * .012;

  /* on top: the still, the headline in rose, Bhai in front */
  vec2 cp = cover(uv, uPhotoAspect);
  vec3 still = texture2D(uPhoto, cp).rgb;
  float bhai = texture2D(uCut, cp).a;
  float solid = texture2D(uText, uv).r;
  vec3 top = mix(still, ROSE, solid * (1. - bhai));

  /* underneath: his real outfit, wobbling a little, seen through a lens
     at the lip, still in front of the headline */
  vec2 gp = cover(uv + wob * goo - nrm * lip * .02, uPhotoAspect);
  vec4 real = texture2D(uUnder, gp);
  vec3 under = mix(real.rgb, ROSE, solid * (1. - real.a));

  /* the goo only takes on him: either outfit, so where the jacket was
     wider than he is, the room shows through. The mask is grown a few
     pixels and hardened, or the jacket's soft edge would stay behind
     as a ghost outline. */
  vec2 o = 3. / uRes;
  float him = max(bhai, texture2D(uUnder, cp).a);
  him = max(him, texture2D(uCut, cover(uv + vec2(o.x, 0.), uPhotoAspect)).a);
  him = max(him, texture2D(uCut, cover(uv - vec2(o.x, 0.), uPhotoAspect)).a);
  him = max(him, texture2D(uCut, cover(uv + vec2(0., o.y), uPhotoAspect)).a);
  him = max(him, texture2D(uCut, cover(uv - vec2(0., o.y), uPhotoAspect)).a);
  him = smoothstep(0., .35, him);
  goo *= him;
  lip *= him;

  vec3 col = mix(top, under, goo);

  /* the lip is wet: light from the top left catches one side of it,
     the other side sinks into shadow */
  float light = dot(nrm, normalize(vec2(-.6, .8)));
  col += PAPER * lip * pow(max(light, 0.), 2.) * .55;
  col = mix(col, COCOA, lip * max(-light, 0.) * .2);

  gl_FragColor = vec4(col, 1.);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return fallback();
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fallback();
  gl.useProgram(prog);

  /* one triangle that covers the screen */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uPhoto', 'uCut', 'uText', 'uUnder', 'uRes', 'uPhotoAspect', 'uHasUnder',
   'uTime', 'uTrail'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });

  /* --- textures: each keeps its own unit ---------------------------- */
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);   // keeps the headline's two channels apart at the edges
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  function texture(unit, uniform) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(U[uniform], unit);
    return unit;
  }
  /* straight: keep the colour where alpha is 0 (the under image is the
     room there, and its alpha only says where he is) */
  function upload(unit, src, straight) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (straight) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (straight) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  }
  /* a still wider than the GPU allows is drawn down to fit first */
  function fit(img) {
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, maxTex / Math.max(w, h));
    if (s === 1) return img;
    const c = document.createElement('canvas');
    c.width = Math.floor(w * s); c.height = Math.floor(h * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const T_PHOTO = texture(0, 'uPhoto'), T_CUT = texture(1, 'uCut'),
        T_TEXT = texture(2, 'uText'), T_UNDER = texture(3, 'uUnder');

  /* --- the headline, painted from the real <h1> ---------------------
     Each word is drawn where the browser laid it out, measured off a
     zero-size marker sitting on its baseline, so the canvas and the
     CSS fallback always agree. Solid goes in red, outline in green. */
  const words = Array.from(title.querySelectorAll('.hw'));
  words.forEach(w => { const i = document.createElement('i'); i.className = 'hw__base'; w.appendChild(i); });
  const tc = document.createElement('canvas'), tx = tc.getContext('2d');

  function paintTitle(box, scale) {
    tc.width = canvas.width; tc.height = canvas.height;
    const cs = getComputedStyle(title), size = parseFloat(cs.fontSize);
    tx.font = `${cs.fontWeight} ${size * scale}px ${cs.fontFamily}`;
    tx.textBaseline = 'alphabetic';
    const spots = words.map(w => {
      const r = w.getBoundingClientRect(), b = w.lastChild.getBoundingClientRect();
      return { t: w.firstChild.textContent.toUpperCase(), x: (r.left - box.left) * scale, y: (b.top - box.top) * scale };
    });
    tx.fillStyle = '#f00';
    spots.forEach(s => tx.fillText(s.t, s.x, s.y));
    tx.globalCompositeOperation = 'lighter';
    tx.strokeStyle = '#0f0'; tx.lineJoin = 'round'; tx.lineWidth = size * scale * 0.024;
    spots.forEach(s => tx.strokeText(s.t, s.x, s.y));
    tx.globalCompositeOperation = 'source-over';
    upload(T_TEXT, tc);
  }

  let aspect = 1;
  function resize() {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3.2e6 / (box.width * box.height)));
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    aspect = box.width / box.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    paintTitle(box, canvas.width / box.width);
    kick();
  }

  /* --- the goo trail ------------------------------------------------ */
  const trail = new Float32Array(N * 3);
  let px = 0, py = 0, lastX = 0, lastY = 0, radius = 0, lifted = true;

  function point(cx, cy) {
    const box = stage.getBoundingClientRect();
    const x = (cx - box.left) / box.width, y = 1 - (cy - box.top) / box.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    px = x; py = y;
    if (lifted) {          // a fresh stroke starts where the pointer is, not where the last one ended
      lifted = false; lastX = x; lastY = y; radius = 0;
      for (let i = 0; i < N; i++) { trail[i * 3] = x * aspect; trail[i * 3 + 1] = y; trail[i * 3 + 2] = 0; }
    }
    kick();
  }
  stage.addEventListener('pointermove', e => point(e.clientX, e.clientY));
  stage.addEventListener('pointerleave', () => { lifted = true; });
  stage.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) point(t.clientX, t.clientY); }, { passive: true });
  stage.addEventListener('touchend', () => { lifted = true; });

  function stepTrail(dt) {
    const f = dt * 60;                                   // the easing below is tuned per 60Hz frame
    const ease = 1 - Math.pow(0.85, f), follow = 1 - Math.pow(1 - FOLLOW, f);
    let target = 0;
    if (!lifted) {
      /* radii are in frame heights, so a tall phone gets a thinner goo */
      /* while the pointer rests on the hero a small pool stays open (it
         only shows on him), and it swells as the pointer speeds up */
      const speed = Math.min(Math.hypot(px - lastX, py - lastY) / f * SENS, 1) * THICK;
      target = Math.max(speed, REST) * Math.min(1, Math.sqrt(aspect));
      lastX = px; lastY = py;
    }
    radius += (target - radius) * ease;
    trail[0] = px * aspect; trail[1] = py; trail[2] = radius;
    let alive = radius > 5e-4;
    for (let i = 1; i < N; i++) {
      for (let k = 0; k < 3; k++) trail[i * 3 + k] += (trail[(i - 1) * 3 + k] - trail[i * 3 + k]) * follow;
      if (trail[i * 3 + 2] > 5e-4) alive = true;
    }
    return alive;
  }

  /* --- the loop: it only runs while the goo is moving -------------- */
  let ready = false, hasUnder = 0, t0 = 0, last = 0, raf = 0;

  function frame(now) {
    raf = 0;
    if (dead) return;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    const goo = stepTrail(dt);

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uHasUnder, hasUnder);
    gl.uniform3fv(U.uTrail, trail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    announce();

    if (goo) raf = requestAnimationFrame(frame);
  }
  function kick() { if (ready && !raf && !dead) raf = requestAnimationFrame(frame); }

  /* --- go ------------------------------------------------------------ */
  const loaded = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((ok, no) => {
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', no, { once: true });
  })).then(() => img.decode ? img.decode().catch(() => {}) : null);
  const fonts = document.fonts ? document.fonts.load(`400 100px ${getComputedStyle(title).fontFamily}`).catch(() => {}) : Promise.resolve();

  Promise.all([loaded(photo), loaded(cut), fonts]).then(() => {
    if (dead) return;
    upload(T_PHOTO, fit(photo));
    upload(T_CUT, fit(cut));
    gl.uniform1f(U.uPhotoAspect, photo.naturalWidth / photo.naturalHeight);
    ready = true;
    resize();
    new ResizeObserver(resize).observe(stage);
    t0 = last = performance.now();
    clearTimeout(bail);

    /* his real outfit is only needed once someone moves, so it comes last */
    const u = new Image();
    u.onload = () => {
      if (dead) return;
      upload(T_UNDER, fit(u), true);
      hasUnder = 1;
    };
    u.src = UNDER;
  }).catch(fallback);
})();
