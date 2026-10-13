#!/usr/bin/env python3
"""Premium vertical 4K edit pipeline for talking-to-camera TikToks.

Stages (each is a subcommand):
  fetch    download the original from a Google Drive / Dropbox / direct link
  probe    report resolution, duration, frame rate, codec, HDR, audio
  analyse  transcribe, force-align every word, measure voice, detect the face
  render   build captions, pop-ups, zooms, colour and the audio mix from plan.json
  verify   check the rendered MP4 and write a contact sheet of key frames

The edit decisions (which phrases get pop-ups, where zooms go, which music
offset) live in plan.json so they are explicit and reviewable; `analyse`
writes plan.draft.json as a starting point.
"""
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

W, H = 2160, 3840
FONT_DIR = Path("/usr/share/fonts/opentype/inter")
FONTS = {
    "cap": ("Inter SemiBold", FONT_DIR / "Inter-SemiBold.otf"),
    "pop": ("Inter Display ExtraBold", FONT_DIR / "InterDisplay-ExtraBold.otf"),
    "sub": ("Inter Display SemiBold", FONT_DIR / "InterDisplay-SemiBold.otf"),
}
SFX_FILES = {
    "whoosh_short": "sfx_whoosh_short.wav",
    "whoosh_hit": "sfx_whoosh_hit.wav",
    "pop": "sfx_pop.wav",
    "impact": "sfx_impact.wav",
    "swipe": "sfx_swipe.wav",
}
# Peak level (dBFS) each effect is normalised to before mixing: audible but
# well under the voice, which sits around -15 LUFS / -2 dBTP.
SFX_PEAK_DB = {"whoosh_short": -17, "whoosh_hit": -16, "pop": -15, "impact": -14, "swipe": -19}


def run(cmd, capture=False, check=True):
    print("+", " ".join(str(c) for c in cmd)[:400], file=sys.stderr)
    r = subprocess.run([str(c) for c in cmd], text=True,
                       stdout=subprocess.PIPE if capture else None,
                       stderr=subprocess.PIPE if capture else None)
    if check and r.returncode != 0:
        if capture:
            sys.stderr.write(r.stderr[-4000:])
        raise SystemExit(f"command failed ({r.returncode}): {cmd[0]}")
    return r


def load_json(p):
    return json.loads(Path(p).read_text())


def save_json(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False))


# --------------------------------------------------------------------------
# fetch
# --------------------------------------------------------------------------

def direct_url(url):
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})", url) \
        or re.search(r"drive\.usercontent\.google\.com/.*[?&]id=([\w-]{20,})", url)
    if m:
        return f"https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t"
    if "dropbox.com" in url:
        url = re.sub(r"([?&])dl=0", r"\1dl=1", url)
        return url if "dl=1" in url or "raw=1" in url else url + ("&" if "?" in url else "?") + "dl=1"
    return url


def cmd_fetch(a):
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    tmp = work / "download.part"
    url = direct_url(a.url)
    run(["curl", "-L", "--fail", "--retry", "4", "--retry-delay", "2", "-sS",
         "-o", tmp, "-D", work / "download.headers", url])
    head = tmp.read_bytes()[:512].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html"):
        raise SystemExit("The link returned a web page, not the video. Make sure sharing is "
                         "set to 'Anyone with the link' and try again.")
    fmt = run(["ffprobe", "-v", "error", "-show_entries", "format=format_name",
               "-of", "csv=p=0", tmp], capture=True).stdout.strip()
    ext = ".mov" if "mov" in fmt else ".mp4"
    dst = work / f"source{ext}"
    tmp.replace(dst)
    sha = hashlib.sha256()
    with open(dst, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            sha.update(chunk)
    info = {"path": str(dst), "bytes": dst.stat().st_size, "sha256": sha.hexdigest()}
    save_json(work / "fetch.json", info)
    print(json.dumps(info, indent=2))


# --------------------------------------------------------------------------
# probe
# --------------------------------------------------------------------------

STD_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120]


def ratio(s):
    n, _, d = s.partition("/")
    return float(n) / float(d or 1) if float(d or 1) else 0.0


def probe(src):
    j = json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams",
                        "-of", "json", src], capture=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video"
             and not s.get("disposition", {}).get("attached_pic"))
    rot = 0
    for sd in v.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(sd["rotation"])
    if "rotate" in v.get("tags", {}):
        rot = int(v["tags"]["rotate"])
    w, h = v["width"], v["height"]
    if abs(rot) % 180 == 90:
        w, h = h, w
    avg = ratio(v.get("avg_frame_rate", "0/1"))
    fps = min(STD_RATES, key=lambda r: abs(r - avg)) if avg else ratio(v["r_frame_rate"])
    trc = v.get("color_transfer", "")
    dovi = any("dv_profile" in sd for sd in v.get("side_data_list", []))
    audio = [s for s in j["streams"] if s["codec_type"] == "audio"]
    usable = [s for s in audio if s["codec_name"] in ("aac", "alac", "mp3", "opus", "pcm_s16le",
                                                      "pcm_s24le", "pcm_f32le", "flac")]
    a = (usable or audio or [None])[0]
    return {
        "path": str(src),
        "bytes": int(j["format"]["size"]),
        "duration": float(j["format"]["duration"]),
        "width": w, "height": h, "rotation": rot,
        "fps": fps, "avg_frame_rate": round(avg, 3), "r_frame_rate": v["r_frame_rate"],
        "nb_frames": int(v.get("nb_frames", 0) or 0),
        "vcodec": v["codec_name"], "profile": v.get("profile"), "pix_fmt": v.get("pix_fmt"),
        "bit_rate": int(j["format"].get("bit_rate", 0)),
        "color_transfer": trc, "color_primaries": v.get("color_primaries", ""),
        "hdr": trc in ("arib-std-b67", "smpte2084") or dovi,
        "dolby_vision": dovi,
        "audio_index": a["index"] if a else None,
        "audio": ({"codec": a["codec_name"], "sample_rate": int(a["sample_rate"]),
                   "channels": a["channels"]} if a else None),
    }


