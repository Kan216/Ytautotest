import React from "react";
import { Composition } from "remotion";
import { ZanzibarShort, ZANZIBAR_FRAMES } from "./zanzibar/Zanzibar";

export const Root: React.FC = () => (<>
  <Composition id="ZanzibarShort" component={ZanzibarShort} durationInFrames={ZANZIBAR_FRAMES} fps={30} width={1080} height={1920} />
</>);
