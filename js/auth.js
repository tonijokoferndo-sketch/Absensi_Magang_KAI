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


            // Login melalui API Apps Script.
            const result =
                await apiRequest(
                    "login",
                    {
                        nim: nim,
                        password: password
                    }
                );


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

            if (!result.user || !result.sessionToken) {

                return {
                    status: false,
                    message:
                        "Sesi login dari server tidak valid."
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

                sessionToken:
                    result.sessionToken || "",

                role:
                    String(
                        result.user.role || "user"
                    )
                    .toLowerCase()
                    .trim(),

                mustChangePassword:
                    Boolean(
                        result.mustChangePassword ||
                        result.user.mustChangePassword
                    ),

                sessionVersion:
                    Number(
                        result.user.sessionVersion || 0
                    )

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

            };


            const result =
                await apiRequest(
                    "register",
                    payload
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
                !user.nim ||
                !user.sessionToken
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