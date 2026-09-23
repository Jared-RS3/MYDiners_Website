/* =====================================================================
   MY Diners — restaurant to tabletop, as one camera move
   ---------------------------------------------------------------------
   This is not two images being blended. It is a small 2.5D reconstruction
   of the room in the hero photograph, with a single camera flying through
   it on a continuously interpolated path.

   THE SCENE, in metres, solved against the plate itself:

        wall   a vertical plane at z = -4.19
        floor  a horizontal plane at y = 0
        table  an elliptical top at y = 0.75, far edge at z = -1.841

   Those two depths are not invented. With the camera at eye height
   1.40 m and a 40 deg lens pitched 2.5 deg down, they place the
   baseboard at 89.3% and the table's rim at 91.8% of frame height —
   which is exactly where they sit in hero.png. So at progress 0 the
   render and the photograph agree, and every later frame is a real
   view of the same room rather than a transformed picture of it.

   The wall and floor are textured by PROJECTING hero.png from that
   progress-0 camera, so the plate maps onto the geometry with no
   resampling. The tabletop carries the overhead photograph, placed so
   that the frame at 90 deg lands on it exactly — which is why there is
   no handoff at the end: the last frame of the camera move IS the
   supplied top-down shot, arrived at rather than cut to.

   THE MIDDLE OF THE MOVE
   The same projection trick is run a second time from the camera at
   P_MID, using hero-table.webp — the supplied mid-transition plate.
   Solving that photograph's wall/floor junction (270/941 of frame) and
   its table rim (apex 278/941) against this scene puts its camera at
   roughly y 1.65 m, pitch -36 deg, which is where this path already is
   at p = 0.45; the table's far edge it implies, z = -1.89, agrees with
   the -1.841 solved from the hero. So the plate is projected from the
   render camera at P_MID itself, which makes it pixel-exact there by
   construction and keeps a real photograph on every surface for the
   whole middle of the move. Nothing is ever a bare tiled floor, which
   is what used to read as a morph rather than a camera move.

   WHAT THE CAMERA CARRIES
   Masala Bhai and the food board are objects IN this room, not layers
   over it. Both were solved from the two supplied composites against
   this camera, so the render agrees with them:

     bhai    a vertical plane, 1.05 m tall (head to mid-thigh), at
             z = -1.22 with his head at 1.755 m. Solved from his
             height alone, his silhouette then lands within 0.5% of
             where the start composite puts it — which is the check
             that the figure is standing in this room rather than
             pasted over it.
     board   a plane that always faces the camera, standing on its
             front edge. Facing the camera is not a shortcut: it is
             the only orientation under which the board photograph
             stays undistorted, and undistorted is what both
             composites show. Laid genuinely flat instead, the frame
             that has to match the end composite squeezes the top of
             the board to half its width.

   The camera still runs the whole path, down to 90 degrees over the
   tabletop. What the board cannot do is land on a fixed spot and stay
   in frame: the camera pans right across the table on the way over, so
   no point on the marble is in shot at both ends of the move. It is
   carried down instead, on a path solved to keep it framed the whole
   way, and set down only once the camera is nearly overhead — by
   which point the last few centimetres of height read as nothing.
   ===================================================================== */
import * as THREE from 'three';

const IMG_AR   = 1672 / 941;
const FOV0     = 40;                 // vertical, at the design aspect
const TABLE_Y  = 0.75;
const WALL_Z   = -4.19;
const EYE0     = new THREE.Vector3(0, 1.40, 0);
const PITCH0   = -2.5;

const TABLE_C  = new THREE.Vector3(0, TABLE_Y, -0.791);  // ellipse centre
const TABLE_RX = 1.35;
const TABLE_RZ = 1.05;               // far edge -> z = -1.841

const P_MID    = 0.45;               // where hero-table.webp is pixel-exact

/* Masala Bhai. He stands BEHIND the table — a metre past its far rim,
   not inside its footprint — which is what puts him at the scale the
   layout asks for and lets the marble cut him off on its own. Solved
   so that the crop at his mid-thigh lands at 93.5% of frame height at
   progress 0, just under the table's own rim at 91.9%: the cut is
   hidden by the table rather than by a mask. */