def cmd_probe(a):
    info = probe(a.src)
    save_json(Path(a.work) / "probe.json", info)
    print(json.dumps(info, indent=2))


# --------------------------------------------------------------------------
# analyse
# --------------------------------------------------------------------------

def read_audio(path, sr=16000, stream=None):
    import numpy as np
    cmd = ["ffmpeg", "-v", "error", "-i", path]
    if stream is not None:
        cmd += ["-map", f"0:{stream}"]
    cmd += ["-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    raw = subprocess.run([str(c) for c in cmd], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def spoken_form(word):
    """Text the aligner can match: letters only, digits expanded to words."""
    from num2words import num2words
    w = word.strip()
    out = []
    cur = w.replace(",", "")
    pound = "£" in cur
    cur = cur.replace("£", "").replace("%", " percent").replace("&", " and ")
    for tok in re.findall(r"\d+(?:\.\d+)?|[A-Za-z']+", cur):
        if tok[0].isdigit():
            n = float(tok) if "." in tok else int(tok)
            if isinstance(n, int) and 1900 <= n <= 2099:
                out.append(num2words(n, to="year"))
            else:
                out.append(num2words(n))
        else:
            out.append(tok)
    if pound:
        out.append("pounds")
    s = " ".join(out).upper().replace("-", " ")
    return re.sub(r"[^A-Z' ]", "", s).split()


def force_align(audio16k, words):
    """Viterbi CTC alignment of the transcript against wav2vec2 emissions."""
    import torch
    import torchaudio
    bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
    model = bundle.get_model().eval()
    labels = bundle.get_labels()
    idx = {c: i for i, c in enumerate(labels)}
    wav = torch.from_numpy(audio16k).unsqueeze(0)
    with torch.inference_mode():
        em, _ = model(wav)
        em = torch.log_softmax(em, dim=-1)
    sec_per_frame = wav.shape[1] / em.shape[1] / bundle.sample_rate
    targets, owner = [], []
    for wi, w in enumerate(words):
        parts = spoken_form(w["word"])
        chars = [c for c in "|".join(parts) if c in idx]
        for c in chars:
            targets.append(idx[c])
            owner.append(wi)
        if chars:  # word separator between words
            targets.append(idx["|"])
            owner.append(-1)
    if not targets:
        return
    ali, scores = torchaudio.functional.forced_align(
        em, torch.tensor([targets], dtype=torch.int32), blank=0)
    ali, scores = ali[0].tolist(), scores[0].exp().tolist()
    # walk the frame path, attributing each emitted target token to its word
    span = {}
    ti = -1
    prev = 0
    for f, (tok, sc) in enumerate(zip(ali, scores)):
        if tok != 0 and (tok != prev or prev == 0):
            ti += 1
        if tok != 0 and 0 <= ti < len(owner) and owner[ti] >= 0:
            s = span.setdefault(owner[ti], [f, f, []])
            s[1] = f
            s[2].append(sc)
        prev = tok
    for wi, (f0, f1, sc) in span.items():
        words[wi]["a_start"] = round(f0 * sec_per_frame, 3)
        words[wi]["a_end"] = round((f1 + 1) * sec_per_frame, 3)
        words[wi]["a_score"] = round(sum(sc) / len(sc), 3)


def detect_faces(src, info, fps_sample=2.0):
    import cv2
    import numpy as np
    model = Path(__file__).resolve().parent / "models" / "yunet.onnx"
    if not model.exists():
        return []
    sw = 540
    sh = int(round(sw * info["height"] / info["width"] / 2)) * 2
    det = cv2.FaceDetectorYN.create(str(model), "", (sw, sh), 0.7)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf",
                             f"fps={fps_sample},scale={sw}:{sh}", "-f", "rawvideo",
                             "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    out, n = [], 0
    while True:
        buf = proc.stdout.read(sw * sh * 3)
        if len(buf) < sw * sh * 3:
            break
        img = np.frombuffer(buf, np.uint8).reshape(sh, sw, 3)
        _, faces = det.detect(img)
        t = n / fps_sample
        if faces is not None and len(faces):
            f = max(faces, key=lambda r: r[2] * r[3])
            out.append({"t": t, "x": float(f[0] / sw), "y": float(f[1] / sh),
                        "w": float(f[2] / sw), "h": float(f[3] / sh), "score": float(f[-1])})
        else:
            out.append({"t": t, "x": None})
        n += 1
    proc.wait()
    return out


VOICE_PRE = ("highpass=f=75,afftdn=nr=10:nf={nf}:tn=1,"
             "equalizer=f=220:t=q:w=1.0:g=-2,equalizer=f=3200:t=q:w=1.0:g=2,"
             "highshelf=f=9000:g=1.5,deesser=i=0.25,"
             "acompressor=threshold=-24dB:ratio=2.5:attack=8:release=140:makeup=2")
VOICE_TARGET = {"I": -15.0, "TP": -2.0, "LRA": 7.0}


def measure_voice(src, stream, nf):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-map", f"0:{stream}", "-af",
             VOICE_PRE.format(nf=nf) + ",loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json"
             .format(**VOICE_TARGET), "-f", "null", "-"], capture=True)
    j = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    return {k: j[k] for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}


