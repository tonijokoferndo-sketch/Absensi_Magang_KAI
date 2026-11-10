const QR_SLOT_MS =
    12 * 60 * 60 * 1000;

const QR_WIB_OFFSET =
    7 * 60 * 60 * 1000;

const Dashboard = {
    scannedQR: "",
    activeQrMode: "",
    activeQrSlot: null,
    qrClockTimer: null,
    qrVisibilityHandler: null,
    adminHistoryData: [],
    adminQrSlots: [],
    adminQrSlotIndex: -1,

    getSlot: function (now = Date.now()) {

        return Math.floor(
            (now + QR_WIB_OFFSET) /
            QR_SLOT_MS
        );

    },


    getTimeQrData: async function () {

        const result =
            await apiRequest("qr_current");

        if (!result || !result.status || !result.qr) {
            throw new Error(
                result && result.message
                    ? result.message
                    : "QR tidak dapat dibuat."
            );
        }

        return result.qr;

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


        return (
            match[1] === String(this.getSlot())
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

        if (user.mustChangePassword) {
            this.showTemporaryPasswordChange(user);
            return;
        }

        if (user.role === "admin") {

            await this.showAdmin(user);

        } else {

            await this.showUser(user);

        }

    },

    showTemporaryPasswordChange: function (user) {

        const content =
            document.getElementById("dashboardContent");

        if (!content) {
            return;
        }

        content.innerHTML = `
            <section class="password-change-card">
                <h2>Ganti Sandi Sementara</h2>
                <p>Admin mengatur ulang sandi akun Anda. Buat sandi baru sebelum melanjutkan.</p>
                <form id="temporaryPasswordForm">
                    <label for="newPassword">Sandi baru</label>
                    <input id="newPassword" name="newPassword" type="password"
                        minlength="8" autocomplete="new-password" required>

                    <label for="confirmNewPassword">Ulangi sandi baru</label>
                    <input id="confirmNewPassword" name="confirmNewPassword" type="password"
                        minlength="8" autocomplete="new-password" required>

                    <p id="passwordChangeMessage" class="message" role="status"></p>
                    <button class="btn-primary" type="submit">Simpan Sandi Baru</button>
                </form>
            </section>
        `;

        const form =
            document.getElementById("temporaryPasswordForm");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const newPassword =
                document.getElementById("newPassword").value;
            const confirmation =
                document.getElementById("confirmNewPassword").value;
            const message =
                document.getElementById("passwordChangeMessage");

            if (newPassword.length < 8) {
                message.textContent =
                    "Sandi baru minimal 8 karakter.";
                message.classList.add("error");
                return;
            }

            if (newPassword !== confirmation) {
                message.textContent =
                    "Konfirmasi sandi tidak sama.";
                message.classList.add("error");
                return;
            }

            const submitButton =
                form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            message.textContent = "Menyimpan sandi...";
            message.classList.remove("error", "success");

            try {
                const result =
                    await apiRequest("change_password", {
                        newPassword: newPassword
                    });

                if (!result || !result.status || !result.sessionToken) {
                    throw new Error(
                        result && result.message
                            ? result.message
                            : "Sandi gagal diperbarui."
                    );
                }

                const updatedUser = {
                    ...user,
                    sessionToken: result.sessionToken,
                    mustChangePassword: false,
                    sessionVersion:
                        Number(result.user.sessionVersion || 0)
                };
                localStorage.setItem(
                    "user",
                    JSON.stringify(updatedUser)
                );
                await this.show();
            } catch (error) {
                message.textContent =
                    error.message || "Sandi gagal diperbarui.";
                message.classList.add("error");
                submitButton.disabled = false;
            }
        });
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

                    qr:
                        this.scannedQR

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

                    qr:
                        this.scannedQR

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

                <nav class="admin-navigation" aria-label="Navigasi dashboard admin">
                    <a class="btn-primary" href="#adminUserManagement">Kelola Akun User</a>
                    <a class="btn-secondary" href="#adminAttendance">Data Absensi</a>
                </nav>

                <section id="adminUserManagement" class="admin-user-management">
                    <div class="section-header">
                        <div>
                            <h3>Kelola Akun User</h3>
                            <p>Edit data akun, reset sandi, atau hapus akun. Riwayat absensi tetap disimpan jika akun dihapus.</p>
                        </div>
                        <button id="btnAdminUsersRefresh" class="btn-secondary" type="button">
                            Muat Ulang
                        </button>
                    </div>
                    <div id="adminResetResult" class="message" role="status"></div>
                    <div id="adminUsers">Memuat akun user...</div>
                </section>


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

                <section id="adminAttendance" class="admin-attendance-section">
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

                <div class="admin-history-controls">
                    <button id="btnAdminQrPrev" class="btn-secondary" type="button" aria-label="Periode QR sebelumnya">
                        Sebelumnya
                    </button>
                    <strong id="adminQrPeriodLabel">Memuat periode QR...</strong>
                    <button id="btnAdminQrNext" class="btn-secondary" type="button" aria-label="Periode QR berikutnya">
                        Berikutnya
                    </button>
                    <button id="btnAdminPrintHistory" class="btn-primary" type="button" disabled>
                        Cetak Periode Ini
                    </button>
                </div>

                <!-- DATA -->

                <div id="adminHistory">

                    Memuat data...

                </div>
                </section>

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

        const previousQrPeriod =
            document.getElementById("btnAdminQrPrev");
        const nextQrPeriod =
            document.getElementById("btnAdminQrNext");
        const printHistory =
            document.getElementById("btnAdminPrintHistory");

        if (previousQrPeriod) {
            previousQrPeriod.addEventListener("click", () => {
                if (this.adminQrSlotIndex > 0) {
                    this.adminQrSlotIndex -= 1;
                    this.renderAdminHistoryPeriod();
                }
            });
        }

        if (nextQrPeriod) {
            nextQrPeriod.addEventListener("click", () => {
                if (this.adminQrSlotIndex < this.adminQrSlots.length - 1) {
                    this.adminQrSlotIndex += 1;
                    this.renderAdminHistoryPeriod();
                }
            });
        }

        if (printHistory) {
            printHistory.addEventListener("click", () => window.print());
        }

        const usersRefresh =
            document.getElementById("btnAdminUsersRefresh");

        if (usersRefresh) {
            usersRefresh.addEventListener(
                "click",
                () => this.loadAdminUsers()
            );
        }

        const adminUsers =
            document.getElementById("adminUsers");

        if (adminUsers) {
            adminUsers.addEventListener("click", async (event) => {
                const button = event.target.closest(
                    "[data-reset-user], [data-save-user], [data-delete-user]"
                );

                if (!button || button.disabled) {
                    return;
                }

                const nim =
                    button.dataset.resetUser ||
                    button.dataset.saveUser ||
                    button.dataset.deleteUser;

                const resultContainer =
                    document.getElementById("adminResetResult");
                resultContainer.classList.remove("error", "success");
                button.disabled = true;

                try {
                    if (button.hasAttribute("data-save-user")) {
                        const row = button.closest("tr");
                        const emailField =
                            row.querySelector('[data-user-field="email"]');
                        if (!emailField.checkValidity()) {
                            emailField.reportValidity();
                            button.disabled = false;
                            return;
                        }
                        const getField = (field) =>
                            row.querySelector(`[data-user-field="${field}"]`).value.trim();
                        const result = await apiRequest("update_user", {
                            nim: nim,
                            nama: getField("nama"),
                            email: getField("email"),
                            divisi: getField("divisi")
                        });
                        if (!result || !result.status) {
                            throw new Error(result && result.message || "Perubahan akun gagal disimpan.");
                        }
                        resultContainer.textContent = result.message;
                        resultContainer.classList.add("success");
                        await this.loadAdminUsers();
                        return;
                    }

                    if (button.hasAttribute("data-delete-user")) {
                        if (!window.confirm(
                            `Hapus akun NIM ${nim}? Riwayat absensinya tetap disimpan.`
                        )) {
                            button.disabled = false;
                            return;
                        }
                        const result = await apiRequest("delete_user", { nim: nim });
                        if (!result || !result.status) {
                            throw new Error(result && result.message || "Penghapusan akun gagal.");
                        }
                        resultContainer.textContent = result.message;
                        resultContainer.classList.add("success");
                        await this.loadAdminUsers();
                        await this.loadAdminHistory(admin);
                        return;
                    }

                    if (!window.confirm(
                        `Buat sandi sementara baru untuk NIM ${nim}? Sandi lama tidak akan berlaku.`
                    )) {
                        button.disabled = false;
                        return;
                    }

                    resultContainer.textContent = "Membuat sandi sementara...";
                    const result =
                        await apiRequest("reset_password", { nim: nim });

                    if (
                        !result ||
                        !result.status ||
                        !result.temporaryPassword
                    ) {
                        throw new Error(
                            result && result.message
                                ? result.message
                                : "Reset sandi gagal."
                        );
                    }

                    resultContainer.classList.add("success");
                    resultContainer.innerHTML = `
                        <p>${this.escape(result.message)}</p>
                        <p>Sandi sementara untuk NIM ${this.escape(nim)}:</p>
                        <code class="temporary-password">${this.escape(result.temporaryPassword)}</code>
                        <p>Salin dan sampaikan secara pribadi kepada user. Sandi ini hanya ditampilkan sekarang.</p>
                    `;
                    await this.loadAdminUsers();
                } catch (error) {
                    resultContainer.textContent =
                        this.getAdminApiErrorMessage(error, "Aksi akun gagal.");
                    resultContainer.classList.add("error");
                    button.disabled = false;
                }
            });
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

        await this.loadAdminUsers();

    },


    loadAdminUsers: async function () {

        const container =
            document.getElementById("adminUsers");

        if (!container) {
            return;
        }

        container.textContent = "Memuat akun user...";

        try {
            const result =
                await apiRequest("list_users");

            if (!result || !result.status) {
                throw new Error(
                    result && result.message
                        ? result.message
                        : "Daftar akun gagal dimuat."
                );
            }

            const users = result.users || [];
            if (users.length === 0) {
                container.innerHTML =
                    '<p class="empty">Belum ada akun user.</p>';
                return;
            }

            const rows = users.map((user) => `
                <tr>
                    <td>${this.escape(user.nim)}</td>
                    <td><input data-user-field="nama" aria-label="Nama ${this.escape(user.nim)}" value="${this.escape(user.nama)}" required></td>
                    <td><input data-user-field="email" type="email" aria-label="Email ${this.escape(user.nim)}" value="${this.escape(user.email || "")}"></td>
                    <td><input data-user-field="divisi" aria-label="Divisi ${this.escape(user.nim)}" value="${this.escape(user.divisi || "")}"></td>
                    <td>${this.escape(user.password || "****")}</td>
                    <td>${this.escape(user.tanggalDaftar || "Belum tercatat")}</td>
                    <td>
                        <div class="admin-user-actions">
                            <button
                                class="btn-primary"
                                type="button"
                                data-save-user="${this.escape(user.nim)}"
                            >Simpan</button>
                        <button
                            class="btn-secondary admin-reset-password"
                            type="button"
                            data-reset-user="${this.escape(user.nim)}"
                        >Reset sandi</button>
                            <button
                                class="btn-danger"
                                type="button"
                                data-delete-user="${this.escape(user.nim)}"
                            >Hapus</button>
                        </div>
                    </td>
                </tr>
            `).join("");

            container.innerHTML = `
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>NIM</th>
                                <th>Nama</th>
                                <th>Email</th>
                                <th>Divisi</th>
                                <th>Password</th>
                                <th>Tanggal Daftar</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `
                <p class="error">${this.escape(
                    this.getAdminApiErrorMessage(error, "Daftar akun gagal dimuat.")
                )}</p>
            `;
        }
    },

    getAdminApiErrorMessage: function (error, fallback) {
        const message = error && error.message
            ? error.message
            : fallback;
        if (message === "Aksi tidak dikenali.") {
            return "Apps Script yang aktif masih versi lama. Salin Code.gs terbaru lalu terapkan deployment sebagai versi baru.";
        }
        return message || fallback;
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


            if (!result.status) {
                throw new Error(
                    result.message || "Gagal mengambil data."
                );
            }


            const data = result.riwayat || [];
            const selectedSlot = this.adminQrSlots[this.adminQrSlotIndex];
            const slots = new Set();
            let hasLegacyRows = false;
            data.forEach((item) => {
                const checkInSlot = String(item.qrMasukSlot || "").trim();
                const checkOutSlot = String(item.qrPulangSlot || "").trim();
                if (checkInSlot) slots.add(checkInSlot);
                if (checkOutSlot) slots.add(checkOutSlot);
                if (!checkInSlot && !checkOutSlot) hasLegacyRows = true;
            });

            this.adminQrSlots = Array.from(slots).sort((left, right) =>
                Number(left) - Number(right)
            );
            if (hasLegacyRows) {
                this.adminQrSlots.unshift("legacy");
            }
            this.adminHistoryData = data;
            const previousIndex = this.adminQrSlots.indexOf(selectedSlot);
            this.adminQrSlotIndex = previousIndex >= 0
                ? previousIndex
                : this.adminQrSlots.length - 1;


            const total =
                document.getElementById(
                    "adminTotal"
                );


            if (total) {

                total.textContent =
                    data.length;

            }


            this.renderAdminHistoryPeriod();
        } catch (error) {
            console.error("ADMIN HISTORY ERROR:", error);
            container.innerHTML = `
                <p class="error">${this.escape(
                    this.getAdminApiErrorMessage(error, "Gagal mengambil data absensi.")
                )}</p>
            `;
        }
    },

    getAdminQrPeriodLabel: function (slot) {
        if (slot === "legacy") {
            return "Data lama (QR belum tercatat)";
        }
        const start = Number(slot) * QR_SLOT_MS - QR_WIB_OFFSET;
        const end = (Number(slot) + 1) * QR_SLOT_MS - QR_WIB_OFFSET;
        return `${this.formatWibDateTime(start)} - ${this.formatWibDateTime(end)}`;
    },

    renderAdminHistoryPeriod: function () {
        const container = document.getElementById("adminHistory");
        const label = document.getElementById("adminQrPeriodLabel");
        const previous = document.getElementById("btnAdminQrPrev");
        const next = document.getElementById("btnAdminQrNext");
        const print = document.getElementById("btnAdminPrintHistory");
        if (!container) return;

        if (this.adminQrSlotIndex < 0 || !this.adminQrSlots.length) {
            if (label) label.textContent = "Belum ada data absensi";
            if (previous) previous.disabled = true;
            if (next) next.disabled = true;
            if (print) print.disabled = true;
            container.innerHTML = '<div class="empty">Belum ada data absensi.</div>';
            return;
        }

        const slot = this.adminQrSlots[this.adminQrSlotIndex];
        const reportData = this.adminHistoryData.filter((item) => {
            const checkInSlot = String(item.qrMasukSlot || "").trim();
            const checkOutSlot = String(item.qrPulangSlot || "").trim();
            return slot === "legacy"
                ? !checkInSlot && !checkOutSlot
                : checkInSlot === slot || checkOutSlot === slot;
        });
        const periodLabel = this.getAdminQrPeriodLabel(slot);

        if (label) label.textContent = periodLabel;
        if (previous) previous.disabled = this.adminQrSlotIndex <= 0;
        if (next) next.disabled = this.adminQrSlotIndex >= this.adminQrSlots.length - 1;
        if (print) print.disabled = reportData.length === 0;

        if (!reportData.length) {
            container.innerHTML = '<div class="empty">Tidak ada absensi pada periode QR ini.</div>';
            return;
        }

        let html = `
            <h4 class="print-report-title">Laporan Absensi - ${this.escape(periodLabel)}</h4>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>NIM</th>
                            <th>Nama</th>
                            <th>Tanggal</th>
                            <th>Masuk</th>
                            <th>Pulang</th>
                            <th>QR Masuk</th>
                            <th>QR Pulang</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        reportData.forEach((item) => {
            html += `
                <tr>
                    <td>${this.escape(item.nim)}</td>
                    <td>${this.escape(item.nama)}</td>
                    <td>${this.escape(item.tanggal)}</td>
                    <td>${this.escape(item.jamMasuk || "-")}</td>
                    <td>${this.escape(item.jamPulang || "-")}</td>
                    <td>${this.escape(item.qrMasukSlot ? this.getAdminQrPeriodLabel(String(item.qrMasukSlot)) : "-")}</td>
                    <td>${this.escape(item.qrPulangSlot ? this.getAdminQrPeriodLabel(String(item.qrPulangSlot)) : "-")}</td>
                    <td>${this.escape(item.status || "-")}</td>
                </tr>
            `;
        });

        container.innerHTML = `${html}</tbody></table></div>`;
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