const BHAI_Z    = -2.25;
const BHAI_TOP  = 1.628;             // head, in metres above the floor
const BHAI_H    = 1.0500;            // head to mid-thigh, where the plate crops
const BHAI_W    = BHAI_H * 0.7375;   // bhai.webp aspect
const BHAI_BACK = -3.70;             // where he steps back to

/* The board. BOARD_W/D is the plate's own aspect at scale 1; the three
   splines below carry it out of his hands and down onto the marble.

   Its front edge rides on his palms, which bhai.webp puts at 0.937 m,
   a hand's reach in front of him and 0.50 m across — wide enough that
   its ends clear his palms, which is what reads as held rather than
   balanced. It grows by about a quarter on the way down, no more: the
   camera is closing most of the distance itself, and anything more
   than that has it filling the frame halfway through.

   BOARD_Z is the one that matters. It is not a straight line from his
   hands to a spot on the table — it is solved so the board stays
   inside the frame while the camera pans across the marble, and only
   arrives at the point that is dead centre of the overhead stop. */
const BOARD_W = 0.9728, BOARD_D = 0.5397;
const BOARD_Z = spline([[0,-2.07],[0.07,-2.07],[0.30,-1.78],[0.50,-1.42],[0.70,-1.00],[0.88,-0.619],[1,-0.619]]);
const BOARD_Y = spline([[0,0.930],[0.05,0.930],[0.22,0.884],[0.45,0.856],[0.70,0.802],[0.88,0.7508],[1,0.7508]]);
const BOARD_S = spline([[0,0.5140],[0.07,0.5140],[0.50,0.5750],[0.88,0.6373],[1,0.6373]]);

/* Its front edge: out of his hands, onto the marble. Both ends are
   solved against their composite, so the first and last frames of the
   board's journey ARE the two supplied images. */
/* He is gone early because he has to be: the camera rise puts his head
   through the top of the frame at u = 0.27, and a headless torso
   standing over the table is worse than an early exit. The board is
   already on its way down by then, so what you read is a handover. */
const BHAI_STEP  = 0.08;
const BHAI_GONE  = 0.235;

const TRANSITION_VH = 320;
const HOLD_VH       = 80;            // the table, empty, before anything is set on it
const COURSES_VH    = 360;

/* ------------------------------------------------------------------ */
/* Monotone cubic interpolation (Fritsch–Carlson): C1-continuous and
   guaranteed never to overshoot, so the camera cannot back up or
   bounce between keys.                                               */
