# Release Pilot (offline)

Dashboard lokal untuk mempersiapkan metadata dan aset rilis sebelum dimasukkan ke Amuse. Tidak melakukan login, scraping, atau pengiriman otomatis ke Amuse.

## Menjalankan

Buka `index.html` di browser, atau jalankan server statis lokal seperti `npx serve .`.

## Cara pakai

1. Pilih satu folder berisi audio dan artwork. Nama `Artis - Judul.wav` akan dibaca sebagai draft metadata.
2. Pilih track dari daftar; judul, artis, tanggal draft, dan baris ©/℗ akan terisi sebagai usulan.
3. Gunakan Song Research untuk mencari kandidat terbuka, lalu isi dan verifikasi kredit pencipta.
4. Konfirmasikan kepemilikan hak distribusi, lalu simpan draft atau ekspor JSON.
5. Buka Amuse, unggah file lokal, salin data dari paket JSON, dan lakukan pengecekan final sendiri.

### Song Research

Isi brief bila ada, lalu pilih **Riset track ini** atau **Riset semua lagu**. Worker mencari referensi Google/Google News dan Wikipedia Indonesia, menampilkan beberapa kandidat beserta sumber, dan baru mengisi judul serta pencipta setelah pengguna memilih. Bila tidak ditemukan tersedia pilihan `Anonim`; gunakan `Publik Domain` hanya bila status hak cipta memang telah dipastikan.

## Jalur Cloudflare + GitHub

- Push proyek ini ke GitHub.
- Deploy dashboard statis ke Cloudflare Pages lewat integrasi GitHub.
- Tambahkan Cloudflare Worker sebagai API dan D1 untuk draft metadata.
- Simpan audio dan cover di R2 melalui URL unggah terbatas waktu; jangan menyimpan kata sandi Amuse.
- Jika integrasi resmi Amuse tersedia, Worker dapat membuat draft melalui API resmi. Tanpa API resmi, pertahankan browser-assisted flow dan persetujuan submit oleh pengguna.
- Untuk riset AI yang lebih kuat, Worker dapat menerima judul + brief, memakai penyedia AI dengan kemampuan web search, lalu mengembalikan kandidat beserta URL dan tingkat keyakinan. Simpan hanya hasil yang disetujui pengguna; jangan memperlakukan hasil AI sebagai kredit resmi.

Sebelum rilis, periksa spesifikasi berkas dan aturan metadata yang berlaku langsung di Amuse karena persyaratan dapat berubah.
