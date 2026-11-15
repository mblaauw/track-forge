import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  MicrophoneStage,
  Plus,
  Shuffle,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { SUNO_LIMITS, estimateDurationSec } from "@track-forge/contracts";
import { useSession } from "../../lib/session";
import type { GenreData } from "../../lib/genre-data";
import {
  SECTION_FUNCTIONS,
  buildSections,
  generateId,
  nextSectionName,
  roleOf,
  sectionFamily,
  sectionShowsVocal,
} from "./arrangement";
import type { Section, SectionFunction, Vocal } from "./types";
import { Popover, Segmented, formatClock, useToast } from "./ui";

const MIN_BARS = 4;
const MAX_BARS = 64;
const BAR_STEP = 4;
const MIN_BPM = 60;
const MAX_BPM = 200;
const MAX_TAKE_TIME = formatClock(SUNO_LIMITS.maxDurationSec);

const VOCAL_INTENSITY = [
  { value: 1, label: "Intimate" },
  { value: 2, label: "Restrained" },
  { value: 3, label: "Balanced" },
  { value: 4, label: "Powerful" },
  { value: 5, label: "Explosive" },
] as const;

function secondsFor(bars: number, bpm: number): number {
  return (bars * 4 * 60) / Math.max(bpm, 1);
}

