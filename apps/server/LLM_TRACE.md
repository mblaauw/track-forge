# Pipeline Trace — 2026-07-20T18:10:37.345Z

## runPipeline.start (2026-07-20T18:10:37.346Z)

```json
{
  "jobId": "2663050e-2554-497a-8009-c9ad1edb772f",
  "genreId": "hiphop",
  "presetId": "boom_bap_classic",
  "status": "in_progress",
  "inputs": {
    "subgenre": "boom_bap",
    "bpm": 95,
    "key": "C",
    "scale": "minor",
    "mood": "gritty",
    "narrativeArc": "braggadocio",
    "rhymeStyle": "multi_syllabic",
    "flowPattern": "laid_back",
    "delivery": "intense",
    "productionStyle": "vintage",
    "energy": 7,
    "complexity": 7,
    "lyricsMode": "full_lyrics",
    "tags": [
      {
        "label": "trap hi-hats",
        "cat": "rhythm",
        "weight": 2
      }
    ],
    "title": "Test",
    "name": "Test"
  }
}
```

## parsePipelineInputs (2026-07-20T18:10:37.346Z)

```json
{
  "jobId": "2663050e-2554-497a-8009-c9ad1edb772f",
  "descriptorCount": 1,
  "presetLabels": [],
  "hasTags": true,
  "tagCount": 1
}
```

## handleCompilation (2026-07-20T18:10:37.347Z)

```json
{
  "genreName": "Hip-Hop",
  "presetLabels": [],
  "descriptorCount": 1,
  "descriptors": [
    {
      "label": "trap hi-hats",
      "cat": "rhythm",
      "weight": 2
    }
  ],
  "compiledActiveCount": 1,
  "compiledStyle": "Hip-Hop. trap hi-hats, around 95 BPM in Cm. evolves gradually with a slow-building energy arc."
}
```

## parsePipelineInputs (2026-07-20T18:10:37.347Z)

```json
{
  "jobId": "2663050e-2554-497a-8009-c9ad1edb772f",
  "descriptorCount": 1,
  "presetLabels": [],
  "hasTags": true,
  "tagCount": 1
}
```

## handleLyricsWriting.prompt (2026-07-20T18:10:37.348Z)

```json
{
  "prompt": "You are a songwriter. Write lyrics for this song following the structure and style described below. Return ONLY valid JSON matching this schema:\n{\"document\":{\"sections\":[{\"type\":\"verse\",\"lines\":[\"line 1\",\"line 2\"]}]}}\n\nContext:\nSTYLE PROMPT:\nHip-Hop. trap hi-hats, around 95 BPM in Cm. evolves gradually with a slow-building energy arc.\n\nSTRUCTURE:\n\nBRIEF: (no brief — infer a fitting theme from the style)",
  "descriptorCount": 1,
  "lyricsMode": "full_lyrics"
}
```
