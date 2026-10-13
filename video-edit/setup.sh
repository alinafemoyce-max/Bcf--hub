#!/usr/bin/env bash
# One-time setup for the premium edit pipeline (Python venv + face model).
# Usage: video-edit/setup.sh [VENV_DIR]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VENV="${1:-$HERE/.venv}"

command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || { echo "ffmpeg/ffprobe required" >&2; exit 1; }
fc-list | grep -q "Inter-SemiBold" || echo "warning: Inter font not found in fontconfig" >&2

python3 -m venv "$VENV"
"$VENV/bin/pip" install -q faster-whisper opencv-python-headless pillow num2words
"$VENV/bin/pip" install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu

mkdir -p "$HERE/models"
YUNET="$HERE/models/yunet.onnx"
SHA=8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4
if ! echo "$SHA  $YUNET" | sha256sum -c --status 2>/dev/null; then
  curl -sSL --fail -o "$YUNET" \
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
  echo "$SHA  $YUNET" | sha256sum -c
fi
echo "ready: $VENV/bin/python -I $HERE/premium_edit.py --help"