function spline(pts) {
  const n = pts.length, xs = [], ys = [], dx = [], dy = [], m = [];
  for (let i = 0; i < n; i++) { xs.push(pts[i][0]); ys.push(pts[i][1]); }
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; dy[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  m[0] = dy[0]; m[n - 1] = dy[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (dy[i - 1] * dy[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / dy[i - 1] + w2 / dy[i]);
    }
  }
  return function (x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = n - 2; while (xs[k] > x) k--;
    const h = dx[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
    return ys[k] * (2 * t3 - 3 * t2 + 1) + h * m[k] * (t3 - 2 * t2 + t) +
           ys[k + 1] * (-2 * t3 + 3 * t2) + h * m[k + 1] * (t3 - t2);
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;

/* Scroll progress -> progress along the path. Easing it buys the top of
   the page a stretch where the scene barely moves — long enough to read
   the hero — and takes the rate off the arrival, without changing the
   path itself. Everything below is keyed in u, not in scroll, so the
   board and the figure stay locked to the camera whatever this does. */
const along = p => { const t = clamp01(p); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ */
/* ONE camera path. Position and pitch are interpolated every frame
   straight from scroll progress — there are no stages.               */
const PATH_Y = spline([[0,1.40],[0.15,1.43],[0.35,1.55],[0.50,1.70],[0.65,1.87],[0.80,2.03],[0.92,2.15],[1,2.20]]);
const PATH_Z = spline([[0,0.000],[0.15,-0.160],[0.35,-0.450],[0.50,-0.660],[0.65,-0.760],[0.80,-0.785],[0.92,-0.791],[1,-0.791]]);
const PITCH  = spline([[0,-2.5],[0.15,-7],[0.35,-24],[0.50,-42],[0.65,-62],[0.80,-78],[0.92,-87],[1,-90]]);

/* Projecting a plate onto a PLANE is exact from any camera, so the wall
   keeps the hero plate for the whole move — there is nothing to hand
   over, and a second plate there only doubles the tree and the
   banquette, which sit off the plane. The table is the problem: the
   hero plate
   puts the hero's FLOOR pixels on it, which is what makes progress 0
   seamless but is the wrong material the moment the top is big enough
   to read. That surface, and only that surface, is handed over.

   The two plates are never cross-faded at strength. They are different
   renders of the room, and any real overlap between them reads as a
   double exposure rather than a camera move; the hero plate is off the
   table before the mid plate arrives, and in the gap the table simply
   wears its own marble — which is the correct stone either way.

   The floor is a genuine plane in both plates, so the mid plate is
   exact on it too — and far sharper there than the hero plate, which by
   the middle of the move is smearing a 100px strip of the photograph
   across twenty metres of floor. It takes the floor over for the same
   stretch, and hands back to the sink rather than to that smear.

   Both mid weights peak at P_MID and come straight back off. That is
   the only progress at which the mid camera's frustum covers the
   screen; past it the plate's own frame edge walks inward, and holding
   the weight up would draw that rectangle across the tabletop. */
/* The wall and the floor never needed handing over while the move
   carried on past P_MID: the hero plate is exact on a plane from any
   camera, and a second plate on the wall doubled the tree and the
   banquette wherever the two cameras disagreed.

   Coming to rest AT P_MID changes that. There the two cameras are the
   same camera, so the mid plate is an identity mapping on every
   surface at once — and the ease has almost no rate left by then, so
   the handover happens across a stretch of scroll in which the camera
   barely moves and the two projections all but coincide. Taking the
   wall over as well is what makes the last frame the supplied
   photograph entire, rather than the photograph with the room's own
   tree still in the corner.

   It has to be late. Ghosting between the two plates is proportional
   to how far apart the two cameras are, and held across the middle of
   the move it doubles the tree and the banquette badly. Run over the
   last 7% of scroll the pitch changes by 0.4 deg, which is where the
   ease has left almost no rate at all, and the two projections very
   nearly coincide. The floor is left alone: the hero plate is already
   exact on it, and none of it is in frame by the end anyway. */
const PLATE_HERO_TABLE = spline([[0,1],[0.08,1],[0.24,0],[1,0]]);
const PLATE_MID_TABLE  = spline([[0,0],[0.30,0],[0.40,0.85],[P_MID,1],[0.52,0.78],[0.58,0.42],[0.66,0],[1,0]]);
const PLATE_MID_FLOOR  = spline([[0,0],[0.22,0],[0.38,0.85],[P_MID,1],[0.52,0.62],[0.58,0.22],[0.64,0],[1,0]]);

/* The floor is not meant to be looked at once the table owns the frame.
   Left alone it keeps tiling away in the surround, which is what made
   the move read as a picture of a floor rather than a room; instead it
   sinks into the board's dark stone from the moment the table takes the
   frame, so the surround falls off into shadow. */
const FLOOR_SINK = spline([[0,0],[0.44,0],[0.56,0.45],[0.68,0.80],[0.80,0.92],[1,0.92]]);

/* ================================================================== */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // pass the plates through untouched
renderer.setClearColor(0xEFE0CD, 1);                      // sampled off the hero's wall

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV0, 1, 0.05, 60);
const projector = new THREE.PerspectiveCamera(FOV0, 1, 0.05, 60);   // the progress-0 camera
projector.position.copy(EYE0);
projector.rotation.set(THREE.MathUtils.degToRad(PITCH0), 0, 0);

/* the P_MID camera, posed straight off the same path so the mid plate
   registers with the geometry by construction rather than by eye */
const midProj = new THREE.PerspectiveCamera(FOV0, 1, 0.05, 60);
midProj.position.set(0, PATH_Y(P_MID), PATH_Z(P_MID));
midProj.rotation.set(THREE.MathUtils.degToRad(PITCH(P_MID)), 0, 0);

const loader = new THREE.TextureLoader();
const small  = window.innerWidth <= 820;
const tex = n => { const t = loader.load(n, () => mark()); t.colorSpace = THREE.NoColorSpace; return t; };
const heroTex  = tex(small ? 'assets/hero-sm.webp' : 'assets/hero.webp');
const midTex   = tex(small ? 'assets/hero-table-sm.webp' : 'assets/hero-table.webp');
const tableTex = tex('assets/tabletop.webp');
const floorTex = tex('assets/floor.webp');
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
const shadowTex = tex('assets/shadow.webp');
const bhaiTex   = tex(small ? 'assets/bhai-sm.webp'    : 'assets/bhai.webp');
const boardTex  = tex(small ? 'assets/platter-sm.webp' : 'assets/platter.webp');

/* ------------------------------------------------------------------ */
const VERT = /* glsl */`
  uniform mat4 uHeroVP;
  uniform mat4 uMidVP;
  varying vec2 vUv;
  varying vec4 vHero;
  varying vec4 vMid;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vHero = uHeroVP * wp;
    vMid  = uMidVP  * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform sampler2D uHero;
  uniform sampler2D uMid;
  uniform vec2  uRepeat;
  uniform vec2  uCover;
  uniform float uPlate;     // how much of the projected hero plate to use
  uniform float uMidPlate;  // ...and of the mid-transition plate
  uniform float uSink;      // fade this surface into the dark stone
  uniform vec3  uSinkCol;
  uniform float uEllipse;   // 1 = clip this surface to a unit ellipse
  varying vec2 vUv;
  varying vec4 vHero;
  varying vec4 vMid;

  /* A projected plate is only honest inside its own frame. Past the
     edge, clamp() would smear the border pixel across the geometry, so
     the plate is faded out there instead and whatever is underneath
     carries that part of the surface. */
  float framed(vec2 uv){
    vec2 d = min(uv, 1.0 - uv);          // >= 0 inside the plate, < 0 outside
    return smoothstep(-0.015, 0.0, min(d.x, d.y));
  }

  void main(){
    float alpha = 1.0;
    vec3 col = texture2D(uMap, vUv * uRepeat).rgb;

    if (uEllipse > 0.5) {
      vec2 c = (vUv - 0.5) * 2.0;
      float r = dot(c, c);
      alpha = 1.0 - smoothstep(0.955, 1.0, r);
      if (alpha <= 0.003) discard;
      // the stone thickens and turns away at the rim
      col *= 1.0 - 0.13 * smoothstep(0.80, 1.0, r);
    }

    /* mid plate first, hero plate over the top of it: at p = 0 the hero
       must win outright, and it is the one that has to be exact. */
    if (uMidPlate > 0.0 && vMid.w > 0.0) {
      vec2 muv = vMid.xy / vMid.w * 0.5 + 0.5;
      muv = (muv - 0.5) * uCover + 0.5;
      col = mix(col, texture2D(uMid, clamp(muv, 0.0, 1.0)).rgb, uMidPlate * framed(muv));
    }

    if (uPlate > 0.0 && vHero.w > 0.0) {
      vec2 huv = vHero.xy / vHero.w * 0.5 + 0.5;
      huv = (huv - 0.5) * uCover + 0.5;
      col = mix(col, texture2D(uHero, clamp(huv, 0.0, 1.0)).rgb, uPlate * framed(huv));
    }

    if (uSink > 0.0) col = mix(col, uSinkCol, uSink);

    gl_FragColor = vec4(col, alpha);
  }`;

function surface(map, opts) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uMap:     { value: map },
      uHero:    { value: heroTex },
      uMid:     { value: midTex },
      uHeroVP:  { value: new THREE.Matrix4() },
      uMidVP:   { value: new THREE.Matrix4() },
      uRepeat:  { value: new THREE.Vector2(1, 1) },
      uCover:   { value: new THREE.Vector2(1, 1) },
      uPlate:   { value: opts.plate || 0 },
      uMidPlate:{ value: 0 },
      uSink:    { value: 0 },
      uSinkCol: { value: new THREE.Color().setHex(0x232224, THREE.NoColorSpace) },
      uEllipse: { value: opts.ellipse ? 1 : 0 }
    },
    transparent: !!opts.ellipse,
    depthWrite: true
  });
}

