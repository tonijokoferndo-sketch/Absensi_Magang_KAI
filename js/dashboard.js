const Dashboard = {
    scannedQR: "",

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
                        class="btn-primary"
                        type="button"
                    >
                        Absen Masuk
                    </button>


                    <button
                        id="btnAbsenPulang"
                        class="btn-success"
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


        // =====================================
        // LOAD RIWAYAT
        // =====================================

        await this.loadHistory(user);


        // =====================================
        // START QR SCANNER
        // =====================================

        await this.startScanner(user);

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


        console.log(
            "HASIL ABSEN MASUK:",
            result
        );


        if (message) {

            message.textContent =
                result.message ||
                "Tidak ada response.";

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


        console.log(
            "HASIL ABSEN PULANG:",
            result
        );


        if (message) {

            message.textContent =
                result.message ||
                "Tidak ada response.";

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


        await this.loadAdminHistory(
            admin
        );

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

                console.log(
                    "QR TERBACA:",
                    decodedText
                );


                // =====================================
                // CEK QR
                // =====================================

                const qr =
                    String(
                        decodedText || ""
                    ).trim();


                if (
                    typeof CONFIG.QR_CODE ===
                    "undefined"
                ) {

                    console.error(
                        "CONFIG.QR_CODE belum tersedia."
                    );


                    if (scanResult) {

                        scanResult.textContent =
                            "QR Code belum dikonfigurasi.";

                    }

                    return;

                }


                // =====================================
                // QR TIDAK VALID
                // =====================================

                if (
                    qr !==
                    String(
                        CONFIG.QR_CODE
                    ).trim()
                ) {

                    this.scannedQR = "";


                    if (scanResult) {

                        scanResult.textContent =
                            "❌ QR Code tidak valid.";

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

                }


                console.log(
                    "QR VALID:",
                    this.scannedQR
                );


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