export function Arrangement({ data }: { data: GenreData | null }) {
  const s = useSession();
  const toast = useToast();
  // Undo runs later; it reads the session as it is then, not as it was.
  const latest = useRef(s);
  latest.current = s;
  const trackRef = useRef<HTMLDivElement>(null);
  // Keyboard moves change the selection or the order; focus follows the
  // selected section (moving a DOM node drops focus). A layout effect keyed
  // on what changed runs right after that change reaches the DOM — a plain
  // effect can fire late, for an earlier render, and focus the old section.
  const followFocus = useRef(false);
  useLayoutEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    trackRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus();
  }, [s.sections, s.selSectionId]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const bpm = s.bpm ?? 128;
  const sections = s.sections;
  const totalBars = sections.reduce((sum, sec) => sum + sec.bars, 0);
  const durationSec = estimateDurationSec(bpm, sections);
  const tooLong = durationSec > SUNO_LIMITS.maxDurationSec;
  const tooShort = durationSec > 0 && durationSec < SUNO_LIMITS.minDurationSec;
  // The slowest tempo at which this many bars still fits Suno's cap.
  const fitTempo = Math.ceil((totalBars * 240) / SUNO_LIMITS.maxDurationSec);
  const selIndex = sections.findIndex((sec) => sec.id === s.selSectionId);
  const sel = selIndex >= 0 ? sections[selIndex]! : null;

  const vocab = data?.vocab;
  const changePalette = vocab?.deltaPalette ?? [];
  const sectionTypes = vocab?.sectionPalette ?? [];
  const voiceTypes = vocab?.vocalPresets.map((v) => v.type) ?? [];
  const deliveries = [
    ...new Set(vocab?.vocalPresets.map((v) => v.deliveryStyle) ?? []),
  ];

  /* ── Editing ──────────────────────────────────────────────────────── */

  /**
   * A way back from a sweeping change. Undo puts the arrangement back, and
   * returns only the lyric lines the change took away — lines written or
   * edited since are kept. It does nothing once the genre has changed.
   */
  const offerUndo = (message: string) => {
    const snap = {
      genreId: s.genreId,
      sections: s.sections,
      selSectionId: s.selSectionId,
      arrangeSource: s.arrangeSource,
      lyricLines: s.lyricLines,
      lyricsGenerated: s.lyricsGenerated,
    };
    toast({
      message,
      actionLabel: "Undo",
      onAction: () => {
        const now = latest.current;
        if (now.genreId !== snap.genreId) return;
        s.setSession({
          sections: snap.sections,
          selSectionId: snap.selSectionId,
          arrangeSource: snap.arrangeSource,
          lyricLines: { ...snap.lyricLines, ...now.lyricLines },
          lyricsGenerated: snap.lyricsGenerated || now.lyricsGenerated,
        });
      },
    });
  };

  /** Apply a new section list; `undo` offers a way back for big changes. */
  const commit = (
    next: Section[],
    opts: {
      select?: string | null;
      lyricLines?: Record<string, string[]>;
      undo?: string;
    } = {},
  ) => {
    if (opts.undo) offerUndo(opts.undo);
    const lyricLines = opts.lyricLines ?? s.lyricLines;
    s.setSession({
      sections: next,
      arrangeSource: "custom",
      lyricLines,
      lyricsGenerated: s.lyricsGenerated && Object.keys(lyricLines).length > 0,
      ...(opts.select !== undefined ? { selSectionId: opts.select } : {}),
    });
  };

  const patch = (id: string, change: Partial<Section>) =>
    commit(
      sections.map((sec) => (sec.id === id ? { ...sec, ...change } : sec)),
    );

  const patchVocal = (sec: Section, change: Partial<Vocal>) =>
    patch(sec.id, {
      vocal: {
        type: voiceTypes[0] ?? "Lead",
        delivery: deliveries[0] ?? "",
        energy: 3,
        adlibs: false,
        harmonies: false,
        ...sec.vocal,
        ...change,
      },
    });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    commit(next);
  };

  const remove = (sec: Section) => {
    const index = sections.indexOf(sec);
    const next = sections.filter((x) => x.id !== sec.id);
    const { [sec.id]: _dropped, ...lyricLines } = s.lyricLines;
    commit(next, {
      select: (next[index] ?? next[index - 1])?.id ?? null,
      lyricLines,
      undo: `Removed ${sec.name}`,
    });
  };

  const duplicate = (sec: Section) => {
    const copy: Section = {
      ...sec,
      id: generateId(),
      name: nextSectionName(sec.name.replace(/\s*\d+$/, ""), sections),
    };
    const next = [...sections];
    next.splice(sections.indexOf(sec) + 1, 0, copy);
    // The copy starts with the same words; they can be redrafted on their own.
    const lines = s.lyricLines[sec.id];
    commit(next, {
      select: copy.id,
      lyricLines: lines
        ? { ...s.lyricLines, [copy.id]: [...lines] }
        : undefined,
    });
  };

  const addSection = (type: string) => {
    const created: Section = {
      id: generateId(),
      name: nextSectionName(type, sections),
      bars: 8,
      fn: sectionFamily(type) === "peak" ? "peak" : "establish",
      deltas: [],
    };
    const next = [...sections];
    next.splice(sel ? selIndex + 1 : sections.length, 0, created);
    commit(next, { select: created.id });
  };

  /** Back to the current preset's own arrangement (or the genre's). */
  const restoreDefault = () => {
    const preset = data?.presets.find(
      (p) => p.id === (s.presetId || s.presetIds[0]),
    );
    const next = buildSections(
      preset?.songStructure ?? vocab?.songStructure ?? [],
      s.energy,
      s.complexity,
    );
    if (s.sections.length > 0) {
      offerUndo("Arrangement reset to the preset's default");
    }
    s.setSession({
      sections: next,
      arrangeSource: "default",
      selSectionId: next[0]?.id ?? null,
      lyricLines: {},
      lyricsGenerated: false,
    });
  };

  /** Re-roll section lengths within the same structure. */
  const shuffleLengths = () => {
    const lengths = [4, 8, 8, 16, 16, 24, 32];
    commit(
      sections.map((sec) => ({
        ...sec,
        bars: lengths[Math.floor(Math.random() * lengths.length)]!,
      })),
      { undo: "Section lengths shuffled" },
    );
  };

  /* ── Drag to reorder ──────────────────────────────────────────────── */

  const onDragOver = (e: DragEvent, index: number) => {
    if (!dragId) return;
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropAt(e.clientX < box.left + box.width / 2 ? index : index + 1);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const from = sections.findIndex((sec) => sec.id === dragId);
    if (from >= 0 && dropAt !== null) {
      move(from, dropAt > from ? dropAt - 1 : dropAt);
    }
    setDragId(null);
    setDropAt(null);
  };

  const onRegionKey = (e: KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const sec = sections[index]!;
    if (dir) {
      e.preventDefault();
      const target = index + dir;
      if (target < 0 || target >= sections.length) return;
      followFocus.current = true;
      if (e.altKey) {
        // Moving a section selects it, so focus stays with what moved.
        s.setSession({ selSectionId: sec.id });
        move(index, target);
      } else {
        s.setSession({ selSectionId: sections[target]!.id });
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      followFocus.current = true;
      remove(sec);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  let barCursor = 0;
  const starts = sections.map((sec) => {
    const start = barCursor;
    barCursor += sec.bars;
    return start;
  });

  return (
    <section class="panel arr" aria-labelledby="arr-title">
      <header class="panel-head">
        <h2 class="panel-title" id="arr-title">
          Arrangement
        </h2>
        <p
          class={`arr-length${tooLong || tooShort ? " warn" : ""}`}
          data-testid="arrangement-duration"
        >
          <span>{totalBars} bars</span>
          <span class="arr-length-time">{formatClock(durationSec)}</span>
        </p>
        <div class="panel-tools">
          <label class="tempo">
            <span class="tempo-label">Tempo</span>
            <TempoInput
              value={bpm}
              onCommit={(next) => s.setSession({ bpm: next })}
            />
            <span class="tempo-unit">BPM</span>
            <input
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              class="range tempo-range"
              aria-label="Tempo"
              value={bpm}
              onInput={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                if (!Number.isNaN(v)) s.setSession({ bpm: v });
              }}
            />
          </label>
          <button
            type="button"
            class="btn btn-quiet"
            onClick={shuffleLengths}
            disabled={sections.length === 0}
            title="Re-roll every section's length"
          >
            <Shuffle size={15} /> Shuffle lengths
          </button>
          {s.arrangeSource === "custom" && (
            <button
              type="button"
              class="btn btn-quiet"
              onClick={restoreDefault}
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {(tooLong || tooShort) && (
        <div class="notice notice-warn" role="status">
          <WarningCircle size={16} weight="fill" />
          <p class="notice-text">
            {tooLong
              ? `Suno renders at most ${MAX_TAKE_TIME} per take, so the last ${formatClock(durationSec - SUNO_LIMITS.maxDurationSec)} of this arrangement would be cut. Shorten a section or raise the tempo.`
              : `Suno renders at least ${SUNO_LIMITS.minDurationSec} seconds. Add bars or lower the tempo.`}
          </p>
          {tooLong && fitTempo <= MAX_BPM && (
            <button
              type="button"
              class="btn notice-action"
              onClick={() => {
                const before = bpm;
                s.setSession({ bpm: fitTempo });
                toast({
                  message: `Tempo set to ${fitTempo} BPM`,
                  actionLabel: "Undo",
                  onAction: () => s.setSession({ bpm: before }),
                });
              }}
            >
              Set tempo to {fitTempo} BPM
            </button>
          )}
        </div>
      )}

      {sections.length === 0 ? (
        <div class="empty">
          <p>
            {data
              ? "This arrangement has no sections."
              : "Loading the arrangement…"}
          </p>
          {data && (
            <button type="button" class="btn" onClick={restoreDefault}>
              Use the preset's arrangement
            </button>
          )}
        </div>
      ) : (
        <div class="timeline">
          <div class="timeline-scroll">
            <div
              class="timeline-track"
              ref={trackRef}
              style={{ "--total-bars": totalBars }}
              role="listbox"
              aria-label="Sections, in order. Arrow keys move between sections; hold Alt to move a section."
              aria-orientation="horizontal"
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDropAt(null);
              }}
              onDrop={onDrop}
            >
              {sections.map((sec, i) => {
                const selected = sec.id === s.selSectionId;
                const role = roleOf(sec.fn);
                const sung = sectionShowsVocal(sec, s.lyricsMode);
                return (
                  <button
                    key={sec.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected || (selIndex < 0 && i === 0) ? 0 : -1}
                    draggable
                    class={[
                      "region",
                      `fam-${sectionFamily(sec.name)}`,
                      selected ? "selected" : "",
                      dragId === sec.id ? "dragging" : "",
                      dropAt === i ? "drop-before" : "",
                      dropAt === i + 1 && i === sections.length - 1
                        ? "drop-after"
                        : "",
                    ].join(" ")}
                    style={{ "--bars": sec.bars, "--energy": role.energy }}
                    title={`${sec.name} — ${sec.bars} bars, ${role.label.toLowerCase()}`}
                    data-testid={`region-${i}`}
                    onClick={() => s.setSession({ selSectionId: sec.id })}
                    onKeyDown={(e) => onRegionKey(e, i)}
                    onDragStart={(e) => {
                      setDragId(sec.id);
                      e.dataTransfer?.setData("text/plain", sec.id);
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropAt(null);
                    }}
                    onDragOver={(e) => onDragOver(e, i)}
                  >
                    <span class="region-name">{sec.name}</span>
                    <span class="region-meta">
                      {sung && (
                        <MicrophoneStage
                          size={12}
                          weight="fill"
                          aria-label="Sung"
                        />
                      )}
                      {sec.bars}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              class="ruler"
              aria-hidden="true"
              style={{ "--total-bars": totalBars }}
            >
              {sections.map((sec, i) => (
                <span
                  key={sec.id}
                  class="ruler-cell"
                  style={{ "--bars": sec.bars }}
                >
                  <span class="ruler-bar">{starts[i]! + 1}</span>
                  <span class="ruler-time">
                    {formatClock(secondsFor(starts[i]!, bpm))}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <Popover
            label="Add a section"
            align="end"
            panelClass="menu"
            trigger={({ toggle, ref, open: _open, ...aria }) => (
              <button
                type="button"
                class="region-add"
                ref={ref}
                onClick={toggle}
                title={
                  sel ? `Add a section after ${sel.name}` : "Add a section"
                }
                aria-label={
                  sel ? `Add a section after ${sel.name}` : "Add a section"
                }
                {...aria}
              >
                <Plus size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                <p class="menu-title">
                  {sel ? `Add after ${sel.name}` : "Add a section"}
                </p>
                <div class="menu-grid">
                  {sectionTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      class={`menu-item fam-${sectionFamily(type)}`}
                      onClick={() => {
                        addSection(type);
                        close();
                      }}
                    >
                      <span class="fam-dot" />
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Popover>
        </div>
      )}

      {sections.length > 0 && (
        <p class="arr-hint">
          Width is a section's length; height is how much energy its role
          carries. Select a section to edit it, drag to reorder.
        </p>
      )}

      {sel && (
        <div class={`inspector fam-${sectionFamily(sel.name)}`}>
          <div class="inspector-head">
            <h3 class="inspector-title">{sel.name}</h3>
            <span class="inspector-span">
              {formatClock(secondsFor(starts[selIndex]!, bpm))} –{" "}
              {formatClock(secondsFor(starts[selIndex]! + sel.bars, bpm))}
            </span>
            <div class="stepper" role="group" aria-label="Length in bars">
              <button
                type="button"
                class="stepper-btn"
                aria-label="Shorten by 4 bars"
                disabled={sel.bars <= MIN_BARS}
                onClick={() =>
                  patch(sel.id, {
                    bars: Math.max(MIN_BARS, sel.bars - BAR_STEP),
                  })
                }
              >
                −
              </button>
              <span class="stepper-value" aria-live="polite">
                {sel.bars} bars
              </span>
              <button
                type="button"
                class="stepper-btn"
                aria-label="Lengthen by 4 bars"
                disabled={sel.bars >= MAX_BARS}
                onClick={() =>
                  patch(sel.id, {
                    bars: Math.min(MAX_BARS, sel.bars + BAR_STEP),
                  })
                }
              >
                +
              </button>
            </div>
            <div class="inspector-actions">
              <button
                type="button"
                class="icon-btn"
                aria-label="Move earlier"
                title="Move earlier (Alt + ←)"
                disabled={selIndex === 0}
                onClick={() => move(selIndex, selIndex - 1)}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                class="icon-btn"
                aria-label="Move later"
                title="Move later (Alt + →)"
                disabled={selIndex === sections.length - 1}
                onClick={() => move(selIndex, selIndex + 1)}
              >
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                class="btn btn-quiet"
                onClick={() => duplicate(sel)}
              >
                <Copy size={15} /> Duplicate
              </button>
              <button
                type="button"
                class="btn btn-quiet btn-danger"
                onClick={() => remove(sel)}
              >
                <Trash size={15} /> Remove
              </button>
            </div>
          </div>

          <div class="inspector-body">
            <div class="field">
              <div class="field-head">
                <span class="field-label">Role in the song</span>
                <span class="field-aside">{roleOf(sel.fn).hint}</span>
              </div>
              <Segmented<SectionFunction>
                label="Role in the song"
                size="sm"
                wrap
                value={sel.fn}
                options={SECTION_FUNCTIONS.filter(
                  (f) => !vocab || vocab.sectionFunctions.includes(f.id),
                ).map((f) => ({ value: f.id, label: f.label, title: f.hint }))}
                onChange={(fn) => patch(sel.id, { fn })}
              />
            </div>

            <div class="field">
              <div class="field-head">
                <span class="field-label">Changes in this section</span>
                <span class="field-aside">
                  Sent as a tag on this section only
                </span>
              </div>
              <div class="chip-row">
                {sel.deltas.map((delta) => (
                  <span class="chip chip-on" key={delta}>
                    {delta}
                    <button
                      type="button"
                      class="chip-x"
                      aria-label={`Remove ${delta}`}
                      onClick={() =>
                        patch(sel.id, {
                          deltas: sel.deltas.filter((d) => d !== delta),
                        })
                      }
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <ChangePicker
                  options={changePalette
                    .filter((d) => !sel.deltas.includes(d))
                    .filter(
                      (d) =>
                        d !== "vocal focus" ||
                        s.lyricsMode !== "strict_instrumental",
                    )}
                  onPick={(delta) =>
                    patch(sel.id, { deltas: [...sel.deltas, delta] })
                  }
                />
              </div>
            </div>

            {sectionShowsVocal(sel, s.lyricsMode) && (
              <fieldset class="voice">
                <legend class="voice-legend">
                  <MicrophoneStage size={15} weight="fill" /> Voice
                </legend>
                <div class="voice-grid">
                  <div class="field">
                    <label class="field-label" for="voice-type">
                      Singer
                    </label>
                    <select
                      id="voice-type"
                      class="input select"
                      value={sel.vocal?.type ?? voiceTypes[0] ?? ""}
                      onChange={(e) =>
                        patchVocal(sel, {
                          type: (e.target as HTMLSelectElement).value,
                        })
                      }
                    >
                      {voiceTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/·/g, " / ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="field">
                    <span class="field-label">Intensity</span>
                    <Segmented
                      label="Vocal intensity"
                      size="sm"
                      wrap
                      value={sel.vocal?.energy ?? 3}
                      options={VOCAL_INTENSITY}
                      onChange={(energy) => patchVocal(sel, { energy })}
                    />
                  </div>
                  <div class="field">
                    <span class="field-label">Delivery</span>
                    <Segmented
                      label="Delivery"
                      size="sm"
                      wrap
                      value={sel.vocal?.delivery ?? ""}
                      options={deliveries.map((d) => ({ value: d, label: d }))}
                      onChange={(delivery) => patchVocal(sel, { delivery })}
                    />
                  </div>
                  <div class="field">
                    <span class="field-label">Extras</span>
                    <div class="chip-row">
                      {(
                        [
                          ["adlibs", "Ad-libs"],
                          ["harmonies", "Harmonies"],
                        ] as const
                      ).map(([key, label]) => {
                        const on = sel.vocal?.[key] ?? false;
                        return (
                          <button
                            key={key}
                            type="button"
                            class={`chip chip-toggle${on ? " chip-on" : ""}`}
                            aria-pressed={on}
                            onClick={() => patchVocal(sel, { [key]: !on })}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </fieldset>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Tempo as a number you can type. The session only changes once the text
 * is a tempo in range, so typing "90" does not pass through "9" and get
 * clamped on the way; anything else is tidied up on blur.
 */
function TempoInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (bpm: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_BPM}
      max={MAX_BPM}
      class="tempo-input"
      data-testid="bpm-input"
      aria-label="Tempo in BPM"
      value={draft ?? String(value)}
      onInput={(e) => {
        const text = (e.target as HTMLInputElement).value;
        setDraft(text);
        const n = parseInt(text, 10);
        if (!Number.isNaN(n) && n >= MIN_BPM && n <= MAX_BPM) onCommit(n);
      }}
      onBlur={() => {
        const n = parseInt(draft ?? "", 10);
        if (!Number.isNaN(n)) {
          onCommit(Math.min(MAX_BPM, Math.max(MIN_BPM, n)));
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** "Add change" — the full palette lives behind one button, filterable. */
function ChangePicker({
  options,
  onPick,
}: {
  options: string[];
  onPick: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = options.filter((o) =>
    o.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Popover
      label="Add a change"
      panelClass="picker"
      trigger={({ toggle, ref, open: _open, ...aria }) => (
        <button
          type="button"
          class="chip chip-add"
          ref={ref}
          onClick={() => {
            setQuery("");
            toggle();
          }}
          {...aria}
        >
          <Plus size={13} /> Add change
        </button>
      )}
    >
      {() => (
        <>
          <input
            class="input"
            placeholder="Filter changes"
            aria-label="Filter changes"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <div class="picker-list">
            {shown.map((option) => (
              <button
                key={option}
                type="button"
                class="chip"
                onClick={() => onPick(option)}
              >
                {option}
              </button>
            ))}
            {shown.length === 0 && (
              <p class="picker-empty">
                {options.length === 0
                  ? "Every change is already on this section."
                  : "Nothing matches that filter."}
              </p>
            )}
          </div>
        </>
      )}
    </Popover>
  );
}
