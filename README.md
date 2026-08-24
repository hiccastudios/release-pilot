# Release Pilot + Hicca Upload Helper

Dashboard untuk mempersiapkan metadata dan aset rilis. Hicca Upload Helper berjalan lokal, membuka profil Chrome khusus, mengisi Release Builder Amuse, dan berhenti sebelum `Submit Release`.

## Menjalankan

Buka [release.hiccastudios.my.id](https://release.hiccastudios.my.id). Untuk pengisian Amuse otomatis, klik dua kali `Start Hicca Upload Helper.command` dan biarkan jendela Terminal tetap terbuka. Instalasi pertama akan memasang Playwright melalui npm.

## Cara pakai

1. Pilih satu folder berisi audio dan artwork. Nama `Artis - Judul.wav` akan dibaca sebagai draft metadata.
2. Pilih track dari daftar; judul, artis, tanggal draft, dan baris ©/℗ akan terisi sebagai usulan.
3. Gunakan Song Research untuk mencari kandidat terbuka, lalu isi dan verifikasi kredit pencipta.
4. Konfirmasikan kepemilikan hak distribusi dan simpan draft.
5. Jalankan helper, lalu klik **Isi & upload ke Amuse**. Pilih folder rilis pada dialog macOS.
6. Login di browser Amuse khusus bila diminta, kembali ke Release Pilot, lalu klik **Lanjutkan setelah login**.
7. Periksa seluruh metadata di Amuse dan tekan `Submit Release` sendiri.

### Song Research

Isi brief bila ada, lalu pilih **Riset track ini** atau **Riset semua lagu**. Worker mencari referensi Google/Google News dan Wikipedia Indonesia, menampilkan beberapa kandidat beserta sumber, dan baru mengisi judul serta pencipta setelah pengguna memilih. Bila tidak ditemukan tersedia pilihan `Anonim`; gunakan `Publik Domain` hanya bila status hak cipta memang telah dipastikan.

## Keamanan helper

- Server hanya mendengarkan `127.0.0.1:47831` dan menerima permintaan browser dari domain Release Pilot.
- Password, cookie, audio, dan cover tidak dikirim ke Cloudflare atau GitHub.
- Sesi Amuse tersimpan lokal di profil `~/Library/Application Support/Hicca Upload Helper/chrome-profile`.
- Helper tidak memiliki aksi untuk menekan `Submit Release`.

## Jalur Cloudflare + GitHub

- Push proyek ini ke GitHub.
- Deploy dashboard statis ke Cloudflare Pages lewat integrasi GitHub.
- Tambahkan Cloudflare Worker sebagai API dan D1 untuk draft metadata.
- Simpan audio dan cover di R2 melalui URL unggah terbatas waktu; jangan menyimpan kata sandi Amuse.
- Jika integrasi resmi Amuse tersedia, Worker dapat membuat draft melalui API resmi. Saat ini helper memakai browser lokal dan persetujuan submit oleh pengguna.
- Untuk riset AI yang lebih kuat, Worker dapat menerima judul + brief, memakai penyedia AI dengan kemampuan web search, lalu mengembalikan kandidat beserta URL dan tingkat keyakinan. Simpan hanya hasil yang disetujui pengguna; jangan memperlakukan hasil AI sebagai kredit resmi.

Sebelum rilis, periksa spesifikasi berkas dan aturan metadata yang berlaku langsung di Amuse karena persyaratan dapat berubah.
