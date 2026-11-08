// Generic preset-driven short. Input: a Timeline (tools/resolve.py output) as inputProps.timeline. Each shot builds
// its kit, frames its subject with a camera preset, places its characters and plays the global actions.
// Post chain (from the bridge short): RenderPass -> ink -> lens blur pre/main -> bloom -> Neutral tone map + grade.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "./core/ink";
import { LensBlur } from "./core/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./core/grade";
import { Env } from "./core/env";
import { ShotCamera, kickAt, applyKick, toward } from "./core/cameras";
import { runActions, KICK } from "./core/actions";
import { Card, FxPool } from "./core/cards";
import { OUTFITS } from "./core/characters";
import { Expr } from "./core/toon";
import { V3 } from "./core/geo";
import { Timeline, Shot } from "./core/types";
import { KITS } from "./kits";

type Props = { timeline: Timeline; audio?: string; post?: { dpr?: number; ink?: boolean; lens?: boolean } };
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const ShotScene: React.FC<{ shot: Shot; tl: Timeline; post: Props["post"] }> = ({ shot, tl, post }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const S = useMemo(() => {
    const kit = KITS[shot.kit];
    if (!kit) throw new Error(`unknown kit "${shot.kit}"`);
    const W = kit.build(shot.seed ?? 0);
    const env = new Env(W.root, W.water, W.sky);
    const sc = new ShotCamera(shot.camera, W);
    const st = sc.start(), sun = env.sunDir(st);
    const cards = shot.chars.map(() => new Card(W.root));
    const fx = new FxPool(W.root, false), soft = new FxPool(W.root, true);
    // character positions: an anchor id, or left/right/center in front of the camera looking at the subject
    const subj = W.anchors[shot.camera.subject], from = shot.camera.from ? W.anchors[shot.camera.from] : undefined;
    const charPos = shot.chars.map((c): V3 => {
      const A = W.anchors[c.place];
      if (A) return [A.p[0], A.ground ?? A.p[1], A.p[2]];
      const ang = c.angle ?? (c.place === "left" ? 7 : c.place === "right" ? -7 : 0);
      const gy = from?.ground ?? subj.ground ?? W.floor(st.pos[0], st.pos[2]);
      return toward(st.pos, subj.p, c.dist ?? 6, ang, gy);
    });
    const kicks: [number, number][] = tl.actions.filter((a) => KICK[a.id] || a.p?.kick !== undefined)
      .map((a) => [a.f, typeof a.p?.kick === "number" ? (a.p.kick as number) : KICK[a.id]]);
    return { W, env, sc, sun, cards, fx, soft, charPos, kicks, subj };
  }, [shot, tl]);
  const fxp = useMemo(() => ({
    ink: new InkPass(scene, cam), lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }), bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [scene, cam]);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { multisampling: 4, frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, cam));
    if (post?.ink !== false) c.addPass(fxp.ink);
    if (post?.lens !== false) { c.addPass(new EffectPass(cam, fxp.lens.pre)); c.addPass(new EffectPass(cam, fxp.lens.main)); }
    c.addPass(new EffectPass(cam, fxp.bloom));
    c.addPass(new EffectPass(cam, fxp.tone, fxp.grade));
    return c;
  }, [gl, scene, cam, fxp, post]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
  useEffect(() => () => { composer.dispose(); fxp.ink.dispose(); }, [composer, fxp]);
  useFrame(() => composer.render(), 1);

  // ---- pose the frame ----
  const t = f / tl.fps, u = (f - shot.a) / Math.max(1, shot.b - shot.a);
  let c = S.sc.at(u);
  const trk = shot.camera.follow !== false ? S.subj.track?.(t, tl.actions, tl.fps) : undefined;
  if (trk) c = { ...c, pos: [c.pos[0] + trk[0] * 0.3, c.pos[1] + trk[1] * 0.55, c.pos[2] + trk[2] * 0.3], look: [c.look[0] + trk[0], c.look[1] + trk[1], c.look[2] + trk[2]] };
  c = applyKick(c, kickAt(f, S.kicks));
  cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
  cam.fov = c.fov; cam.near = 0.2; cam.far = 2600; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  cam.layers.enable(3);
  const focus = new THREE.Vector3(...c.look);
  S.env.update(shot.light ?? "day", t, cam, scene, focus, S.sun);
  S.fx.reset(); S.soft.reset();
  const ctx = { t, f, fps: tl.fps, cam, actions: tl.actions, fx: S.fx, soft: S.soft, shot };
  S.W.update(ctx);
  runActions(ctx, S.W);
  shot.chars.forEach((ch, i) => {
    let e = ch.expr[0]?.[1] ?? "neutral";
    for (const [fr, ex] of ch.expr) if (f >= fr - 2) e = ex;
    const mirror = ch.mirror ?? ch.place === "right";
    S.cards[i].pose(cam, S.charPos[i], OUTFITS[ch.outfit]?.o ?? OUTFITS.townsman.o, e as Expr, mirror, i * 3 + 2, ch.view ?? "side", ch.scale ?? 1);
  });
  noInkFallback(S.W.root);
  // lens: focus on the first character, or the subject
  cam.getWorldDirection(fwd);
  if (shot.focus === "chars" && S.charPos[0]) fpt.set(S.charPos[0][0], S.charPos[0][1] + 1.6, S.charPos[0][2]);
  else { fpt.set(...S.subj.p); if (trk) fpt.add(new THREE.Vector3(...trk)); }
  fxp.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fxp.lens.cInf = shot.dof ?? 0;
  gradeFor(fxp.grade, shot.light ?? "day");
  return <primitive object={S.W.root} dispose={null} />;
};

export const Short: React.FC<Props> = (props) => {
  const p = { ...props, ...(getInputProps() as Partial<Props>) } as Props;
  const tl = p.timeline, f = useCurrentFrame();
  const shot = tl.shots.find((s) => f >= s.a && f < s.b) ?? tl.shots[tl.shots.length - 1];
  const fl = tl.flashes.map((x) => f - x).find((d) => d >= 0 && d < 4);
  const flash = fl === undefined ? 0 : [1, 0.75, 0.45, 0.2][fl];
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas key={shot.id} width={tl.width} height={tl.height} {...(p.post?.dpr ? { dpr: p.post.dpr } : {})} shadows
        gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 2600 }}>
        <ShotScene shot={shot} tl={tl} post={p.post} />
      </ThreeCanvas>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {p.audio ? <Audio src={staticFile(p.audio)} /> : null}
    </AbsoluteFill>
  );
};
