// "The 38-Minute War": 14 s vertical short in the flat-characters-in-a-3D-toon-world style.
// Post chain (from the bridge short): InkPass -> lens blur (pre + main) -> bloom (emissive only) -> Neutral tone map
// -> colour grade, MSAA 4. Pixel-sized parameters are specified at 1080x1920 and scale with the output size.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, shotAt, dofAt } from "./story";

export const ZANZIBAR_FRAMES = TOTAL;
type Props = { post?: { dpr?: number; ink?: boolean; lens?: boolean; composer?: boolean; bloom?: boolean; grade?: boolean; ms?: number }; audio?: boolean };
const props = () => getInputProps() as Props;

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(() => ({ ink: true, lens: true, composer: true, bloom: true, grade: true, ms: 4, ...(props().post ?? {}) }), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  // postprocessing's composer driven directly (the R3F wrapper never drew under Remotion's manual frame loop)
  const { gl, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { multisampling: on.ms, frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    if (on.ink) c.addPass(fx.ink);
    if (on.lens) { c.addPass(new EffectPass(camera, fx.lens.pre)); c.addPass(new EffectPass(camera, fx.lens.main)); }
    if (on.bloom) c.addPass(new EffectPass(camera, fx.bloom));
    c.addPass(on.grade ? new EffectPass(camera, fx.tone, fx.grade) : new EffectPass(camera, fx.tone));
    return c;
  }, [gl, scene, camera, fx, on]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => { if (on.composer) composer.render(); else gl.render(scene, camera); }, 1);
  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  const d = dofAt(id);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, "day");
  return <primitive object={world.root} dispose={null} />;
};

export const ZanzibarShort: React.FC = () => {
  const f = useCurrentFrame();
  const s = shotAt(f);
  const dpr = props().post?.dpr;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas key={s.id} width={1080} height={1920} {...(dpr ? { dpr } : {})} shadows
        gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 2600 }}>
        <Inner id={s.id} />
      </ThreeCanvas>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {props().audio ? <Audio src={staticFile("mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
