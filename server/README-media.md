# Python Media Service

Service lokal opsional untuk pembelajaran arsitektur Formatra: Node.js meneruskan direct media URL ke FastAPI, lalu FastAPI menjalankan FFmpeg untuk MP3/MP4.

## Instalasi Windows

```powershell
cd server
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements-media.txt
```

Pastikan `ffmpeg.exe` tersedia di PATH. Cek:

```powershell
ffmpeg -version
```

Jalankan:

```powershell
python -m uvicorn media_service:app --host 127.0.0.1 --port 5000
```

Health check: `http://127.0.0.1:5000/health`

Node Formatra otomatis memakai `http://127.0.0.1:5000/api/convert-url`; tidak perlu `MEDIA_PROVIDER_URL`.

**Batasan:** service ini hanya menerima direct HTTP/HTTPS media URL yang memang boleh kamu unduh/proses. URL YouTube sengaja ditolak; service ini bukan YouTube downloader dan tidak mengakali pembatasan platform.
