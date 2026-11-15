import { useEffect } from "preact/hooks";
import { Fire, Shuffle } from "@phosphor-icons/react";
import { useForge } from "../../lib/forge";
import { useGenreData } from "../../lib/genre-data";
import { usePromptPreview } from "../../lib/preview";
import { useSession } from "../../lib/session";
import { Arrangement } from "./ArrangementPanel";
import { buildSections, randomTitle } from "./arrangement";
import { Lyrics } from "./Lyrics";
import { OutputDeck } from "./OutputDeck";
import { SessionsMenu } from "./SessionsMenu";
import { SoundZone, defaultDescriptors, presetSessionPatch } from "./SoundZone";
import type { Zone } from "./types";
import { ToastHost } from "./ui";

const ZONES: { id: Zone; label: string }[] = [
  { id: "sound", label: "Sound" },
  { id: "song", label: "Song" },
  { id: "output", label: "Output" },
];

/**
 * The whole app: three zones that follow the work.
 *   Sound  — what the track should sound like
 *   Song   — its arrangement and words
 *   Output — what Suno receives, the forge, and the takes that come back
 * Wide windows show all three; narrower ones bring one forward at a time.
 */
export function Studio() {
  return (
    <ToastHost>
      <StudioInner />
    </ToastHost>
  );
}

function StudioInner() {
  const s = useSession();
  const data = useGenreData(s.genreId);
  const preview = usePromptPreview();
  const { forge, canForge } = useForge();

  // A session with no preset is a blank one (first load, "New session", or
  // a genre switch): start it from the genre's first preset once that
  // genre's own data has loaded.
  useEffect(() => {
    if (!data || s.presetIds.length > 0) return;
    const first = data.presets[0];
    if (!first) return;
    const patch = presetSessionPatch(first);
    const sections = buildSections(
      first.songStructure ?? data.vocab.songStructure,
      patch.energy ?? s.energy,
      patch.complexity ?? s.complexity,
    );
    const theme = data.vocab.lyricThemes[0];
    s.setSession({
      ...patch,
      tags: defaultDescriptors(data.vocab.defaults),
      sections,
      selSectionId: sections[0]?.id ?? null,
      arrangeSource: "default",
      lyricThemes: theme ? [theme] : [],
      title: s.title || randomTitle(),
    });
  }, [data, s.presetIds.length]);

  // Forge from anywhere with Ctrl/Cmd + Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        forge();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [forge]);

  const forging = s.forgeRunning || s.status === "in_progress";

  return (
    <div class="app" data-zone={s.zone}>
      <header class="bar">
        <h1 class="brand">
          <span class="brand-mark" aria-hidden="true">
            <Fire size={16} weight="fill" />
          </span>
          <span class="brand-name">Track Forge</span>
        </h1>
        <SessionsMenu />
        <div class="title">
          <input
            class="title-input"
            aria-label="Track title"
            placeholder="Untitled track"
            value={s.title}
            onInput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              s.setSession({ title: value, name: value });
            }}
          />
          <button
            type="button"
            class="icon-btn"
            aria-label="Generate title"
            title="Suggest another title"
            onClick={() => {
              const title = randomTitle();
              s.setSession({ title, name: title });
            }}
          >
            <Shuffle size={16} />
          </button>
        </div>
        <nav class="zone-tabs" aria-label="Zones">
          {ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              class={`zone-tab zone-tab-${z.id}${s.zone === z.id ? " on" : ""}`}
              aria-current={s.zone === z.id ? "page" : undefined}
              data-testid={`zone-tab-${z.id}`}
              onClick={() => s.setSession({ zone: z.id })}
            >
              {z.label}
            </button>
          ))}
        </nav>
      </header>

      <main class="zones">
        <div class="zone zone-sound">
          <SoundZone data={data} />
        </div>
        <div class="zone zone-song">
          <Arrangement data={data} />
          <Lyrics data={data} style={preview.style} />
        </div>
        <OutputDeck preview={preview} onForge={forge} canForge={canForge} />
      </main>

      <div class="forge-dock">
        <span class="forge-dock-status">
          {forging ? s.forgeStageLabel || "Forging" : "Ready to forge"}
        </span>
        <button
          type="button"
          class="forge-btn"
          disabled={!canForge || forging}
          onClick={forge}
        >
          <Fire size={18} weight="fill" />
          {forging ? "Forging…" : "Forge"}
        </button>
      </div>
    </div>
  );
}
