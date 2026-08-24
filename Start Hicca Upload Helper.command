#!/bin/zsh
cd "${0:A:h}"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum tersedia. Instal Node.js 20 atau lebih baru, lalu jalankan helper kembali."
  read -k 1 "?Tekan tombol apa saja untuk menutup..."
  exit 1
fi
if /usr/bin/curl --silent --fail --max-time 2 -H "Origin: https://release.hiccastudios.my.id" http://127.0.0.1:47831/health >/dev/null 2>&1; then
  echo "Hicca Upload Helper sudah aktif. Membuka Release Pilot di Google Chrome..."
  /usr/bin/open -a "Google Chrome" "https://release.hiccastudios.my.id/"
  read -k 1 "?Tekan tombol apa saja untuk menutup jendela ini..."
  exit 0
fi
if [[ ! -d node_modules/playwright ]]; then
  echo "Menyiapkan Hicca Upload Helper untuk pertama kali..."
  if command -v pnpm >/dev/null 2>&1; then pnpm install; else npm install; fi
fi
echo "Helper aktif. Biarkan jendela ini terbuka selama upload."
if command -v pnpm >/dev/null 2>&1; then pnpm run helper; else npm run helper; fi
