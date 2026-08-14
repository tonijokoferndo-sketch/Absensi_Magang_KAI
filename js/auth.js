const Auth = {

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


            // Kirim ke Google Apps Script
            const result =
                await apiRequest(
                    "login",
                    {
                        nim: nim,
                        password: password
                    }
                );


            console.log(
                "[AUTH] LOGIN RESPONSE:",
                result
            );


            // Login gagal
            if (!result || !result.status) {

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


            console.log(
                "[AUTH] USER DISIMPAN:",
                user
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

                password:
                    String(
                        data.password || ""
                    ).trim(),

                divisi:
                    String(
                        data.divisi || ""
                    ).trim(),

                role:
                    String(
                        data.role || "user"
                    )
                    .toLowerCase()
                    .trim()

            };


            // User biasa tidak boleh
            // menentukan admin dari frontend
            if (
                payload.role !== "admin" &&
                payload.role !== "user"
            ) {

                payload.role = "user";

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