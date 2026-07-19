import { Flame } from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { STAGE_LABELS } from "./arrangement";

export function ForgeStrip() {
  const { forgeRunning, forgeStageIdx } = useSession();
  if (!forgeRunning) return null;

  const label =
    STAGE_LABELS[
      Math.max(0, Math.min(forgeStageIdx, STAGE_LABELS.length - 1))
    ] ?? STAGE_LABELS[0]!;
  const pct = Math.round((forgeStageIdx / 8) * 100);

  return (
    <div class="forge-strip">
      <Flame size={16} class="forge-strip-flame" />
      <span class="forge-strip-label">{label}</span>
      <div class="forge-strip-bars">
        {Array.from({ length: 8 }, (_, i) => {
          const color =
            i < forgeStageIdx
              ? "#3DDC84"
              : i === forgeStageIdx
                ? "#9FE9C1"
                : "#33564a";
          return (
            <div
              key={i}
              class="forge-strip-bar"
              style={{ background: color }}
            />
          );
        })}
      </div>
      <span class="forge-strip-pct">{pct}%</span>
    </div>
  );
}
