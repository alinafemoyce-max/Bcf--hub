# Premium 4K edit pipeline

Turns a talking-to-camera vertical clip into a finished 2160×3840 edit with
one-word captions, animated pop-ups, eased zooms, licensed music with ducking,
synced sound effects, voice clean-up and light colour correction.

It runs inside a Claude Code cloud session: the original video arrives through a
Google Drive / Dropbox share link, and the finished MP4 goes back to the
phone as a file in the chat.

```
video-edit/setup.sh /path/to/venv
PY="/path/to/venv/bin/python -I video-edit/premium_edit.py --work WORK"

$PY fetch "<share link>"                # downloads WORK/source.mov|mp4, sha256
$PY probe WORK/source.mov               # resolution, fps, duration, HDR, audio
$PY analyse --prompt "Skoda Fabia"      # whisper + wav2vec2 forced alignment, faces
#   → WORK/transcript.txt, WORK/words.txt (flagged words marked CHECK), plan.draft.json
#   edit the draft into plan.json (see below)
$PY render --plan plan.json --assets ASSETS --out preview.mp4 \
    --preview 12:8 --scale 1080:1920 --codec h264        # short preview
$PY verify preview.mp4 --plan plan.json --tag preview --expect-size 1080x1920 --expect-duration 8
$PY render --plan plan.json --assets ASSETS --out Skoda_Fabia_Premium_Edit_4K.mp4
$PY verify Skoda_Fabia_Premium_Edit_4K.mp4 --plan plan.json
```

`ASSETS` holds the music and sound-effect WAVs (Epidemic Sound, via the
connector): `music_*.wav`, `sfx_whoosh_short.wav`, `sfx_whoosh_hit.wav`,
`sfx_pop.wav`, `sfx_impact.wav`, `sfx_swipe.wav`. Source videos, work files
and renders are never committed.

## How it works

- **Word timing**: faster-whisper transcribes; wav2vec2 CTC forced alignment
  then times every word against the audio frames. Words the aligner is not
  confident about are flagged in `words.txt` for correction via
  `captions.overrides` / `captions.hide`.
- **Captions**: Inter SemiBold, white, soft blurred shadow, no outline or box.
  Exactly one word on screen, 95→100 % pop over ≤100 ms, fixed position in
  the lower-middle safe area, pushed below the face if needed.
- **Pop-ups**: drawn per frame in ASS (ease-out-back overshoot, count-up for
  numbers, animated accent lines), placed clear of the face and captions.
- **Zooms**: per-frame scale + crop anchored on the detected face,
  smootherstep easing, ≤115 %.
- **Audio**: high-pass, FFT denoise tuned to the measured noise floor, gentle
  EQ, de-ess, compression, two-pass loudness normalisation; music is ducked
  by the voice via sidechain compression; each sound effect's transient is
  aligned to its animation's landing frame; final limiter at −1 dBTP.
- **Output**: H.265 Main10 (`hvc1`, plays in iPhone Photos) or H.264, AAC
  320 kb/s, source frame rate. HDR sources are tone-mapped to SDR BT.709.

## plan.json

```json
{
  "captions": {"y": 0.68, "size": 132, "overrides": {"12": "Fabia"}, "hide": []},
  "popups": [
    {"style": "title",  "text": "2008 Fabia", "start": 3.1, "end": 4.9, "sfx": "whoosh_hit"},
    {"style": "number", "prefix": "£", "value": 2000, "countup": true, "start": 9.0, "end": 10.8, "sfx": "impact"},
    {"style": "tech",   "text": "85", "unit": "HP", "start": 20.2, "end": 21.9, "sfx": "pop"}
  ],
  "zooms": [
    {"start": 14.2, "in": 0.45, "hold_until": 16.0, "out": 0.6, "scale": 1.08, "focus": "face", "sfx": "whoosh_short"}
  ],
  "music": {"file": "music_variety.wav", "offset": 20.0, "level_lufs": -27},
  "color": {"contrast": 1.03, "saturation": 1.0, "vibrance": 0.08, "gamma": 1.0, "highlights": 0.97}
}
```

Pop-ups accept an explicit `"y"` (0–1 of frame height); otherwise they are
placed automatically.
