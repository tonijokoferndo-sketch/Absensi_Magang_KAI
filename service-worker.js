// =============================================
// SERVICE WORKER - ABSENSI MAGANG KAI
// =============================================
// Menaikkan angka versi ini setiap kali ada
// perubahan file (css/js/html) supaya cache lama
// dibersihkan dan pengguna dapat versi terbaru.

const CACHE_VERSION = "kai-absensi-v6";

// Semua path relatif terhadap lokasi service-worker.js
// (penting untuk GitHub Pages yang biasanya berada di
// subfolder, contoh: username.github.io/nama-repo/)
const APP_SHELL = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/config.js",
    "./js/api.js",
    "./js/auth.js",
    "./js/dashboard.js",
    "./js/scanner.js",
    "./js/app.js",
    "./assets/qrcode.min.js",
    "./assets/html5-qrcode.min.js",
    "./assets/kai-logo.jpeg",
    "./manifest.json",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/apple-touch-icon.png"
];


// =========================================
// INSTALL: simpan app shell ke cache
// =========================================

self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );

});


// =========================================
// ACTIVATE: bersihkan cache versi lama
// =========================================

self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then((keys) => {

            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            );

        }).then(() => self.clients.claim())
    );

});


// =========================================
// FETCH STRATEGY: NETWORK-FIRST
// =========================================
// - Request API absensi (POST) SELALU
//   lewat network langsung, tidak boleh di-cache,
//   karena datanya dinamis (login, absen, riwayat).
// - Request lain (file statis app shell) coba ambil
//   dari NETWORK dulu (supaya update terbaru langsung
//   kepakai begitu di-deploy), cache di-update setiap
//   berhasil fetch, dan cache HANYA dipakai sebagai
//   fallback kalau device sedang offline.

self.addEventListener("fetch", (event) => {

    const url = event.request.url;

    // Lewati request non-GET (POST ke API absensi).
    if (event.request.method !== "GET") {
        return;
    }

    // Jangan cache request ke endpoint API absensi.
    if (url.includes("/.netlify/functions/")) {
        return;
    }

    event.respondWith(

        fetch(event.request)
            .then((response) => {

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {

                    const responseClone = response.clone();

                    caches.open(CACHE_VERSION).then((cache) => {
                        cache.put(event.request, responseClone);
                    });

                }

                return response;

            })
            .catch(() => {

                // Offline: baru pakai cache sebagai fallback
                return caches.match(event.request);

            })

    );

});
