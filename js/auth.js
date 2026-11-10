const Auth = {

    ADMIN_NIM: "666999",
    ADMIN_PASSWORD: "kaisejahtera*",

    // ===== AKUN ADMIN BAWAAN (PENGINGAT DEVELOPER) =====
    // NIM      : 666999
    // Password : kaisejahtera*
    // Catatan  : akun ini dibuat otomatis, tidak bisa dibuat lewat form registrasi.
    // ====================================================
    seedAdmin: function () {

        const accounts =
            JSON.parse(
                localStorage.getItem("accounts") || "[]"
            );


        if (!Array.isArray(accounts)) {

            throw new Error(
                "Data akun di localStorage tidak valid."
            );

        }


        const adminExists =
            accounts.some(
                function (account) {

                    return account.nim === this.ADMIN_NIM;

                }.bind(this)
            );


        if (adminExists) {

            return;

        }


        accounts.push({

            nim: this.ADMIN_NIM,
            password: this.ADMIN_PASSWORD,
            nama: "Administrator",
            email: "",
            divisi: "",
            role: "admin"

        });


        localStorage.setItem(
            "accounts",
            JSON.stringify(accounts)
        );

    },


    // =========================================
    // LOGIN
    // =========================================

    login: async function (nim, password) {

        try {

            // Bersihkan input
            nim =
                String(nim || "").trim();

            password =
                String(password || "").trim();


            // Validasi frontend
            if (!nim || !password) {

                return {
                    status: false,
                    message:
                        "NIM dan Password wajib diisi."
                };

            }


            const accounts =
                JSON.parse(
                    localStorage.getItem("accounts") || "[]"
                );


            if (!Array.isArray(accounts)) {

                throw new Error(
                    "Data akun di localStorage tidak valid."
                );

            }


            const localAccount =
                accounts.find(
                    function (account) {

                        return account.nim === nim;

                    }
                );


            // Kirim ke Google Apps Script
            const result =
                await apiRequest(
                    "login",
                    {
                        nim: nim,
                        password: password
                    }
                );


            // Login gagal
            if (!result || !result.status) {

                if (
                    localAccount &&
                    localAccount.role === "admin" &&
                    localAccount.password === password
                ) {

                    const localUser = {

                        nim: localAccount.nim,
                        nama: localAccount.nama,
                        email: localAccount.email || "",
                        divisi: localAccount.divisi || "",
                        role: "admin"

                    };


                    localStorage.setItem(
                        "user",
                        JSON.stringify(localUser)
                    );


                    return {
                        status: true,
                        message: "Login berhasil.",
                        user: localUser
                    };

                }


                return result || {
                    status: false,
                    message:
                        "Login gagal."
                };

            }


            // =====================================
            // CEK DATA USER
            // =====================================

            if (!result.user) {

                return {
                    status: false,
                    message:
                        "Data pengguna tidak ditemukan."
                };

            }


            // =====================================
            // NORMALISASI DATA USER
            // =====================================

            const user = {

                nim:
                    result.user.nim || "",

                nama:
                    result.user.nama || "",

                email:
                    result.user.email || "",

                divisi:
                    result.user.divisi || "",

                role:
                    String(
                        result.user.role || "user"
                    )
                    .toLowerCase()
                    .trim()

            };


            // Pastikan role valid
            if (
                user.role !== "admin" &&
                user.role !== "user"
            ) {

                user.role = "user";

            }


            // =====================================
            // SIMPAN USER
            // =====================================

            localStorage.setItem(
                "user",
                JSON.stringify(user)
            );


            return {

                status: true,

                message:
                    result.message ||
                    "Login berhasil.",

                user: user

            };


        } catch (error) {

            console.error(
                "[AUTH] LOGIN ERROR:",
                error
            );


            return {

                status: false,

                message:
                    "Terjadi kesalahan saat login.",

                error:
                    error.message

            };

        }

    },


    // =========================================
    // REGISTER
    // =========================================

    register: async function (data) {

        try {

            if (!data) {

                return {

                    status: false,

                    message:
                        "Data pendaftaran tidak ditemukan."

                };

            }


            const payload = {

                nim:
                    String(
                        data.nim || ""
                    ).trim(),

                nama:
                    String(
                        data.nama || ""
                    ).trim(),

                email:
                    String(
                        data.email || ""
                    ).trim(),

                password:
                    String(
                        data.password || ""
                    ).trim(),

                divisi:
                    String(
                        data.divisi || ""
                    ).trim(),

                role: "user"

            };


            if (payload.nim === this.ADMIN_NIM) {

                return {
                    status: false,
                    message: "NIM sudah terdaftar"
                };

            }


            const result =
                await apiRequest(
                    "register",
                    payload
                );


            console.log(
                "[AUTH] REGISTER RESPONSE:",
                result
            );


            return result;


        } catch (error) {

            console.error(
                "[AUTH] REGISTER ERROR:",
                error
            );


            return {

                status: false,

                message:
                    "Terjadi kesalahan saat pendaftaran.",

                error:
                    error.message

            };

        }

    },


    // =========================================
    // GET USER
    // =========================================

    getUser: function () {

        const data =
            localStorage.getItem(
                "user"
            );


        if (!data) {

            return null;

        }


        try {

            const user =
                JSON.parse(data);


            if (
                !user ||
                !user.nim
            ) {

                localStorage.removeItem(
                    "user"
                );

                return null;

            }


            // Normalisasi role
            user.role =
                String(
                    user.role || "user"
                )
                .toLowerCase()
                .trim();


            if (
                user.role !== "admin" &&
                user.role !== "user"
            ) {

                user.role = "user";

            }


            return user;


        } catch (error) {

            console.error(
                "[AUTH] DATA USER RUSAK:",
                error
            );


            localStorage.removeItem(
                "user"
            );


            return null;

        }

    },


    // =========================================
    // CEK LOGIN
    // =========================================

    isLoggedIn: function () {

        return this.getUser() !== null;

    },


    // =========================================
    // LOGOUT
    // =========================================

    logout: function () {

        localStorage.removeItem(
            "user"
        );


        // Hentikan scanner jika sedang aktif
        if (
            typeof Scanner !==
            "undefined" &&
            Scanner.isRunning
        ) {

            Scanner.stop()
                .catch(
                    function (error) {

                        console.error(
                            "[AUTH] STOP SCANNER ERROR:",
                            error
                        );

                    }
                );

        }


        // Kembali ke halaman aplikasi
        location.reload();

    }

};