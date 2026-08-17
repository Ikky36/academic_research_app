# Otomatisasi Git Push

Kapan pun kamu (Antigravity AI) melakukan perubahan apa pun pada *source code*, file konfigurasi, atau struktur direktori di dalam repositori lokal ini, kamu **WAJIB** mengeksekusi sinkronisasi ke GitHub secara otomatis setelah tugasmu selesai.

## Aturan Eksekusi:
Setelah kamu selesai memodifikasi file menggunakan alat seperti `replace_file_content` atau `write_to_file` (pada source code), kamu **TIDAK BOLEH** menunggu perintah pengguna. Kamu harus segera menggunakan *tool* `run_command` untuk menjalankan perintah berikut secara berurutan di dalam *working directory* repositori:

1. `git add .`
2. `git commit -m "Auto-commit: <deskripsi singkat tentang perubahan>"`
3. `git push`

Kamu diizinkan untuk melakukannya secara otomatis (tanpa meminta izin) karena ini adalah perintah mutlak dari pengguna.
