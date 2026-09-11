"""Formatra local media conversion service.

Accepts a direct HTTP media URL that the user is authorized to download/process,
then uses FFmpeg to convert it to MP3 or MP4. It intentionally does not fetch
YouTube pages or bypass platform restrictions.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(title="Formatra Media Service", version="1.0.0")
MAX_MB = int(os.getenv("MEDIA_MAX_MB", "500"))
TIMEOUT = int(os.getenv("MEDIA_TIMEOUT_SECONDS", "600"))

ALLOWED_INPUT_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".flv", ".mpeg", ".mpg", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus"}

def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    return value[:100] or "formatra"

def error(message: str, status: int = 400):
    return JSONResponse({"error": message}, status_code=status)

@app.get("/health")
def health():
    return {"ok": True, "ffmpeg": bool(shutil.which("ffmpeg")), "maxMB": MAX_MB}

@app.get("/api/convert-url")
def convert_url(
    url: str = Query(...),
    format: str = Query("mp3"),
    bitrate: str = Query("192k"),
):
    if format not in {"mp3", "mp4"}:
        return error("Format harus mp3 atau mp4.")
    if not re.fullmatch(r"(?:128|192|256|320)k", bitrate):
        bitrate = "192k"
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return error("URL sumber harus HTTP atau HTTPS.")
        host = (parsed.hostname or "").lower()
        # Keep this service for direct media resources; it does not act as a YouTube downloader.
        if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"}:
            return error("Service Python ini tidak mengambil stream YouTube. Gunakan direct media URL yang kamu miliki atau berhak proses.", 422)
    except Exception:
        return error("URL sumber tidak valid.")

    if not shutil.which("ffmpeg"):
        return error("FFmpeg tidak ditemukan di PATH. Instal FFmpeg lalu jalankan ulang service Python.", 500)

    work = Path(tempfile.mkdtemp(prefix="formatra-media-"))
    try:
        source = work / "source"
        with requests.get(url, stream=True, timeout=60, headers={"User-Agent": "Formatra-Media-Service/1.0"}) as r:
            r.raise_for_status()
            length = int(r.headers.get("content-length") or 0)
            if length and length > MAX_MB * 1024 * 1024:
                return error(f"Media melebihi batas {MAX_MB} MB.", 413)
            total = 0
            with source.open("wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > MAX_MB * 1024 * 1024:
                        return error(f"Media melebihi batas {MAX_MB} MB.", 413)
                    f.write(chunk)

        output = work / ("formatra.mp3" if format == "mp3" else "formatra.mp4")
        if format == "mp3":
            cmd = ["ffmpeg", "-y", "-i", str(source), "-vn", "-c:a", "libmp3lame", "-b:a", bitrate, str(output)]
        else:
            cmd = ["ffmpeg", "-y", "-i", str(source), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", str(output)]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
        if proc.returncode != 0 or not output.exists() or output.stat().st_size == 0:
            detail = (proc.stderr or "").strip().splitlines()[-1:] or ["FFmpeg gagal memproses media."]
            return error(detail[0], 422)

        stem = safe_name(Path(urlparse(url).path).stem)
        return FileResponse(output, media_type="audio/mpeg" if format == "mp3" else "video/mp4", filename=f"{stem}.{format}", background=None)
    except requests.RequestException as exc:
        return error(f"Gagal mengambil direct media URL: {exc}", 502)
    except subprocess.TimeoutExpired:
        return error("Konversi melebihi batas waktu.", 504)
    except Exception as exc:
        return error(str(exc), 500)
    finally:
        # FileResponse needs the file to remain available until the response is sent;
        # use a lightweight cleanup thread/process in production. For this learning
        # service, keep the temp directory for the current process lifetime.
        pass
