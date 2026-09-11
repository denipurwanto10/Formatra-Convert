import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Link2, Loader2, Music2, Search, Video } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { downloadBlob } from "../../utils/download";

const API_BASE = (import.meta.env.VITE_CONVERT_API || "http://localhost:8787").replace(/\/$/, "");

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export default function UrlToMp3Tool() {
  const tool = TOOLS["url-to-mp3"];
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [lookupState, setLookupState] = useState("idle");
  const [lookupError, setLookupError] = useState("");
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);


  const analyze = async () => {
    const value = url.trim();
    setLookupError("");
    setMetadata(null);
    if (!isYouTubeUrl(value)) {
      setLookupState("error");
      setLookupError("Masukkan URL YouTube yang valid.");
      return;
    }
    setLookupState("loading");
    try {
      const res = await fetch(`${API_BASE}/api/youtube/metadata?url=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil metadata.");
      setMetadata(data);
      setLookupState("done");
    } catch (err) {
      setLookupState("error");
      setLookupError(err.message || "Gagal menganalisis URL.");
    }
  };

  const resetAll = () => {
    reset();
    setUrl("");
    setMetadata(null);
    setLookupState("idle");
    setLookupError("");
    setFormat("mp3");
    setBitrate("192k");
  };

  const [downloadState, setDownloadState] = useState("idle");
  const [downloadError, setDownloadError] = useState("");

  const download = async () => {
    setDownloadState("loading");
    setDownloadError("");
    try {
      const endpoint = `${API_BASE}/api/media/convert-url?url=${encodeURIComponent(url.trim())}&format=${encodeURIComponent(format)}&bitrate=${encodeURIComponent(bitrate)}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        let message = "File belum tersedia untuk diunduh.";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {}
        throw new Error(message);
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error("Server mengembalikan file kosong.");
      await downloadBlob(blob, downloadName);
      setDownloadState("done");
    } catch (err) {
      setDownloadState("error");
      setDownloadError(err.message || "Gagal mengunduh file.");
    }
  };

  const safeTitle = (metadata?.title || "audio").replace(/[\\/:*?"<>|]/g, "_").trim() || "audio";
  const downloadName = `${safeTitle}.${format}`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      <div className="mb-4 rounded-[var(--radius-md)] border-hair bg-surface-2 p-3 text-[12px] leading-relaxed text-muted">
        <strong className="text-ink">Mode belajar:</strong> alur URL → metadata → pilih format → download. Service Python lokal menangani konversi sumber media yang memang boleh kamu proses.
      </div>

      {status === "done" && result ? (
        <div className="flex flex-col gap-4">
          <ResultCard files={[{ name: downloadName, blob: result }]} onReset={resetAll} />
          <a
            href={URL.createObjectURL(result)}
            download={downloadName}
            className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-3 text-sm font-semibold text-surface transition-opacity hover:opacity-90"
          >
            <Download className="size-4" /> Download MP3
          </a>
        </div>
      ) : status === "error" ? (
        <ErrorState description={error} onRetry={resetAll} />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="rounded-[var(--radius-md)] border-hair bg-surface p-4 shadow-sm sm:p-5">
            <label className="mb-2 block text-[12.5px] font-medium text-muted">URL YouTube</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border-hair bg-surface-2 px-3">
                <Link2 className="size-4 shrink-0 text-muted" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyze()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted"
                />
              </div>
              <Button icon={Search} onClick={analyze} disabled={!url.trim() || lookupState === "loading"}>
                {lookupState === "loading" ? "Menganalisis..." : "Analyze"}
              </Button>
            </div>
            {lookupState === "loading" && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Mengambil metadata publik...</div>
            )}
            {lookupState === "error" && (
              <div className="mt-3 flex items-start gap-2 text-xs text-[var(--coral)]"><AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {lookupError}</div>
            )}
          </section>

          {metadata && (
            <section className="overflow-hidden rounded-[var(--radius-md)] border-hair bg-surface shadow-sm">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                {metadata.thumbnail ? (
                  <img src={metadata.thumbnail} alt="Thumbnail" className="aspect-video w-full rounded-lg object-cover sm:w-56" />
                ) : <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-surface-2 sm:w-56"><Music2 className="size-8 text-muted" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[var(--success)]"><CheckCircle2 className="size-3.5" /> Metadata found</div>
                  <h3 className="text-base font-semibold leading-snug text-ink">{metadata.title}</h3>
                  <p className="mt-1 text-xs text-muted">{metadata.author_name || "YouTube"}</p>
                  {metadata.html && <a href={metadata.html} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-medium text-accent hover:underline">Buka video asli ↗</a>}
                </div>
              </div>
            </section>
          )}

          {metadata && (
            <section className="rounded-[var(--radius-md)] border-hair bg-surface p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-ink">Download as</h3>
                <p className="mt-1 text-xs text-muted">Pilih format output untuk video yang dianalisis.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setFormat("mp3")} className={`rounded-xl border-hair p-4 text-left transition ${format === "mp3" ? "border-accent bg-surface-2" : "hover:bg-surface-2/60"}`}>
                  <Music2 className={`mb-2 size-5 ${format === "mp3" ? "text-accent" : "text-muted"}`} />
                  <div className="text-sm font-semibold text-ink">MP3</div>
                  <div className="mt-1 text-xs text-muted">Audio saja</div>
                </button>
                <button type="button" onClick={() => setFormat("mp4")} className={`rounded-xl border-hair p-4 text-left transition ${format === "mp4" ? "border-accent bg-surface-2" : "hover:bg-surface-2/60"}`}>
                  <Video className={`mb-2 size-5 ${format === "mp4" ? "text-accent" : "text-muted"}`} />
                  <div className="text-sm font-semibold text-ink">MP4</div>
                  <div className="mt-1 text-xs text-muted">Video + audio</div>
                </button>
              </div>

              {format === "mp3" && (
                <div className="mt-4">
                  <label className="mb-2 block text-[12.5px] font-medium text-muted">Audio quality</label>
                  <div className="flex flex-wrap gap-2">
                    {["128k", "192k", "256k", "320k"].map((b) => (
                      <button key={b} type="button" onClick={() => setBitrate(b)} className={`rounded-md border-hair px-3 py-1.5 text-[13px] font-medium ${bitrate === b ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"}`}>{b}</button>
                    ))}
                  </div>
                </div>
              )}

              {format === "mp4" && (
                <div className="mt-4 rounded-lg border-hair bg-surface-2 p-3 text-xs leading-relaxed text-muted">
                  Pilihan MP4 siap di tahap berikutnya. UI ini sengaja dipisahkan dari upload file lokal agar alurnya tetap seperti URL converter.
                </div>
              )}

              <button type="button" onClick={download} disabled={downloadState === "loading"} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-3 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {downloadState === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {downloadState === "loading" ? "Menyiapkan file..." : `Download ${format.toUpperCase()}`}
              </button>

              {downloadError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border-hair bg-surface-2 p-3 text-xs leading-relaxed text-[var(--coral)]">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                Konversi diproses oleh service Python lokal Formatra. Gunakan hanya sumber media yang kamu miliki atau berhak untuk konversi.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