const wallMat  = surface(heroTex,  { plate: 1 });
const floorMat = surface(floorTex, { plate: 1 });
const tableMat = surface(tableTex, { plate: 1, ellipse: true });
const mats = [wallMat, floorMat, tableMat];

const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMat);
scene.add(wall);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -2);
floorMat.uniforms.uRepeat.value.set(22 / 0.9, 22 / 0.9);
scene.add(floor);

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(TABLE_RX * 2.5, TABLE_RZ * 2.5),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(TABLE_C.x + 0.22, 0.004, TABLE_C.z + 0.16);
scene.add(shadow);

const table = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_RX * 2, TABLE_RZ * 2), tableMat);
table.rotation.x = -Math.PI / 2;
table.position.copy(TABLE_C);
table.renderOrder = 2;
scene.add(table);

/* --- Masala Bhai ---------------------------------------------------
   A whole plane, standing clear behind the table's far rim, so it
   never crosses the tabletop and never z-fights along a seam. He
   writes depth while he is solid, so the table — which is drawn after
   him — takes him out from the rim down on its own, and takes more of
   him as the camera comes over the top. That occlusion is the thing
   that says he is behind it.                                          */
const bhaiMat = new THREE.MeshBasicMaterial({
  map: bhaiTex, transparent: true, alphaTest: 0.35, depthWrite: true, depthTest: true
});
const bhai = new THREE.Mesh(new THREE.PlaneGeometry(BHAI_W, BHAI_H), bhaiMat);
bhai.position.set(0, BHAI_TOP - BHAI_H / 2, BHAI_Z);
bhai.renderOrder = 1;
scene.add(bhai);

