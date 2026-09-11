# Formatra

Aplikasi web semua alat dokumen dalam satu tempat — konversi, gabungkan, kompres,
lindungi, dan edit PDF, Word, Excel, PowerPoint, dan gambar, semuanya berjalan
**di browser** (client-side), dibangun dengan React + Vite + Tailwind CSS.

## Menjalankan proyek

```bash
npm install
npm run dev       # mode pengembangan, http://localhost:5173
npm run build     # build produksi ke folder dist/
npm run preview   # menjalankan hasil build secara lokal
```

Tidak ada backend/server yang **diwajibkan** — secara default semua pemrosesan
file (parsing, rendering, editing, ekspor) terjadi langsung di browser
pengguna menggunakan `pdf-lib`, `pdf.js`, dan library terkait.

Untuk tiga fitur konversi yang paling sensitif terhadap tata letak (Word→PDF,
PDF→Word, PPT→PDF), tersedia **backend opsional** di folder [`server/`](server/README.md)
yang memakai LibreOffice headless sebagai rendering engine sungguhan, dengan
fidelity jauh lebih tinggi (mendekati iLovePDF/Smallpdf). Jika server ini
tidak dijalankan/dikonfigurasi, ketiga fitur tersebut otomatis kembali ke mode
browser di bawah ini — tidak ada yang rusak, hanya fidelity yang lebih rendah.

## Struktur folder

```
src/
  components/        # Komponen UI reusable (Button, Card, Dropzone, dll)
    ui/
    layout/
    tool/             # Komponen bantu khusus halaman tool
  context/            # ThemeContext (dark/light), ToastContext (notifikasi)
  features/
    tools/            # Logic murni per fitur (mergePdf.js, watermarkPdf.js, dll)
    toolComponents/   # Halaman React untuk setiap tool
    editor/           # PDF Editor: store, canvas, toolbar, export
  hooks/              # useToolProcess, usePdfThumbnails
  lib/                # Konfigurasi pdf.js, daftar metadata tools
  pages/              # Dashboard, ToolPage (router generik)
  utils/              # formatBytes, download helpers, id generator
```

## Fitur

- **Konversi:** Word→PDF, PDF→Word, Excel→PDF, PowerPoint→PDF, Gambar↔PDF
- **Atur halaman:** Merge, Split, Reorder (drag & drop), Rotate, Hapus/Ekstrak
  halaman tertentu (pilih via thumbnail), Crop/potong margin dengan pratinjau
  langsung
- **Optimasi & keamanan:** Compress (ringan/kuat), Watermark, Protect (enkripsi
  AES-256 asli via `@cantoo/pdf-lib`, teruji round-trip dengan pdf.js), Unlock
  (hapus kata sandi bila kata sandinya diketahui), Nomor Halaman & header teks,
  Edit Metadata (judul, penulis, subjek, kata kunci)
- **Editor PDF:** thumbnail halaman, kanvas interaktif (fabric.js), tambah/edit
  teks, gambar, tanda tangan, highlight, gambar bebas, bentuk (persegi/lingkaran/
  garis), undo/redo, atur ulang & hapus halaman, ekspor ke PDF baru.
- **Perbaikan:** Repair PDF — membangun ulang dokumen yang rusak/gagal dibuka
  halaman demi halaman, melewati halaman yang benar-benar tidak bisa dipulihkan
  dan melaporkan hasilnya.
- **Pratinjau hasil:** setiap tool berbasis PDF/gambar kini punya tombol "Lihat"
  untuk memeriksa hasil langsung di browser sebelum diunduh.

## Batasan yang perlu diketahui

### Jika server konversi ([`server/`](server/README.md)) aktif

- **Word → PDF** dan **PPT → PDF** dirender dengan LibreOffice headless —
  font, ukuran, posisi elemen, margin, page/slide size, page break, tabel,
  gambar, header/footer, alignment, warna, shape, dan orientation
  dipertahankan mengikuti kemampuan native LibreOffice, bukan rekonstruksi
  manual. Fidelity bergantung pada font yang terpasang di server (lihat
  README server untuk daftar font pengganti yang disarankan).
- **PDF → Word** dirender ulang lewat filter import PDF LibreOffice lalu
  diekspor ke `.docx` — hasil tetap file Word yang bisa diedit, dengan tabel
  dan tata letak yang jauh lebih mendekati sumber dibanding ekstraksi teks
  murni. PDF pada dasarnya bukan format terstruktur, jadi untuk PDF yang
  sangat kompleks (kolom ganda rumit, PDF hasil scan) hasilnya tetap tidak
  bisa dijamin 100% identik.
- Batas ukuran file dan timeout mengikuti konfigurasi server (default 50MB,
  90 detik per konversi).

### Jika server konversi tidak dijalankan (mode browser, bawaan)

- **PowerPoint → PDF** hanya mengekstrak teks judul/isi slide; desain visual,
  gambar, dan bentuk slide asli tidak direkonstruksi.
- **PDF → Word** mengekstrak teks per halaman menjadi dokumen `.docx` yang
  bisa diedit; tabel/gambar/format visual asli tidak direkonstruksi.
- **Word → PDF** menggunakan rendering HTML (mammoth + html2canvas); tata
  letak sangat kompleks (multi-kolom, objek tertanam eksotis) mungkin sedikit
  berbeda dari aslinya.
- **Compress (mode Kuat)** merasterisasi setiap halaman menjadi gambar —
  ukuran file mengecil signifikan tetapi teks tidak lagi bisa diseleksi/dicari.
- **Editor PDF** menyimpan anotasi sebagai lapisan gambar transparan di atas
  halaman asli saat diekspor — visualnya sama seperti yang terlihat di
  editor, tetapi elemen anotasi tidak lagi berupa objek PDF yang bisa diedit
  ulang di aplikasi lain.

Fitur inti (Merge, Split, Rotate, Reorder, Watermark, Protect, Gambar↔PDF,
Excel→PDF) menghasilkan PDF dengan teks asli yang tetap bisa diseleksi/dicari,
tanpa rasterisasi.