def cmd_analyse(a):
    import numpy as np
    from faster_whisper import WhisperModel
    work = Path(a.work)
    info = load_json(work / "probe.json")
    src = info["path"]
    audio = read_audio(src, stream=info["audio_index"])
    sr = 16000

    print(f"transcribing with whisper {a.model} ...", file=sys.stderr)
    wm = WhisperModel(a.model, device="cpu", compute_type="int8")
    segs, _ = wm.transcribe(audio, language=a.language, word_timestamps=True, beam_size=5,
                            condition_on_previous_text=False, initial_prompt=a.prompt or None)
    words, segments = [], []
    for s in segs:
        segments.append({"start": s.start, "end": s.end, "text": s.text.strip()})
        for w in s.words:
            words.append({"word": w.word.strip(), "w_start": round(w.start, 3),
                          "w_end": round(w.end, 3), "prob": round(w.probability, 3),
                          "seg": len(segments) - 1})
    print(f"aligning {len(words)} words ...", file=sys.stderr)
    force_align(audio, words)

    # final timing: forced alignment (frame-accurate) unless it is unconfident;
    # whisper's own word times smear across pauses so they are only a fallback
    def db(x):
        return 20 * math.log10(max(float(np.sqrt(np.mean(x * x))) if len(x) else 0, 1e-6))
    for w in words:
        flags = []
        if "a_start" in w and w["a_score"] >= 0.3:
            w["start"], w["end"] = w["a_start"], w["a_end"]
            if w["a_score"] < 0.6 and abs(w["a_start"] - w["w_start"]) > 0.5:
                flags.append("alignment-disagrees")
        else:
            w["start"], w["end"] = w["w_start"], w["w_end"]
            flags.append("low-alignment-score" if "a_start" in w else "not-aligned")
        if w["prob"] < 0.5:
            flags.append("low-recognition-confidence")
        w["flags"] = flags
        w["db"] = round(db(audio[int(w["start"] * sr):int(w["end"] * sr)]), 1)
    for i, w in enumerate(words):  # keep words strictly ordered
        if i and w["start"] < words[i - 1]["end"]:
            w["start"] = max(w["start"], words[i - 1]["start"] + 0.04)
            words[i - 1]["end"] = min(words[i - 1]["end"], w["start"])
    for s_i in range(len(segments)):
        sw = [w for w in words if w["seg"] == s_i]
        if sw:
            med = float(np.median([w["db"] for w in sw]))
            for w in sw:
                w["emphasis_db"] = round(w["db"] - med, 1)

    # noise floor from the quietest 20 ms windows → denoiser setting
    win = audio[: len(audio) // 320 * 320].reshape(-1, 320)
    rms = 20 * np.log10(np.sqrt((win ** 2).mean(axis=1)) + 1e-9)
    noise_floor = float(np.percentile(rms, 10))
    nf = int(min(-25, max(-75, noise_floor)))
    loud = measure_voice(src, info["audio_index"], nf)

    faces = detect_faces(src, info)
    pauses = [{"after_word": i, "at": words[i]["end"], "gap": round(words[i + 1]["start"] - words[i]["end"], 3)}
              for i in range(len(words) - 1) if words[i + 1]["start"] - words[i]["end"] >= 0.3]
    analysis = {"words": words, "segments": segments, "pauses": pauses, "faces": faces,
                "noise_floor_db": round(noise_floor, 1), "denoise_nf": nf, "voice_loudness": loud}
    save_json(work / "analysis.json", analysis)

    lines = []
    for i, w in enumerate(words):
        flag = ("   <-- CHECK: " + ", ".join(w["flags"])) if w["flags"] else ""
        lines.append(f"{i:3d}  {w['start']:7.3f}-{w['end']:7.3f}  {w['word']:<16} "
                     f"p={w['prob']:.2f} emph={w.get('emphasis_db', 0):+5.1f}dB{flag}")
    (work / "words.txt").write_text("\n".join(lines) + "\n")
    (work / "transcript.txt").write_text(
        "\n".join(f"[{s['start']:6.2f}-{s['end']:6.2f}] {s['text']}" for s in segments) + "\n")
    save_json(work / "plan.draft.json", draft_plan(info, words, segments, faces))
    seen = [f for f in faces if f["x"] is not None]
    print(json.dumps({"words": len(words), "flagged": sum(bool(w["flags"]) for w in words),
                      "face_frames": f"{len(seen)}/{len(faces)}", "noise_floor_db": round(noise_floor, 1),
                      "voice_loudness": loud}, indent=2))


def draft_plan(info, words, segments, faces):
    """A starting point only: numbers and specs become pop-ups, questions get zooms."""
    pops, zooms = [], []
    text = [w["word"] for w in words]
    for i, w in enumerate(words):
        t = re.sub(r"[^\w£,.']", "", w["word"])
        nxt = re.sub(r"[^\w]", "", text[i + 1]).lower() if i + 1 < len(text) else ""
        if re.fullmatch(r"(19|20)\d\d", t):
            label = " ".join([t] + [re.sub(r"[^\w]", "", x).upper() for x in text[i + 1:i + 3]])
            pops.append({"style": "title", "text": label, "start": w["start"], "end": w["start"] + 1.6,
                         "sfx": "whoosh_hit", "why": "year mentioned"})
        elif t.startswith("£"):
            v = int(re.sub(r"\D", "", t) or 0)
            pops.append({"style": "number", "prefix": "£", "value": v, "countup": True,
                         "start": w["start"], "end": w["start"] + 1.7, "sfx": "impact", "why": "price"})
        elif re.fullmatch(r"\d+", t) and nxt in ("hp", "bhp", "horsepower", "horse", "mpg", "mph"):
            pops.append({"style": "tech", "text": t, "unit": nxt.upper().replace("HORSEPOWER", "HP")
                         .replace("HORSE", "HP"), "start": w["start"], "end": w["start"] + 1.6,
                         "sfx": "pop", "why": "spec"})
    for s in segments:
        if s["text"].endswith("?"):
            ws = [w for w in words if s["start"] - 0.05 <= w["start"] <= s["end"]]
            if ws:
                zooms.append({"start": ws[0]["start"], "in": 0.45, "hold_until": ws[-1]["end"],
                              "out": 0.6, "scale": 1.08, "focus": "face", "sfx": None, "why": "question"})
    return {"captions": {"y": 0.68, "size": 132, "overrides": {}, "hide": []},
            "popups": pops[:5], "zooms": zooms[:5],
            "music": {"file": "music_variety.wav", "offset": 0.0, "level_lufs": -27},
            "color": {"contrast": 1.03, "saturation": 1.0, "vibrance": 0.08, "gamma": 1.0,
                      "highlights": 0.97}}


# --------------------------------------------------------------------------
# render: ASS graphics
# --------------------------------------------------------------------------

def ass_time(t):
    cs = max(0, int(round(t * 100)))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_alpha(opacity):
    return f"&H{max(0, min(255, round((1 - opacity) * 255))):02X}&"


def ass_escape(s):
    return s.replace("\\", "").replace("{", "(").replace("}", ")")


def ease_out_back(p, s=1.6):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


def ease_out_cubic(p):
    return 1 - (1 - p) ** 3


def ease_in_cubic(p):
    return p ** 3


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


class Measurer:
    def __init__(self):
        from PIL import ImageFont
        self.cache = {}
        self.IF = ImageFont

    def width(self, key, size, text, spacing=0):
        path = FONTS[key][1]
        f = self.cache.get(path)
        if f is None:
            f = self.IF.truetype(str(path), 1000)
            self.cache[path] = f
        asc, desc = f.getmetrics()
        em = size * 1000 / (asc + desc)  # libass sizes fonts by ascent+descent
        return f.getlength(text) * em / 1000 + spacing * max(0, len(text) - 1)


def face_box_at(faces, t0, t1):
    """Union of face boxes (normalised) seen between t0 and t1."""
    fs = [f for f in faces if f.get("x") is not None and t0 - 0.5 <= f["t"] <= t1 + 0.5]
    if not fs:
        return None
    return (min(f["x"] for f in fs), min(f["y"] for f in fs),
            max(f["x"] + f["w"] for f in fs), max(f["y"] + f["h"] for f in fs))


def face_center(faces, t):
    fs = [f for f in faces if f.get("x") is not None and abs(f["t"] - t) <= 1.0]
    if not fs:
        return None
    f = min(fs, key=lambda f: abs(f["t"] - t))
    return (f["x"] + f["w"] / 2, f["y"] + f["h"] / 2)


def zoom_at(zooms, t):
    for z in zooms:
        a, ai, b, bo = z["start"], z["start"] + z["in"], z["hold_until"], z["hold_until"] + z["out"]
        s = z["scale"]
        if a <= t <= bo:
            if t < ai:
                p = (t - a) / z["in"]
                return 1 + (s - 1) * (p ** 3 * (p * (6 * p - 15) + 10)), z
            if t < b:
                return s + 0.012 * (t - ai) / max(b - ai, 1e-3), z
            p = (t - b) / z["out"]
            return s + 0.012 - (s + 0.012 - 1) * (p ** 3 * (p * (6 * p - 15) + 10)), z
    return 1.0, None


def caption_y(plan, faces, duration):
    y = plan["captions"].get("y", 0.68) * H
    box = face_box_at(faces, 0, duration)
    if box and plan["captions"].get("avoid_face", True):
        # only the bulk of the video matters: use 90th percentile of face bottoms
        bottoms = sorted(f["y"] + f["h"] for f in faces if f.get("x") is not None)
        fb = bottoms[int(0.9 * (len(bottoms) - 1))] * H
        if fb + 140 > y:
            y = min(fb + 160, 0.76 * H)
    return y


def build_ass(plan, analysis, info, t0, dur, fps):
    m = Measurer()
    words = analysis["words"]
    faces = analysis["faces"]
    cap = plan["captions"]
    size = cap.get("size", 132)
    cy = caption_y(plan, faces, info["duration"])
    cx = W / 2
    ev = []

    def add(layer, s, e, style, text):
        s, e = s - t0, e - t0
        if e <= 0 or s >= dur:
            return
        ev.append((layer, max(0, s), min(dur, e), style, text))

    # one word at a time, synced to forced-aligned word starts
    hide = set(cap.get("hide", []))
    shown = [i for i in range(len(words)) if i not in hide]
    for k, i in enumerate(shown):
        w = words[i]
        text = cap.get("overrides", {}).get(str(i), w["word"])
        text = ass_escape(re.sub(r"^[\"'(]+|[\"'),.!?;:…]+$", "", text.strip()))
        if not text:
            continue
        s = w["start"] - cap.get("lead", 0.0)
        nxt = words[shown[k + 1]]["start"] - cap.get("lead", 0.0) if k + 1 < len(shown) else None
        e = w["end"] + 0.35
        if nxt is not None:
            e = min(e, nxt) if nxt - w["end"] > 0.6 else nxt
        else:
            e = min(e, info["duration"])
        anim = int(clamp((e - s) * 0.6, 0.04, 0.10) * 1000)
        pop = rf"\fscx95\fscy95\t(0,{anim},0.5,\fscx100\fscy100)\fad({min(50, anim)},0)"
        add(0, s, e, "Cap", rf"{{\an5\pos({cx:.0f},{cy + 7:.0f})\1c&H000000&\1a&H80&\blur9{pop}}}{text}")
        add(1, s, e, "Cap", rf"{{\an5\pos({cx:.0f},{cy:.0f}){pop}}}{text}")

    # premium pop-ups, animated per frame so easing/overshoot/count-up are exact
    zooms = plan.get("zooms", [])
    for p in plan.get("popups", []):
        style = p["style"]
        ts, te = p["start"], p["end"]
        D = te - ts
        main_size = p.get("size", {"title": 270, "number": 340, "tech": 330}[style])
        if style == "number":
            final = f"{p.get('prefix', '')}{p['value']:,}{p.get('suffix', '')}"
        else:
            final = p["text"].upper() if style == "title" else p["text"]
        spacing = {"title": 6, "number": 0, "tech": 2}[style]
        unit = p.get("unit", "")
        unit_size = int(main_size * 0.5)
        tw = m.width("pop", main_size, final, spacing)
        uw = m.width("sub", unit_size, " " + unit, 12) if unit else 0
        total_w = tw + uw
        if total_w > 1650:  # keep inside the TikTok safe width
            k = 1650 / total_w
            main_size, unit_size, tw, uw, total_w = int(main_size * k), int(unit_size * k), tw * k, uw * k, 1650
        # placement: closest to the preferred height that clears face and captions
        if "y" in p:
            py = p["y"] * H
        else:
            box = face_box_at(faces, ts, te)
            zmax = max(zoom_at(zooms, ts + q * D / 8)[0] for q in range(9))
            fc = face_center(faces, (ts + te) / 2)
            half = main_size * 0.62 + 60
            pref = 0.53 * H
            cands = [H * f for f in (0.53, 0.48, 0.58, 0.30, 0.25, 0.20, 0.42, 0.36)]
            blocked = []
            if box:
                fx, fy = fc if fc else (0.5, 0.4)
                y0 = (fy + (box[1] - fy) * zmax) * H - 80
                y1 = (fy + (box[3] - fy) * zmax) * H + 80
                blocked.append((y0, y1))
            blocked.append((cy - size * 0.8, cy + size * 0.8))
            ok = [c for c in cands if all(c + half < b0 or c - half > b1 for b0, b1 in blocked)
                  and c - half > 0.09 * H]
            py = min(ok, key=lambda c: abs(c - pref)) if ok else 0.30 * H
        px = W / 2
        f0 = math.ceil((ts - 1e-6) * fps)
        f1 = math.floor(te * fps)
        enter, leave = 0.34, 0.24
        for n in range(f0, f1 + 1):
            u = n / fps - ts
            if u < enter:
                sc = 0.72 + 0.28 * ease_out_back(u / enter)
                op = clamp(u / 0.12)
                dy = 0
            elif u > D - leave:
                q = clamp((u - (D - leave)) / leave)
                sc = 1.015 - 0.06 * ease_in_cubic(q)
                op = 1 - ease_in_cubic(q)
                dy = -24 * ease_in_cubic(q)
            else:
                sc = 1 + 0.015 * (u - enter) / max(D - enter - leave, 1e-3)
                op, dy = 1.0, 0
            txt = final
            if style == "number" and p.get("countup"):
                cp = ease_out_cubic(clamp(u / 0.6))
                v = int(round(p["value"] * cp))
                step = 10 ** max(0, len(str(p["value"])) - 3)
                v = p["value"] if cp >= 1 else v // step * step
                txt = f"{p.get('prefix', '')}{v:,}{p.get('suffix', '')}"
            s = (n - 0.5) / fps
            e = (n + 0.5) / fps
            scs = f"\\fscx{sc * 100:.1f}\\fscy{sc * 100:.1f}"
            yy = py + dy
            body = rf"\fsp{spacing}\fs{main_size}"
            if unit:
                ua = ass_alpha(op * 0.75)
                utxt = rf"{{\fn{FONTS['sub'][0]}\fs{unit_size}\fsp12\1a{ua}}} {ass_escape(unit)}"
                utxt_sh = rf"{{\fn{FONTS['sub'][0]}\fs{unit_size}\fsp12}} {ass_escape(unit)}"
            else:
                utxt = utxt_sh = ""
            add(2, s, e, "Pop", rf"{{\an5\pos({px:.0f},{yy + 12:.0f}){body}{scs}\1c&H000000&"
                               rf"\1a{ass_alpha(op * 0.5)}\blur18}}{ass_escape(txt)}{utxt_sh}")
            add(3, s, e, "Pop", rf"{{\an5\pos({px:.0f},{yy:.0f}){body}{scs}\1a{ass_alpha(op)}}}"
                               rf"{ass_escape(txt)}{utxt}")
            # accent line(s)
            lp = ease_out_cubic(clamp((u - 0.12) / 0.4))
            if lp <= 0:
                continue
            la = ass_alpha(op * 0.85)
            th = max(6, main_size // 30)
            if style == "tech":
                L = 110
                gap = total_w * sc / 2 + 50
                rect = f"m 0 0 l {L} 0 l {L} {th} l 0 {th}"
                add(3, s, e, "Line", rf"{{\an6\pos({px - gap:.0f},{yy:.0f})\fscx{lp * 100:.1f}\1a{la}\p1}}{rect}")
                add(3, s, e, "Line", rf"{{\an4\pos({px + gap:.0f},{yy:.0f})\fscx{lp * 100:.1f}\1a{la}\p1}}{rect}")
            else:
                L = min(total_w * 0.42, 560)
                rect = f"m 0 0 l {L:.0f} 0 l {L:.0f} {th} l 0 {th}"
                ly = yy + main_size * 0.52 * sc + 26
                add(3, s, e, "Line", rf"{{\an5\pos({px:.0f},{ly:.0f})\fscx{lp * 100:.1f}\1a{la}\p1}}{rect}")

    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{FONTS['cap'][0]},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Pop,{FONTS['pop'][0]},270,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Line,{FONTS['cap'][0]},20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "".join(f"Dialogue: {l},{ass_time(s)},{ass_time(e)},{st},,0,0,0,,{tx}\n"
                   for l, s, e, st, tx in sorted(ev, key=lambda x: (x[1], x[0])))
    return head + body, cy


# --------------------------------------------------------------------------
# render: video + audio graph
# --------------------------------------------------------------------------

def smoother(p):
    return f"(({p})*({p})*({p})*(({p})*(6*({p})-15)+10))"


def zoom_exprs(zooms, faces, t0):
    T = f"(t+{t0:.4f})"
    z_e, x_e, y_e = "1", f"{W / 2:.0f}", f"{H / 2:.0f}"
    for z in reversed(zooms):
        a, ai = z["start"], z["start"] + z["in"]
        b, bo = z["hold_until"], z["hold_until"] + z["out"]
        s = z["scale"]
        if isinstance(z.get("focus"), list):
            fx, fy = z["focus"]
        else:
            fx, fy = face_center(faces, (a + b) / 2) or (0.5, 0.42)
        pin = smoother(f"({T}-{a:.4f})/{z['in']:.4f}")
        pout = smoother(f"({T}-{b:.4f})/{z['out']:.4f}")
        top = s + 0.012
        zin = f"(1+{s - 1:.5f}*{pin})"
        zhold = f"({s:.5f}+0.012*({T}-{ai:.4f})/{max(b - ai, 1e-3):.4f})"
        zout = f"({top:.5f}-{top - 1:.5f}*{pout})"
        z_e = (f"if(between({T},{a:.4f},{bo:.4f}),if(lt({T},{ai:.4f}),{zin},"
               f"if(lt({T},{b:.4f}),{zhold},{zout})),{z_e})")
        x_e = f"if(between({T},{a:.4f},{bo:.4f}),{fx * W:.0f},{x_e})"
        y_e = f"if(between({T},{a:.4f},{bo:.4f}),{fy * H:.0f},{y_e})"
    return z_e, x_e, y_e


def color_filter(c):
    hi = c.get("highlights", 1.0)
    curve = f"0/0 0.5/0.5 0.85/{0.85 - (1 - hi) * 0.5:.3f} 1/{hi:.3f}" if hi < 1 else None
    f = [f"eq=contrast={c.get('contrast', 1.0)}:saturation={c.get('saturation', 1.0)}"
         f":gamma={c.get('gamma', 1.0)}:brightness={c.get('brightness', 0.0)}"]
    if c.get("vibrance"):
        f.append(f"vibrance=intensity={c['vibrance']}")
    if c.get("temperature"):  # +warm / -cool, small values like 0.02
        t = c["temperature"]
        f.append(f"colorbalance=rm={t:.3f}:bm={-t:.3f}:rh={t / 2:.3f}:bh={-t / 2:.3f}")
    if curve:
        f.append(f"curves=all='{curve}'")
    return ",".join(f)


def measure_peak_db(path):
    import numpy as np
    x = read_audio(path, sr=48000)
    return 20 * math.log10(max(float(np.abs(x).max()), 1e-9))


def sfx_peak_offset(path):
    """Seconds from file start to the loudest moment (the 'hit' to sync with)."""
    import numpy as np
    x = read_audio(path, sr=16000)
    env = np.convolve(np.abs(x), np.ones(160) / 160, mode="same")
    return float(env.argmax()) / 16000


def measure_lufs(path, start, dur):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-ss", f"{start}", "-t", f"{dur}", "-i", path,
             "-af", "ebur128", "-f", "null", "-"], capture=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1])