/* --- the food board ------------------------------------------------
   Pivoted on its front edge, so it tips about the edge it is set down
   on rather than about its middle, and always turned to face the
   camera. Depth testing is off: it is the nearest thing in the room at
   every frame, and switching it off is what keeps it off the tabletop's
   depth buffer while it is resting a millimetre above it.             */
const boardGeo = new THREE.PlaneGeometry(1, 1);
boardGeo.translate(0, 0.5, 0);
const boardMat = new THREE.MeshBasicMaterial({
  map: boardTex, transparent: true, depthWrite: false, depthTest: false
});
const board = new THREE.Mesh(boardGeo, boardMat);
board.renderOrder = 4;
scene.add(board);

/* what it throws on the marble: wide and faint while it is still up in
   his hands, tight and dark by the time it is down */
const boardShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 })
);
boardShadow.rotation.x = -Math.PI / 2;
boardShadow.renderOrder = 3;
scene.add(boardShadow);

/* ================================================================== */
const view = { w: 0, h: 0, fov: FOV0, finalY: 2.20, boardFit: 1 };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  view.w = w; view.h = h;
  const vpA = w / h;

  /* Keep the plate's vertical framing exactly, whatever the screen:
     a viewport wider than the plate crops it top and bottom, so the
     lens must narrow by the same amount or the 3D table would no
     longer line up with the table in the photograph. */
  const k = Math.min(1, IMG_AR / vpA);
  view.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV0 / 2)) * k));
  const tanH = Math.tan(THREE.MathUtils.degToRad(view.fov / 2));

  /* the overhead stop: the closest the camera can sit and still have
     the supplied photograph cover the frame */
  view.finalY = TABLE_Y + Math.min(0.5278 / tanH, 0.9377 / (vpA * tanH));

  /* A phone holds the plate's vertical framing and crops the sides, so
     the overhead frame there is barely half a metre across and a board
     sized for the desktop hangs off both edges. Fit it to the frame it
     actually lands in — eased in over the move, so the opening, where
     the board has to sit between his hands, is left alone. */
  const frameW = 2 * (view.finalY - TABLE_Y) * tanH * vpA;
  view.boardFit = Math.min(1, 0.78 * frameW / (BOARD_W * BOARD_S(1)));

  camera.fov = projector.fov = midProj.fov = view.fov;
  camera.aspect = projector.aspect = midProj.aspect = vpA;
  camera.updateProjectionMatrix(); projector.updateProjectionMatrix(); midProj.updateProjectionMatrix();
  projector.updateMatrixWorld(true); midProj.updateMatrixWorld(true);

  /* the wall is cut to exactly what the progress-0 lens sees of it,
     so the plate lands on it edge to edge with nothing to clamp */
  const d = Math.abs(WALL_Z - EYE0.z);
  const top = EYE0.y + d * Math.tan(THREE.MathUtils.degToRad(view.fov / 2 + PITCH0));
  const halfW = d * tanH * vpA * 1.02;
  wall.geometry.dispose();
  wall.geometry = new THREE.PlaneGeometry(halfW * 2, top * 1.02);
  wall.position.set(0, top * 1.02 / 2, WALL_Z);

  const cover = vpA > IMG_AR ? [1, IMG_AR / vpA] : [vpA / IMG_AR, 1];
  const vp    = new THREE.Matrix4().multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse);
  const vpMid = new THREE.Matrix4().multiplyMatrices(midProj.projectionMatrix,  midProj.matrixWorldInverse);
  mats.forEach(m => {
    m.uniforms.uHeroVP.value.copy(vp);
    m.uniforms.uMidVP.value.copy(vpMid);
    m.uniforms.uCover.value.set(cover[0], cover[1]);
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  mark();
}

/* ================================================================== */
const state = { p: 0, q: 0, dirty: true };
const mark = () => { state.dirty = true; };

function frame() {
  if (!state.dirty) return;
  state.dirty = false;
  const p = state.p, q = state.q;
  const u = along(p);            // progress along the camera path

  camera.position.set(
    0,
    PATH_Y(u) + (view.finalY - 2.20) * smooth(0.55, 1, u) + 0.14 * q,
    PATH_Z(u)
  );
  camera.rotation.set(THREE.MathUtils.degToRad(PITCH(u)), 0, 0);

  tableMat.uniforms.uPlate.value    = PLATE_HERO_TABLE(u);
  tableMat.uniforms.uMidPlate.value = PLATE_MID_TABLE(u);
  floorMat.uniforms.uMidPlate.value = PLATE_MID_FLOOR(u);
  floorMat.uniforms.uSink.value     = FLOOR_SINK(u);
  shadow.visible = u < 0.75;

  /* --- the board -------------------------------------------------
     Read straight off the path, not off a separate clock, so it can
     never drift out of step with the camera carrying it. Flat on the
     marble by u = 0.88 and not touched again: past there the only
     thing still moving it is the camera, which is what being on the
     table means.                                                     */
  const by = BOARD_Y(u);
  const bs = BOARD_S(u) * lerp(1, view.boardFit, smooth(0.12, 0.62, u));
  board.position.set(0, by, BOARD_Z(u));
  board.scale.set(BOARD_W * bs, BOARD_D * bs, 1);
  board.rotation.x = camera.rotation.x;          // face the camera: see the header

  const air = (by - 0.7508) / (0.930 - 0.7508);  // 1 in his hands, 0 on the marble
  /* The shadow belongs to the marble, so it only exists once the board
     is over it — gated on z, not on height. Without that gate it hangs
     in mid-air behind the table for the whole opening, because that is
     where the board starts. Wide and soft while the board is still up,
     tightening as it comes down.                                      */
  const onTable = smooth(-1.95, -1.72, board.position.z);
  const sw = BOARD_W * bs * lerp(1.12, 1.6, air);
  boardShadow.position.set(0.02 * sw, TABLE_Y + 0.002, board.position.z - BOARD_D * bs * 0.10);
  boardShadow.scale.set(sw, sw * 0.62, 1);
  boardShadow.material.opacity = 0.5 * onTable * (1 - 0.45 * air);

  /* --- Masala Bhai ------------------------------------------------
     Steps back once the board is down and goes with the light. He
     stops writing depth the moment he is no longer solid, so he does
     not punch a hole in the table on the way out.                    */
  const goZ = smooth(BHAI_STEP, BHAI_GONE, u);
  const goA = smooth(BHAI_STEP + 0.02, BHAI_GONE - 0.01, u);
  bhai.position.z = lerp(BHAI_Z, BHAI_BACK, goZ);
  bhaiMat.opacity = 1 - goA;
  bhaiMat.depthWrite = goA < 0.02;
  bhai.visible = goA < 0.999;

  renderer.render(scene, camera);
}

/* ================================================================== */
/* Scroll. Lenis smooths the input only; every value above is read
   straight off scroll position, so the move is scrubbed, never played. */
const el = {
  exp: document.getElementById('experience'),
  hero: document.getElementById('hero'),
  cue: document.getElementById('cue'),
  nav: document.getElementById('nav')
};

resize();
frame();

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!window.gsap || !window.ScrollTrigger || reduced) {
  document.documentElement.classList.add('no-motion');
} else {
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, touchMultiplier: 1.3 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  gsap.ticker.add(frame);

  const vh = n => n / 100 * view.h;
  el.exp.style.height = (TRANSITION_VH + HOLD_VH + COURSES_VH) + 'vh';

  let navStuck = null, heroOff = null;

  ScrollTrigger.create({
    trigger: el.exp,
    start: 'top top',
    end: () => '+=' + vh(TRANSITION_VH),
    scrub: 0.6,
    invalidateOnRefresh: true,
    onUpdate(self) {
      const p = self.progress;
      state.p = p; mark();

      const hp = Math.min(1, p / 0.16);
      el.hero.style.opacity = (1 - hp).toFixed(3);
      el.hero.style.transform = `translate3d(0,${(-9 * hp * view.h / 100).toFixed(2)}px,0) scale(${(1 - 0.07 * hp).toFixed(4)})`;
      const off = hp > 0.35;
      if (off !== heroOff) { el.hero.style.pointerEvents = off ? 'none' : 'auto'; heroOff = off; }
      el.cue.style.opacity = (1 - Math.min(1, p / 0.06)).toFixed(3);

      const stuck = p > 0.92;
      if (stuck !== navStuck) { el.nav.classList.toggle('is-stuck', stuck); navStuck = stuck; }
    }
  });

  /* The courses only begin after the table has been allowed to sit
     empty for HOLD_VH. Crowding them against the arrival is what makes
     a sequence like this feel cheap. */
  const cards = Array.from(document.querySelectorAll('.course'));
  const courses = gsap.timeline({
    scrollTrigger: {
      trigger: el.exp,
      start: () => 'top top-=' + vh(TRANSITION_VH + HOLD_VH),
      end: () => '+=' + vh(COURSES_VH),
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate(self) { state.q = self.progress; mark(); }
    }
  });

  cards.forEach((card, i) => {
    const plate = card.querySelector('.course__plate');
    const text  = card.querySelector('.course__text');
    courses.fromTo(card,  { opacity: 0 }, { opacity: 1, duration: 0.30, ease: 'power1.inOut' }, i)
           .fromTo(plate, { yPercent: 16, scale: 0.86, rotate: -5 },
                          { yPercent: 0, scale: 1, rotate: 0, duration: 0.50, ease: 'power2.out' }, i)
           .fromTo(text,  { yPercent: 28, opacity: 0 },
                          { yPercent: 0, opacity: 1, duration: 0.46, ease: 'power2.out' }, i + 0.06);
    if (i < cards.length - 1) {
      courses.to(card,  { opacity: 0, duration: 0.28, ease: 'power1.inOut' }, i + 0.68)
             .to(plate, { yPercent: -9, scale: 1.05, duration: 0.32, ease: 'power1.in' }, i + 0.68)
             .to(text,  { yPercent: -15, duration: 0.32, ease: 'power1.in' }, i + 0.68);
    }
  });
  courses.to({}, { duration: 0.22 });

  let lastW = window.innerWidth;
  const coarse = matchMedia('(pointer: coarse)').matches;
  window.addEventListener('resize', () => {
    if (coarse && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    resize(); ScrollTrigger.refresh();
  });
}
