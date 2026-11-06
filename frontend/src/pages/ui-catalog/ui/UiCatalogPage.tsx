import { notFound } from "next/navigation";

import { BadgePreview } from "./BadgePreview";
import { ButtonPreview } from "./ButtonPreview";
import { ColorTokens } from "./ColorTokens";
import { Effects } from "./Effects";
import { FontSamples } from "./FontSamples";
import { GlassPreview } from "./GlassPreview";
import { IconPreview } from "./IconPreview";
import { MapPreview } from "./MapPreview";
import { NavButtonsPreview } from "./NavButtonsPreview";
import { RailPreview } from "./RailPreview";
import { TabBarPreview } from "./TabBarPreview";
import { TogglePreview } from "./TogglePreview";
import { TypeAndShape } from "./TypeAndShape";

// 디자인 토큰 · 공통 컴포넌트 견본. Figma 와 나란히 놓고 비교하는 개발용 화면이라 배포본에서는 404
export function UiCatalogPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-heading-24">UI 견본</h1>
      <p className="mt-1 text-body-13 text-text-2">
        기준: Figma 변수 IA v5 · docs/design/DESIGN.md
      </p>
      <ButtonPreview />
      <NavButtonsPreview />
      <BadgePreview />
      <TabBarPreview />
      <TogglePreview />
      <IconPreview />
      <MapPreview />
      <ColorTokens />
      <TypeAndShape />
      <Effects />
      <GlassPreview />
      <RailPreview />
      <FontSamples />
    </main>
  );
}
