const QR_SLOT_MS =
    12 * 60 * 60 * 1000;

const QR_WIB_OFFSET =
    7 * 60 * 60 * 1000;

// SECRET QR: ganti sesuai kebutuhan, jangan dibagikan.
const QR_SECRET =
    "kai-absensi-qr-rotation-v1";


const Dashboard = {
    scannedQR: "",
    activeQrMode: "",
    activeQrSlot: null,
    qrClockTimer: null,
    qrVisibilityHandler: null,

    getSlot: function (now = Date.now()) {

        return Math.floor(
            (now + QR_WIB_OFFSET) /
            QR_SLOT_MS
        );

    },


    getTimeQrData: async function (now = Date.now()) {

        if (
            !window.crypto ||
            !window.crypto.subtle
        ) {

            throw new Error(
                "Peramban tidak mendukung verifikasi QR yang aman."
            );

        }


        const slot =
            this.getSlot(now);

        const encodedSecret =
            new TextEncoder().encode(
                `${QR_SECRET}:${slot}`
            );

        const digest =
            await window.crypto.subtle.digest(
                "SHA-256",
                encodedSecret
            );

        const token =
            Array.from(
                new Uint8Array(digest),
                byte => byte.toString(16).padStart(2, "0")
            )
                .join("")
                .slice(0, 16);


        return {
            slot: slot,
            token: token,
            payload: `KAI-ABSEN|${slot}|${token}`,
            expiresAt:
                (slot + 1) * QR_SLOT_MS -
                QR_WIB_OFFSET
        };

    },


    isCurrentTimeQr: async function (value) {

        const match =
            /^KAI-ABSEN\|(\d+)\|([0-9a-f]{16})$/
                .exec(
                    String(value || "").trim()
                );


        if (!match) {

            return false;

        }


        const current =
            await this.getTimeQrData();


        return (
            match[1] === String(current.slot) &&
            match[2] === current.token
        );

    },


    ensureScannedQrIsCurrent: async function (message) {

        try {

            if (
                await this.isCurrentTimeQr(
                    this.scannedQR
                )
            ) {

                return true;

            }


            this.scannedQR = "";

            if (message) {

                message.textContent =
                    "QR Code sudah kedaluwarsa, minta QR terbaru ke admin";

                message.classList.remove("success");
                message.classList.add("error");

            }


            Scanner.reset();
            return false;

        } catch (error) {

            if (message) {

                message.textContent =
                    error.message ||
                    "QR Code tidak dapat diverifikasi.";

                message.classList.remove("success");
                message.classList.add("error");

            }


            console.error(
                "QR VERIFICATION ERROR:",
                error.message
            );

            return false;

        }

    },


    formatWibDateTime: function (timestamp) {

        return new Intl.DateTimeFormat(
            "id-ID",
            {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23"
            }
        ).format(
            new Date(timestamp)
        );

    },


    formatQrCountdown: function (expiresAt, now = Date.now()) {

        const totalSeconds =
            Math.max(
                0,
                Math.floor(
                    (expiresAt - now) / 1000
                )
            );

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor((totalSeconds % 3600) / 60);

        const seconds =
            totalSeconds % 60;


        return [
            hours,
            minutes,
            seconds
        ]
            .map(value => String(value).padStart(2, "0"))
            .join(":");

    },


    startAdminQrClock: function () {

        if (this.qrClockTimer) {

            clearInterval(this.qrClockTimer);

        }


        if (this.qrVisibilityHandler) {

            document.removeEventListener(
                "visibilitychange",
                this.qrVisibilityHandler
            );

        }


        this.qrVisibilityHandler =
            () => {

                if (
                    !document.hidden &&
                    this.activeQrMode
                ) {

                    this.updateAdminQrClock();

                }

            };


        document.addEventListener(
            "visibilitychange",
            this.qrVisibilityHandler
        );


        this.qrClockTimer =
            setInterval(
                () => this.updateAdminQrClock(),
                1000
            );

    },


    updateAdminQrClock: async function () {

        if (!this.activeQrMode) {

            return;

        }


        const now =
            Date.now();

        const currentSlot =
            this.getSlot(now);


        if (this.activeQrSlot !== currentSlot) {

            await this.generateAdminQrCodes(
                this.activeQrMode
            );

            return;

        }


        const qrCardId =
            this.activeQrMode === "PULANG" ?
                "adminQrCardPulang" :
                "adminQrCardMasuk";

        const qrCard =
            document.getElementById(qrCardId);

        if (!qrCard) {

            return;

        }


        const validity =
            qrCard.querySelector(".qr-validity");

        const countdown =
            qrCard.querySelector(".qr-countdown");

        const expiresAt =
            (currentSlot + 1) * QR_SLOT_MS -
            QR_WIB_OFFSET;


        if (validity) {

            validity.textContent =
                this.formatWibDateTime(expiresAt);

        }


        if (countdown) {

            countdown.textContent =
                this.formatQrCountdown(expiresAt, now);

        }

    },

    // =========================================
    // SHOW DASHBOARD
    // =========================================

    show: async function () {

        const user = Auth.getUser();

        if (!user) {
            App.showPage("loginPage");
            return;
        }

        const welcomeText =
            document.getElementById("welcomeText");

        if (welcomeText) {
            welcomeText.textContent =
                "Halo, " + user.nama;
        }

        if (user.role === "admin") {

            await this.showAdmin(user);

        } else {

            await this.showUser(user);

        }

    },


    // =========================================
    // DASHBOARD USER
    // =========================================

    showUser: async function (user) {

        const content =
            document.getElementById(
                "dashboardContent"
            );

        if (!content) {

            console.error(
                "dashboardContent tidak ditemukan"
            );

            return;

        }


        content.innerHTML = `

            <!-- ==============================
                 DATA USER
            =============================== -->

            <div class="user-info">

                <h3>Data Pengguna</h3>

                <p>
                    <strong>Nama:</strong>
                    ${this.escape(user.nama)}
                </p>

                <p>
                    <strong>NIM:</strong>
                    ${this.escape(user.nim)}
                </p>

                <p>
                    <strong>Divisi:</strong>
                    ${this.escape(
                        user.divisi || "-"
                    )}
                </p>

                <p>
                    <strong>Role:</strong>
                    ${this.escape(
                        user.role || "user"
                    )}
                </p>

            </div>


            <!-- ==============================
                 SCANNER + ABSENSI
            =============================== -->

            <div class="attendance-card">

                <h3>
                    Scan QR Absensi
                </h3>

                <p>
                    Arahkan kamera ke QR Code
                    absensi.
                </p>


                <div
                    style="
                        display:flex;
                        justify-content:center;
                        margin:12px 0;
                    "
                >
                    <button
                        id="btnBukaKamera"
                        class="btn-secondary"
                        type="button"
                    >
                        Buka Kamera
                    </button>
                </div>


                <!-- QR READER -->

                <div
                    id="qrReader"
                    style="
                        width:100%;
                        max-width:400px;
                        margin:15px auto;
                    "
                ></div>


                <!-- HASIL SCAN -->

                <div
                    id="scanResult"
                    class="message"
                >
                    Silakan scan QR Code.
                </div>


                <!-- STATUS ABSENSI -->

                <h3 style="margin-top:20px;">
                    Absensi Hari Ini
                </h3>


                <div id="todayStatus">

                    Memeriksa status absensi...

                </div>


                <!-- TOMBOL ABSEN -->

                <div class="attendance-buttons">

                    <button
                        id="btnAbsenMasuk"
                        class="btn-attendance"
                        type="button"
                    >
                        Absen Masuk
                    </button>


                    <button
                        id="btnAbsenPulang"
                        class="btn-attendance"
                        type="button"
                    >
                        Absen Pulang
                    </button>

                </div>


                <!-- PESAN -->

                <p
                    id="attendanceMessage"
                    class="message"
                ></p>

            </div>


            <!-- ==============================
                 RIWAYAT
            =============================== -->

            <div class="history-card">

                <div class="section-header">

                    <h3>
                        Riwayat Absensi
                    </h3>


                    <button
                        id="btnRefreshHistory"
                        class="btn-secondary"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                <div id="historyContainer">

                    Memuat riwayat...

                </div>

            </div>

        `;


        // =====================================
        // EVENT BUTTON ABSEN MASUK
        // =====================================

        const btnMasuk =
            document.getElementById(
                "btnAbsenMasuk"
            );

        if (btnMasuk) {

            btnMasuk.addEventListener(
                "click",
                () => {

                    this.absenMasuk(user);

                }
            );

        }


        // =====================================
        // EVENT BUTTON ABSEN PULANG
        // =====================================

        const btnPulang =
            document.getElementById(
                "btnAbsenPulang"
            );

        if (btnPulang) {

            btnPulang.addEventListener(
                "click",
                () => {

                    this.absenPulang(user);

                }
            );

        }


        // =====================================
        // EVENT REFRESH
        // =====================================

        const btnRefresh =
            document.getElementById(
                "btnRefreshHistory"
            );

        if (btnRefresh) {

            btnRefresh.addEventListener(
                "click",
                () => {

                    this.loadHistory(user);

                }
            );

        }

const btnBukaKamera =
    document.getElementById(
        "btnBukaKamera"
    );


if (btnBukaKamera) {

    btnBukaKamera.addEventListener(
        "click",
        async () => {

            const scanResult =
                document.getElementById(
                    "scanResult"
                );


            btnBukaKamera.disabled =
                true;


            btnBukaKamera.textContent =
                "Membuka Kamera...";


            if (scanResult) {

                scanResult.textContent =
                    "Meminta izin kamera...";

                scanResult.classList.remove(
                    "error",
                    "success"
                );

            }


            try {

                await this.startScanner(
                    user
                );


                if (scanResult) {

                    scanResult.textContent =
                        "✅ Kamera aktif. Arahkan kamera ke QR Code Admin.";

                    scanResult.classList.add(
                        "success"
                    );

                }


                btnBukaKamera.textContent =
                    "Kamera Aktif";


            } catch (error) {

                console.error(
                    "BUTTON CAMERA ERROR:",
                    error
                );


                if (scanResult) {

                    scanResult.textContent =
                        "❌ " +
                        (
                            error.message ||
                            "Kamera tidak dapat dibuka."
                        );

                    scanResult.classList.add(
                        "error"
                    );

                }


                btnBukaKamera.disabled =
                    false;

                btnBukaKamera.textContent =
                    "Buka Kamera";

            }

        }
    );

}


        // =====================================
        // LOAD RIWAYAT
        // =====================================

        await this.loadHistory(user);


    },


    // =========================================
    // ABSEN MASUK
    // =========================================

    absenMasuk: async function (user) {

    const message =
        document.getElementById(
            "attendanceMessage"
        );


    // =========================================
    // CEK QR
    // =========================================

    if (!this.scannedQR) {

        if (message) {

            message.textContent =
                "Silakan scan QR Code absensi terlebih dahulu.";

        }

        return;

    }


    if (
        !await this.ensureScannedQrIsCurrent(
            message
        )
    ) {

        return;

    }


    if (message) {

        message.textContent =
            "Memproses absen masuk...";

    }


    try {

        const result =
            await apiRequest(

                "absen_masuk",

                {

                    nim:
                        user.nim,

                    // Pertahankan format QR API lama setelah token lolos validasi lokal.
                    qr:
                        `${CONFIG.QR_CODE}|MASUK`

                }

            );


        if (message) {

            message.textContent =
                result.message ||
                "Tidak ada response.";

            message.classList.remove(
                "error"
            );
            message.classList.remove(
                "success"
            );

            if (result.status) {

                message.classList.add(
                    "success"
                );

            } else {

                message.classList.add(
                    "error"
                );

            }

        }


        if (result.status) {

            await this.loadHistory(
                user
            );

        }


    } catch (error) {

        console.error(
            "ABSEN MASUK ERROR:",
            error
        );


        if (message) {

            message.textContent =
                "Gagal melakukan absen masuk.";

        }

    }

},


    // =========================================
    // ABSEN PULANG
    // =========================================

    absenPulang: async function (user) {

    const message =
        document.getElementById(
            "attendanceMessage"
        );


    // =========================================
    // CEK QR
    // =========================================

    if (!this.scannedQR) {

        if (message) {

            message.textContent =
                "Silakan scan QR Code absensi terlebih dahulu.";

        }

        return;

    }


    if (
        !await this.ensureScannedQrIsCurrent(
            message
        )
    ) {

        return;

    }


    if (message) {

        message.textContent =
            "Memproses absen pulang...";

    }


    try {

        const result =
            await apiRequest(

                "absen_pulang",

                {

                    nim:
                        user.nim,

                    // Pertahankan format QR API lama setelah token lolos validasi lokal.
                    qr:
                        `${CONFIG.QR_CODE}|PULANG`

                }

            );


        if (message) {

            message.textContent =
                result.message ||
                "Tidak ada response.";

            message.classList.remove(
                "error"
            );
            message.classList.remove(
                "success"
            );

            if (result.status) {

                message.classList.add(
                    "success"
                );

            } else {

                message.classList.add(
                    "error"
                );

            }

        }


        if (result.status) {

            await this.loadHistory(
                user
            );

        }


    } catch (error) {

        console.error(
            "ABSEN PULANG ERROR:",
            error
        );


        if (message) {

            message.textContent =
                "Gagal melakukan absen pulang.";

        }

    }

},


    // =========================================
    // RIWAYAT USER
    // =========================================

    loadHistory: async function (user) {

        const container =
            document.getElementById(
                "historyContainer"
            );


        if (!container) {

            return;

        }


        container.innerHTML =
            "Memuat riwayat...";


        try {

            const result =
                await apiRequest(
                    "riwayat",
                    {
                        nim: user.nim
                    }
                );


            console.log(
                "RIWAYAT USER:",
                result
            );


            if (!result.status) {

                container.innerHTML = `

                    <p class="error">

                        ${this.escape(
                            result.message ||
                            "Gagal mengambil riwayat."
                        )}

                    </p>

                `;

                return;

            }


            const data =
                result.riwayat || [];


            if (data.length === 0) {

                container.innerHTML = `

                    <div class="empty">

                        Belum ada riwayat
                        absensi.

                    </div>

                `;

                return;

            }


            let html = `

                <div class="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Tanggal
                                </th>

                                <th>
                                    Masuk
                                </th>

                                <th>
                                    Pulang
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>


                        <tbody>

            `;


            data.forEach(item => {

                html += `

                    <tr>

                        <td>
                            ${this.escape(
                                item.tanggal
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.jamMasuk || "-"
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.jamPulang || "-"
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.status || "-"
                            )}
                        </td>

                    </tr>

                `;

            });


            html += `

                        </tbody>

                    </table>

                </div>

            `;


            container.innerHTML =
                html;


        } catch (error) {

            console.error(
                "LOAD RIWAYAT ERROR:",
                error
            );


            container.innerHTML = `

                <p class="error">

                    Gagal mengambil
                    riwayat absensi.

                </p>

            `;

        }

    },


    // =========================================
    // DASHBOARD ADMIN
    // =========================================

    showAdmin: async function (admin) {

        const content =
            document.getElementById(
                "dashboardContent"
            );


        if (!content) {

            return;

        }


        content.innerHTML = `

            <div class="admin-card">

                <h2>
                    Dashboard Admin
                </h2>


                <p>

                    Selamat datang,

                    <strong>

                        ${this.escape(
                            admin.nama
                        )}

                    </strong>

                </p>


                <!-- STATISTIK -->

                <div class="admin-stat">

                    <div>

                        <strong
                            id="adminTotal"
                        >
                            -
                        </strong>


                        <span>
                            Total Absensi
                        </span>

                    </div>

                </div>


                <!-- QR ABSENSI -->

                <div class="admin-qr-controls">

                    <button
                        id="btnShowQrMasuk"
                        class="btn-primary"
                        type="button"
                    >
                        Tampilkan QR Masuk
                    </button>

                    <button
                        id="btnShowQrPulang"
                        class="btn-success"
                        type="button"
                    >
                        Tampilkan QR Pulang
                    </button>

                </div>


                <div class="admin-qr-grid">

                    <div
                        id="adminQrCardMasuk"
                        class="admin-qr-card qr-masuk hidden"
                    >

                        <h3>
                            QR Absen Masuk
                        </h3>

                        <div
                            id="adminQrMasuk"
                            class="qr-box"
                        ></div>

                        <p>
                            Scan untuk absen masuk.
                        </p>

                        <p>
                            Berlaku sampai:
                            <span class="qr-validity"></span> WIB
                        </p>

                        <p>
                            Berganti dalam:
                            <span class="qr-countdown"></span>
                        </p>

                    </div>


                    <div
                        id="adminQrCardPulang"
                        class="admin-qr-card qr-pulang hidden"
                    >

                        <h3>
                            QR Absen Pulang
                        </h3>

                        <div
                            id="adminQrPulang"
                            class="qr-box"
                        ></div>

                        <p>
                            Scan untuk absen pulang.
                        </p>

                        <p>
                            Berlaku sampai:
                            <span class="qr-validity"></span> WIB
                        </p>

                        <p>
                            Berganti dalam:
                            <span class="qr-countdown"></span>
                        </p>

                    </div>

                </div>


                <!-- HEADER DATA -->

                <div class="section-header">

                    <h3>
                        Data Absensi
                    </h3>


                    <button
                        id="btnAdminRefresh"
                        class="btn-secondary"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                <!-- DATA -->

                <div id="adminHistory">

                    Memuat data...

                </div>

            </div>

        `;


        const btnRefresh =
            document.getElementById(
                "btnAdminRefresh"
            );


        if (btnRefresh) {

            btnRefresh.addEventListener(
                "click",
                () => {

                    this.loadAdminHistory(
                        admin
                    );

                }
            );

        }


        const btnShowQrMasuk =
            document.getElementById(
                "btnShowQrMasuk"
            );

        const btnShowQrPulang =
            document.getElementById(
                "btnShowQrPulang"
            );


        if (btnShowQrMasuk) {

            btnShowQrMasuk.addEventListener(
                "click",
                () => {

                    this.generateAdminQrCodes(
                        "MASUK"
                    );

                }
            );

        }


        if (btnShowQrPulang) {

            btnShowQrPulang.addEventListener(
                "click",
                () => {

                    this.generateAdminQrCodes(
                        "PULANG"
                    );

                }
            );

        }


        this.startAdminQrClock();


        await this.generateAdminQrCodes(
            "MASUK"
        );


        await this.loadAdminHistory(
            admin
        );

    },


    // =========================================
    // QR ADMIN
    // =========================================

    generateAdminQrCodes: async function (mode = "MASUK") {

        if (
            typeof QRCode ===
            "undefined"
        ) {

            console.warn(
                "QRCode library tidak tersedia."
            );

            return;

        }

        this.activeQrMode =
            mode;

        const qrCardId =
            mode === "PULANG" ?
                "adminQrCardPulang" :
                "adminQrCardMasuk";

        const qrBoxId =
            mode === "PULANG" ?
                "adminQrPulang" :
                "adminQrMasuk";


        const qrCard =
            document.getElementById(
                qrCardId
            );

        const qrBox =
            document.getElementById(
                qrBoxId
            );


        if (!qrCard || !qrBox) {

            return;

        }


        qrCard.classList.remove(
            "hidden"
        );


        const otherCardId =
            mode === "PULANG" ?
                "adminQrCardMasuk" :
                "adminQrCardPulang";

        const otherCard =
            document.getElementById(
                otherCardId
            );

        if (otherCard) {

            otherCard.classList.add(
                "hidden"
            );

        }

        try {

            const qrData =
                await this.getTimeQrData();


            qrBox.innerHTML = "";

            new QRCode(
                qrBox,
                {
                    text: qrData.payload,
                    width: 220,
                    height: 220,
                    colorDark:
                        mode === "PULANG" ?
                            "#198754" :
                            "#0F4C81",
                    colorLight: "#ffffff",
                    correctLevel:
                        QRCode.CorrectLevel.H
                }
            );

            this.activeQrSlot =
                qrData.slot;


            const validity =
                qrCard.querySelector(".qr-validity");

            const countdown =
                qrCard.querySelector(".qr-countdown");


            if (validity) {

                validity.textContent =
                    this.formatWibDateTime(
                        qrData.expiresAt
                    );

            }


            if (countdown) {

                countdown.textContent =
                    this.formatQrCountdown(
                        qrData.expiresAt
                    );

            }

        } catch (error) {

            qrBox.innerHTML = "";
            this.activeQrSlot = null;


            const validity =
                qrCard.querySelector(".qr-validity");

            if (validity) {

                validity.textContent =
                    error.message ||
                    "QR tidak dapat dibuat.";

            }


            console.error(
                "GENERATE QR ERROR:",
                error.message
            );

        }

    },


    // =========================================
    // RIWAYAT ADMIN
    // =========================================

    loadAdminHistory: async function (
        admin
    ) {

        const container =
            document.getElementById(
                "adminHistory"
            );


        if (!container) {

            return;

        }


        container.innerHTML =
            "Memuat data absensi...";


        try {

            const result =
                await apiRequest(
                    "riwayat_semua",
                    {
                        nim: admin.nim
                    }
                );


            console.log(
                "RIWAYAT ADMIN:",
                result
            );


            if (!result.status) {

                container.innerHTML = `

                    <p class="error">

                        ${this.escape(
                            result.message ||
                            "Gagal mengambil data."
                        )}

                    </p>

                `;

                return;

            }


            const data =
                result.riwayat || [];


            const total =
                document.getElementById(
                    "adminTotal"
                );


            if (total) {

                total.textContent =
                    data.length;

            }


            if (data.length === 0) {

                container.innerHTML = `

                    <div class="empty">

                        Belum ada data
                        absensi.

                    </div>

                `;

                return;

            }


            let html = `

                <div class="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    NIM
                                </th>

                                <th>
                                    Nama
                                </th>

                                <th>
                                    Tanggal
                                </th>

                                <th>
                                    Masuk
                                </th>

                                <th>
                                    Pulang
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>


                        <tbody>

            `;


            data.forEach(item => {

                html += `

                    <tr>

                        <td>
                            ${this.escape(
                                item.nim
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.nama
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.tanggal
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.jamMasuk || "-"
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.jamPulang || "-"
                            )}
                        </td>

                        <td>
                            ${this.escape(
                                item.status || "-"
                            )}
                        </td>

                    </tr>

                `;

            });


            html += `

                        </tbody>

                    </table>

                </div>

            `;


            container.innerHTML =
                html;


        } catch (error) {

            console.error(
                "ADMIN HISTORY ERROR:",
                error
            );


            container.innerHTML = `

                <p class="error">

                    Gagal mengambil
                    data absensi.

                </p>

            `;

        }

    },


    // =========================================
    // QR SCANNER
    // =========================================

    startScanner: async function (user) {

    const scanResult =
        document.getElementById(
            "scanResult"
        );


    // Reset QR sebelumnya

    this.scannedQR = "";


    if (scanResult) {

        scanResult.textContent =
            "Menyalakan kamera...";

    }


    try {

        await Scanner.start(

            "qrReader",

            async (decodedText) => {

                // =====================================
                // CEK QR
                // =====================================

                const qr =
                    String(
                        decodedText || ""
                    ).trim();

                let isValidQr = false;

                try {

                    isValidQr =
                        await this.isCurrentTimeQr(qr);

                } catch (error) {

                    this.scannedQR = "";

                    if (scanResult) {

                        scanResult.textContent =
                            error.message ||
                            "QR Code tidak dapat diverifikasi.";

                        scanResult.classList.add("error");

                    }


                    Scanner.reset();
                    return;

                }


                if (!isValidQr) {

                    this.scannedQR = "";


                    if (scanResult) {

                        scanResult.textContent =
                            "QR Code sudah kedaluwarsa, minta QR terbaru ke admin";

                        scanResult.classList.remove("success");
                        scanResult.classList.add("error");

                    }


                    Scanner.reset();


                    return;

                }


                // =====================================
                // QR VALID
                // =====================================

                this.scannedQR =
                    qr;


                if (scanResult) {

                    scanResult.textContent =
                        "✅ QR Code valid. Silakan pilih Absen Masuk atau Absen Pulang.";

                    scanResult.classList.remove("error");

                }


                // Jangan scan berulang

                Scanner.reset();

            }

        );


    } catch (error) {

        console.error(
            "START SCANNER ERROR:",
            error
        );


        if (scanResult) {

            scanResult.textContent =
                "❌ Kamera tidak dapat digunakan. Pastikan izin kamera diberikan.";

        }

    }

},


    // =========================================
    // SECURITY / ESCAPE HTML
    // =========================================

    escape: function (value) {

        return String(
            value ?? ""
        )

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }

};