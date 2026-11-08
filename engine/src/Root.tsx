import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { Timeline } from "./core/types";
import demo from "./demo-timeline.json";

// The timeline comes from tools/resolve.py (passed with --props); demo-timeline.json is only the Studio default.
export const Root: React.FC = () => (
  <Composition id="Short" component={Short} fps={30} width={1080} height={1920} durationInFrames={(demo as Timeline).frames}
    defaultProps={{ timeline: demo as Timeline }}
    calculateMetadata={({ props }) => ({ durationInFrames: props.timeline.frames, width: props.timeline.width, height: props.timeline.height, fps: props.timeline.fps })} />
);