def cmd_render(a):
    work = Path(a.work)
    assets = Path(a.assets)
    info = load_json(work / "probe.json")
    analysis = load_json(work / "analysis.json")
    plan = load_json(a.plan)
    fps = info["fps"]
    full = info["duration"]
    t0 = 0.0
    dur = full
    if a.preview:
        s, d = (float(x) for x in a.preview.split(":"))
        t0 = round(s * fps) / fps
        dur = min(d, full - t0)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tag = "preview" if a.preview else "final"

    ass, cap_y = build_ass(plan, analysis, info, t0, dur, fps)
    ass_path = work / f"graphics_{tag}.ass"
    ass_path.write_text(ass)

    # ---- video
    v = []
    if info["hdr"] and plan.get("hdr", "to_sdr") == "to_sdr":
        tin = "arib-std-b67" if info["color_transfer"] == "arib-std-b67" else "smpte2084"
        v.append(f"zscale=tin={tin}:min=bt2020nc:pin=bt2020:t=linear:npl=203,format=gbrpf32le,"
                 "zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,"
                 "zscale=t=bt709:m=bt709:r=tv")
    sw, sh = info["width"], info["height"]
    if abs(sw / sh - W / H) > 0.01:  # not 9:16: centre-crop to 9:16
        if sw / sh > W / H:
            v.append(f"crop=trunc(ih*{W}/{H}/2)*2:ih")
        else:
            v.append(f"crop=iw:trunc(iw*{H}/{W}/2)*2")
    v.append(f"scale={W}:{H}:flags=lanczos,setsar=1")
    v.append("format=yuv420p10le")
    v.append(color_filter(plan.get("color", {})))
    zooms = plan.get("zooms", [])
    if zooms:
        z, zx, zy = zoom_exprs(zooms, analysis["faces"], t0)
        v.append(f"scale=w='2*trunc({W}*({z})/2)':h='2*trunc({H}*({z})/2)':eval=frame:flags=bicubic")
        v.append(f"crop={W}:{H}:x='({zx})*(iw/{W}-1)':y='({zy})*(ih/{H}-1)'")
    v.append(f"ass='{ass_path}':fontsdir='{FONT_DIR}'")
    if a.scale:
        v.append(f"scale={a.scale}:flags=lanczos")
    graph = [f"[0:v]{','.join(v)}[v]"]

    # ---- audio
    nf = analysis["denoise_nf"]
    L = analysis["voice_loudness"]
    graph.append(
        f"[0:{info['audio_index']}]" + VOICE_PRE.format(nf=nf) +
        f",loudnorm=I={VOICE_TARGET['I']}:TP={VOICE_TARGET['TP']}:LRA={VOICE_TARGET['LRA']}"
        f":measured_I={L['input_i']}:measured_TP={L['input_tp']}:measured_LRA={L['input_lra']}"
        f":measured_thresh={L['input_thresh']}:offset={L['target_offset']}:linear=true"
        ",aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[voice][vkey]")
    inputs = [["-ss", f"{t0:.4f}", "-t", f"{dur:.4f}", "-i", info["path"]]]
    mix = ["[voice]"]
    mus = plan.get("music")
    if mus:
        mpath = assets / mus["file"]
        off = mus.get("offset", 0.0)
        gain = mus.get("level_lufs", -27) - measure_lufs(mpath, off, full)
        inputs.append(["-ss", f"{off + t0:.4f}", "-t", f"{dur:.4f}", "-i", mpath])
        fades = []
        if t0 < 0.01:
            fades.append("afade=t=in:st=0:d=0.8")
        fade_out_at = full - 1.8 - t0
        if fade_out_at < dur:
            fades.append(f"afade=t=out:st={max(0, fade_out_at):.3f}:d=1.8")
        graph.append(f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
                     f"volume={gain:.2f}dB{',' if fades else ''}{','.join(fades)}[mraw]")
        graph.append(f"[mraw][vkey]sidechaincompress=threshold={mus.get('duck_threshold', 0.04)}"
                     f":ratio={mus.get('duck_ratio', 4)}:attack=25:release=450:knee=4[music]")
        mix.append("[music]")
    else:
        graph.append("[vkey]anullsink")

    cues = []
    for p in plan.get("popups", []):
        if p.get("sfx"):
            land = p["start"] + 0.12
            if p["style"] == "number" and p.get("countup") and p["sfx"] == "impact":
                land = p["start"] + 0.55
            cues.append((p["sfx"], land, p.get("sfx_gain", 0)))
    for z in zooms:
        if z.get("sfx"):
            cues.append((z["sfx"], z["start"] + z["in"] * 0.5, z.get("sfx_gain", 0)))
    for c in plan.get("sfx", []):
        cues.append((c["name"], c["at"], c.get("gain", 0)))
    for name, at, g in cues:
        path = assets / SFX_FILES[name]
        start = at - sfx_peak_offset(path) - t0
        if start + 3 < 0 or start > dur:
            continue
        gain = SFX_PEAK_DB[name] + g - measure_peak_db(path) + plan.get("sfx_gain_db", 0)
        k = len(inputs)
        if start < 0:
            inputs.append(["-ss", f"{-start:.4f}", "-i", path])
            start = 0
        else:
            inputs.append(["-i", path])
        graph.append(f"[{k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
                     f"volume={gain:.2f}dB,adelay={int(start * 1000)}:all=1[sfx{k}]")
        mix.append(f"[sfx{k}]")
    graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,"
                 "alimiter=limit=0.89:attack=5:release=60:level=0[a]")

    fc = work / f"filter_{tag}.txt"
    fc.write_text(";\n".join(graph))
    if a.codec == "h264":
        venc = ["-c:v", "libx264", "-preset", a.x_preset or "slow", "-crf", str(a.crf or 16),
                "-pix_fmt", "yuv420p", "-profile:v", "high"]
    else:
        venc = ["-c:v", "libx265", "-preset", a.x_preset or "medium", "-crf", str(a.crf or 18),
                "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1",
                "-x265-params", "aq-mode=3:colorprim=bt709:transfer=bt709:colormatrix=bt709:log-level=error"]
    cmd = ["ffmpeg", "-hide_banner", "-y", "-loglevel", "warning", "-stats"]
    for i in inputs:
        cmd += i
    cmd += ["-filter_complex_script", fc, "-map", "[v]", "-map", "[a]",
            "-fps_mode", "cfr", "-r", f"{fps}", *venc,
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-t", f"{dur:.4f}",
            "-movflags", "+faststart", out]
    run(cmd)
    save_json(work / f"render_{tag}.json", {"out": str(out), "t0": t0, "dur": dur,
                                             "caption_y": cap_y, "cues": cues})
    print(f"rendered {out}")


