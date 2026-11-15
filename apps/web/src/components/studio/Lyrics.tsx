import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  ArrowClockwise,
  Copy,
  MicrophoneStage,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { formatSunoLyrics } from "@track-forge/contracts";
import { errorMessage, generateLyrics } from "../../api";
import type { GenreData } from "../../lib/genre-data";
import { useSession } from "../../lib/session";
import { sectionFamily, sectionIsVocal } from "./arrangement";
import type { LyricAngle, Section } from "./types";
import { Field, Segmented, Switch, useToast } from "./ui";

/** Rough syllable count — enough to compare line lengths at a glance. */
function syllables(text: string): number {
  if (!text.trim()) return 0;
  return Math.max(1, text.toLowerCase().match(/[aeiouy]+/g)?.length ?? 0);
}

export function Lyrics({
  data,
  style,
}: {
  data: GenreData | null;
  /** Compiled style prompt — gives the lyric writer the song's sound. */
  style: string;
}) {
  const s = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(s);
  latest.current = s;
  const sheetRef = useRef<HTMLOListElement>(null);
  // Enter and Backspace add or remove a line; focus moves to the right
  // line once it exists.
  const lineFocus = useRef<{ sectionId: string; index: number } | null>(null);
  useLayoutEffect(() => {
    const want = lineFocus.current;
    if (!want) return;
    lineFocus.current = null;
    sheetRef.current
      ?.querySelector<HTMLElement>(`[data-section="${want.sectionId}"]`)
      ?.querySelectorAll<HTMLInputElement>("input")
      [want.index]?.focus();
  }, [s.lyricLines]);

  const vocalsOn = s.lyricsMode === "full_lyrics";
  const sung = s.sections.filter(sectionIsVocal);
  const missing = sung.filter((sec) => !(s.lyricLines[sec.id]?.length ?? 0));
  const themes = data?.vocab.lyricThemes ?? [];
  const angles = data?.vocab.lyricAngles ?? [];

  const request = (sections: Section[]) =>
    generateLyrics({
      genreId: s.genreId,
      presetIds: s.presetIds,
      descriptors: s.tags
        .filter((t) => !t.muted)
        .map((t) => ({ label: t.label, cat: t.cat, weight: t.weight })),
      bpm: s.bpm ?? 128,
      style,
      sections: sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        bars: sec.bars,
        fn: sec.fn,
        deltas: sec.deltas,
        vocal: sec.vocal,
      })),
      lyricsMode: s.lyricsMode,
      vocalType: null,
      lyricTopic: s.lyricTopic,
      lyricThemes: s.lyricThemes,
      lyricAngle: s.lyricAngle,
    });

  // Never fabricates placeholder lines on failure — they would flow into
  // the version sent to Suno as if they were real.
  const write = async (target: "all" | Section | Section[]) => {
    const only =
      target === "all" ? null : Array.isArray(target) ? target : [target];
    setBusy(
      target === "all" ? "all" : Array.isArray(target) ? "missing" : target.id,
    );
    setError(null);
    try {
      const result = await request(only ?? s.sections);
      // A full draft replaces everything; otherwise only the sections that
      // were asked for change.
      // Merge into the lines as they are now: the inputs stay editable
      // while the writer works, and those edits must survive.
      const lines = only ? { ...latest.current.lyricLines } : {};
      const wanted = only ? new Set(only.map((sec) => sec.id)) : null;
      for (const sec of result.sections) {
        if (!wanted || wanted.has(sec.id)) lines[sec.id] = sec.lines;
      }
      s.setSession({ lyricsGenerated: true, lyricLines: lines });
    } catch (err) {
      setError(
        errorMessage(err, "The lyrics could not be written. Try again."),
      );
    } finally {
      setBusy(null);
    }
  };

  const setLines = (id: string, lines: string[]) =>
    s.setSession({ lyricLines: { ...s.lyricLines, [id]: lines } });

  const onLineKey = (e: KeyboardEvent, sec: Section, index: number) => {
    const lines = s.lyricLines[sec.id] ?? [];
    const input = e.currentTarget as HTMLInputElement;
    const focusLine = (i: number) => {
      lineFocus.current = { sectionId: sec.id, index: i };
    };
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...lines];
      next.splice(index + 1, 0, "");
      setLines(sec.id, next);
      focusLine(index + 1);
    } else if (
      e.key === "Backspace" &&
      input.value === "" &&
      lines.length > 1
    ) {
      e.preventDefault();
      setLines(
        sec.id,
        lines.filter((_, i) => i !== index),
      );
      focusLine(Math.max(0, index - 1));
    }
  };

  return (
    <section class="panel lyrics" aria-labelledby="lyrics-title">
      <header class="panel-head">
        <h2 class="panel-title" id="lyrics-title">
          Lyrics
        </h2>
        <label class="switch-row">
          <Switch
            checked={vocalsOn}
            label="Vocals and lyrics"
            testId="vocals-switch"
            onChange={(on) =>
              s.setSession({
                lyricsMode: on ? "full_lyrics" : "strict_instrumental",
              })
            }
          />
          <span>Vocals</span>
        </label>
        {vocalsOn && sung.length > 0 && (
          <div class="panel-tools">
            {s.lyricsGenerated && (
              <button
                type="button"
                class="btn btn-quiet"
                onClick={() =>
                  navigator.clipboard
                    .writeText(formatSunoLyrics(s.sections, s.lyricLines))
                    .then(() => toast({ message: "Lyrics copied" }))
                    .catch(() => {})
                }
              >
                <Copy size={15} /> Copy
              </button>
            )}
            <button
              type="button"
              class={`btn${s.lyricsGenerated ? " btn-quiet" : " btn-strong"}`}
              disabled={busy !== null}
              onClick={() => write("all")}
              data-testid="write-lyrics"
            >
              {s.lyricsGenerated ? (
                <ArrowClockwise size={15} />
              ) : (
                <Sparkle size={15} />
              )}
              {busy === "all"
                ? "Writing…"
                : s.lyricsGenerated
                  ? "Redraft all"
                  : "Write lyrics"}
            </button>
          </div>
        )}
      </header>

      {!vocalsOn ? (
        <p class="panel-note">
          No vocals or lyrics are sent. Suno gets the arrangement as part of the
          style prompt instead.
        </p>
      ) : (
        <>
          <div class="brief">
            <Field
              label="What is the song about?"
              hint="Leave it empty and the writer picks a theme that fits the sound."
            >
              {(id) => (
                <textarea
                  id={id}
                  class="input textarea"
                  rows={3}
                  data-testid="lyric-topic-input"
                  placeholder="A late-night drive after a breakup, chasing the last of the city lights"
                  value={s.lyricTopic}
                  onInput={(e) =>
                    s.setSession({
                      lyricTopic: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                />
              )}
            </Field>
            <div class="brief-side">
              {angles.length > 0 && (
                <div class="field">
                  <span class="field-label">Told as</span>
                  <Segmented<LyricAngle>
                    label="Told as"
                    size="sm"
                    wrap
                    value={s.lyricAngle}
                    options={angles.map((a) => ({
                      value: a.id as LyricAngle,
                      label: a.label,
                    }))}
                    onChange={(lyricAngle) => s.setSession({ lyricAngle })}
                  />
                </div>
              )}
              {themes.length > 0 && (
                <div class="field">
                  <span class="field-label">Themes</span>
                  <div class="chip-row">
                    {themes.map((theme) => {
                      const on = s.lyricThemes.includes(theme);
                      return (
                        <button
                          key={theme}
                          type="button"
                          class={`chip chip-toggle${on ? " chip-on" : ""}`}
                          aria-pressed={on}
                          onClick={() =>
                            s.setSession({
                              lyricThemes: on
                                ? s.lyricThemes.filter((t) => t !== theme)
                                : [...s.lyricThemes, theme],
                            })
                          }
                        >
                          {theme}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div class="notice notice-error" role="alert">
              <WarningCircle size={16} weight="fill" />
              <p class="notice-text">{error}</p>
            </div>
          )}

          {sung.length === 0 ? (
            <p class="panel-note">
              Nothing in this arrangement is sung yet. Add a verse, chorus or
              hook, or give a section the "vocal focus" change.
            </p>
          ) : !s.lyricsGenerated ? (
            <p class="panel-note">
              Write the lyrics now to read and edit them first, or just forge:
              they are written for you as part of the forge.
            </p>
          ) : (
            <>
              {missing.length > 0 && (
                <div class="notice notice-warn" role="status">
                  <WarningCircle size={16} weight="fill" />
                  <p class="notice-text">
                    {missing.length === 1
                      ? `${missing[0]!.name} has no lines yet and would play without vocals.`
                      : `${missing.length} sung sections have no lines yet and would play without vocals.`}
                  </p>
                  <button
                    type="button"
                    class="btn notice-action"
                    disabled={busy !== null}
                    onClick={() => write(missing)}
                  >
                    {busy === "missing" ? "Writing…" : "Write them"}
                  </button>
                </div>
              )}
              <ol class="lyric-sheet" ref={sheetRef}>
                {s.sections.map((sec) => {
                  const isSung = sectionIsVocal(sec);
                  const lines = s.lyricLines[sec.id] ?? [];
                  return (
                    <li
                      key={sec.id}
                      class={`lyric-block fam-${sectionFamily(sec.name)}${isSung ? "" : " lyric-block-quiet"}`}
                    >
                      <div class="lyric-head">
                        <span class="fam-dot" />
                        <span class="lyric-name">{sec.name}</span>
                        {isSung ? (
                          <>
                            {sec.vocal?.type && (
                              <span class="lyric-voice">
                                <MicrophoneStage size={12} weight="fill" />
                                {sec.vocal.type.replace(/·/g, " / ")}
                              </span>
                            )}
                            <button
                              type="button"
                              class="btn btn-quiet btn-xs"
                              disabled={busy !== null}
                              onClick={() => write(sec)}
                            >
                              <ArrowClockwise size={13} />
                              {busy === sec.id
                                ? "Writing…"
                                : lines.length > 0
                                  ? "Redraft"
                                  : "Write lines"}
                            </button>
                          </>
                        ) : (
                          <span class="lyric-voice">Instrumental</span>
                        )}
                      </div>
                      {isSung && lines.length > 0 && (
                        <div class="lyric-lines" data-section={sec.id}>
                          {lines.map((line, i) => (
                            <div class="lyric-line" key={i}>
                              <span
                                class="lyric-count"
                                title="Approximate syllables"
                              >
                                {syllables(line)}
                              </span>
                              <input
                                class="lyric-input"
                                aria-label={`${sec.name}, line ${i + 1}`}
                                value={line}
                                onInput={(e) => {
                                  const next = [...lines];
                                  next[i] = (
                                    e.target as HTMLInputElement
                                  ).value;
                                  setLines(sec.id, next);
                                }}
                                onKeyDown={(e) => onLineKey(e, sec, i)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}