# --------------------------------------------------------------------------
# verify
# --------------------------------------------------------------------------

def cmd_verify(a):
    work = Path(a.work)
    info = load_json(work / "probe.json")
    plan = load_json(a.plan)
    out = Path(a.file)
    checks = {}
    j = json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-count_frames",
                        "-of", "json", out], capture=True).stdout)
    vs = [s for s in j["streams"] if s["codec_type"] == "video"]
    au = [s for s in j["streams"] if s["codec_type"] == "audio"]
    v = vs[0]
    dur = float(j["format"]["duration"])
    expect_dur = float(a.expect_duration) if a.expect_duration else info["duration"]
    fr = ratio(v["avg_frame_rate"])
    ew, eh = (int(x) for x in (a.expect_size or f"{W}x{H}").split("x"))
    checks["exists"] = out.exists() and out.stat().st_size > 0
    checks["dimensions"] = (v["width"], v["height"]) == (ew, eh)
    checks["frame_rate"] = abs(fr - info["fps"]) < 0.01
    checks["duration_not_truncated"] = abs(dur - expect_dur) < 0.15
    checks["audio_present"] = bool(au) and au[0]["codec_name"] == "aac"
    n = int(v.get("nb_read_frames", 0))
    checks["frame_count"] = abs(n - round(expect_dur * info["fps"])) <= 2
    dec = run(["ffmpeg", "-v", "error", "-i", out, "-f", "null", "-"], capture=True, check=False)
    checks["decodes_cleanly"] = dec.returncode == 0 and not dec.stderr.strip()
    bd = run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-vf",
              "blackdetect=d=0.1:pic_th=0.97", "-an", "-f", "null", "-"], capture=True)
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd.stderr)
    checks["no_black_frames"] = not blacks
    lo = run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true",
              "-f", "null", "-"], capture=True).stderr
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", lo)[-1])
    peak = float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", lo)[-1])
    ass = (work / f"graphics_{a.tag}.ass").read_text()
    caps = [(l.split(",")[1], l.split(",")[2]) for l in ass.splitlines()
            if l.startswith("Dialogue: 1,")]

    def secs(s):
        h_, m_, rest = s.split(":")
        return int(h_) * 3600 + int(m_) * 60 + float(rest)
    spans = sorted((secs(s), secs(e)) for s, e in caps)
    checks["one_caption_word_at_a_time"] = all(spans[i][1] <= spans[i + 1][0] + 1e-6
                                                for i in range(len(spans) - 1))
    report = {"file": str(out), "bytes": out.stat().st_size, "codec": v["codec_name"],
              "pix_fmt": v.get("pix_fmt"), "width": v["width"], "height": v["height"],
              "fps": round(fr, 3), "duration": dur, "frames": n,
              "audio": au[0]["codec_name"] if au else None, "loudness_lufs": lufs,
              "true_peak_dbfs": peak, "black_segments": blacks, "caption_words": len(spans),
              "checks": checks, "all_passed": all(checks.values())}
    save_json(work / f"verify_{a.tag}.json", report)

    # contact sheet: pop-up landings, zoom peaks and a few caption frames
    t0 = load_json(work / f"render_{a.tag}.json")["t0"]
    times = [p["start"] + 0.5 for p in plan.get("popups", [])]
    times += [z["start"] + z["in"] + 0.1 for z in plan.get("zooms", [])]
    times = sorted({round(t - t0, 2) for t in times if 0 <= t - t0 < dur})
    if len(times) < 6:
        times += [round(dur * k / 7, 2) for k in range(1, 7 - len(times) + 1)]
    times = sorted(set(times))[:12]
    sheet_dir = work / f"sheet_{a.tag}"
    shutil.rmtree(sheet_dir, ignore_errors=True)
    sheet_dir.mkdir()
    for i, t in enumerate(times):
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", out, "-frames:v", "1", "-vf",
             f"scale=360:640,drawtext=fontfile={FONTS['cap'][1]}:text='{t:.2f}s':x=10:y=10:"
             "fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6",
             sheet_dir / f"{i:02d}.png"])
    cols = min(len(times), 6)
    rows = math.ceil(len(times) / cols)
    run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", sheet_dir / "%02d.png",
         "-vf", f"tile={cols}x{rows}:padding=6:color=white", "-frames:v", "1",
         work / f"contact_{a.tag}.png"])
    print(json.dumps(report, indent=2))
    if not report["all_passed"]:
        raise SystemExit("verification FAILED")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", default="work")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("fetch")
    p.add_argument("url")
    p = sub.add_parser("probe")
    p.add_argument("src")
    p = sub.add_parser("analyse")
    p.add_argument("--model", default="large-v3")
    p.add_argument("--language", default="en")
    p.add_argument("--prompt", default="")
    p = sub.add_parser("render")
    p.add_argument("--plan", required=True)
    p.add_argument("--assets", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--preview", help="START:DURATION in seconds")
    p.add_argument("--scale", help="e.g. 1080:1920 for a light preview")
    p.add_argument("--codec", choices=["h265", "h264"], default="h265")
    p.add_argument("--crf", type=int)
    p.add_argument("--x-preset")
    p = sub.add_parser("verify")
    p.add_argument("file")
    p.add_argument("--plan", required=True)
    p.add_argument("--tag", default="final")
    p.add_argument("--expect-size")
    p.add_argument("--expect-duration")
    a = ap.parse_args()
    {"fetch": cmd_fetch, "probe": cmd_probe, "analyse": cmd_analyse,
     "render": cmd_render, "verify": cmd_verify}[a.cmd](a)


if __name__ == "__main__":
    main()
