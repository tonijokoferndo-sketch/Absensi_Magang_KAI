const App = {

    // =========================================
    // INIT APLIKASI
    // =========================================

    init: async function () {

        console.log(
            "[APP] Aplikasi dimulai..."
        );

        try {

            // Pasang semua event
            this.setupEvents();


            // Cek user yang tersimpan
            const user =
                Auth.getUser();


            // =====================================
            // USER SUDAH LOGIN
            // =====================================

            if (user) {

                this.showPage(
                    "dashboardPage"
                );


                await Dashboard.show();

            }


            // =====================================
            // BELUM LOGIN
            // =====================================

            else {

                console.log(
                    "[APP] Belum login."
                );


                this.showPage(
                    "loginPage"
                );

            }


        } catch (error) {

            console.error(
                "[APP] INIT ERROR:",
                error
            );

            this.showPage(
                "loginPage"
            );

        }

    },


    // =========================================
    // SHOW PAGE
    // =========================================

    showPage: function (pageId) {

        console.log(
            "[APP] Menampilkan:",
            pageId
        );


        const pages =
            document.querySelectorAll(
                ".page"
            );


        pages.forEach(
            function (page) {

                page.classList.add(
                    "hidden"
                );

            }
        );


        const page =
            document.getElementById(
                pageId
            );


        if (!page) {

            console.error(
                "[APP] Page tidak ditemukan:",
                pageId
            );

            return;

        }


        page.classList.remove(
            "hidden"
        );

    },


    // =========================================
    // HELPER ELEMENT
    // =========================================

    getElement: function (id) {

        const element =
            document.getElementById(id);


        if (!element) {

            console.warn(
                "[APP] Element tidak ditemukan:",
                id
            );

        }


        return element;

    },


    // =========================================
    // EVENTS
    // =========================================

    setupEvents: function () {

        console.log(
            "[APP] Memasang event..."
        );


        // =====================================
        // SHOW REGISTER
        // =====================================

        const showRegister =
            this.getElement(
                "showRegister"
            );


        if (showRegister) {

            showRegister.addEventListener(
                "click",
                () => {

                    this.showPage(
                        "registerPage"
                    );

                }
            );

        }


        // =====================================
        // SHOW LOGIN
        // =====================================

        const showLogin =
            this.getElement(
                "showLogin"
            );


        if (showLogin) {

            showLogin.addEventListener(
                "click",
                () => {

                    this.showPage(
                        "loginPage"
                    );

                }
            );

        }


        // =====================================
        // LOGIN FORM
        // =====================================

        const loginForm =
            this.getElement(
                "loginForm"
            );


        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    await this.handleLogin();

                }
            );

        }


        // =====================================
        // REGISTER FORM
        // =====================================

        const registerForm =
            this.getElement(
                "registerForm"
            );


        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    await this.handleRegister();

                }
            );

        }


        // =====================================
        // LOGOUT
        // =====================================

        const logoutButton =
            this.getElement(
                "logoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                () => {

                    Auth.logout();

                }
            );

        }

    },


    // =========================================
    // HANDLE LOGIN
    // =========================================

    handleLogin: async function () {

        const nimInput =
            this.getElement(
                "loginNim"
            );


        const passwordInput =
            this.getElement(
                "loginPassword"
            );


        const message =
            this.getElement(
                "loginMessage"
            );


        if (
            !nimInput ||
            !passwordInput
        ) {

            console.error(
                "[LOGIN] Input tidak ditemukan."
            );

            return;

        }


        const nim =
            nimInput.value.trim();


        const password =
            passwordInput.value.trim();


        // =====================================
        // VALIDASI
        // =====================================

        if (!nim || !password) {

            if (message) {

                message.textContent =
                    "NIM dan Password wajib diisi.";

            }

            return;

        }


        if (message) {

            message.textContent =
                "Memverifikasi akun...";

        }


        // =====================================
        // LOGIN
        // =====================================

        const result =
            await Auth.login(
                nim,
                password
            );


        if (message) {

            message.textContent =
                result.message ||
                "Login selesai.";

        }


        // =====================================
        // LOGIN BERHASIL
        // =====================================

        if (
            result &&
            result.status
        ) {

            console.log(
                "[LOGIN] Login berhasil."
            );


            // Bersihkan password
            passwordInput.value =
                "";


            // Tampilkan dashboard
            this.showPage(
                "dashboardPage"
            );


            // Jalankan dashboard
            await Dashboard.show();

        }

    },


    // =========================================
    // HANDLE REGISTER
    // =========================================

    handleRegister: async function () {

        const nimInput =
            this.getElement(
                "registerNim"
            );


        const namaInput =
            this.getElement(
                "registerNama"
            );


        const emailInput =
            this.getElement(
                "registerEmail"
            );


        const divisiInput =
            this.getElement(
                "registerDivisi"
            );


        const passwordInput =
            this.getElement(
                "registerPassword"
            );


        const message =
            this.getElement(
                "registerMessage"
            );


        // =====================================
        // CEK ELEMENT
        // =====================================

        if (
            !nimInput ||
            !namaInput ||
            !passwordInput
        ) {

            console.error(
                "[REGISTER] Form tidak lengkap."
            );

            return;

        }


        // =====================================
        // AMBIL DATA
        // =====================================

        const data = {

            nim:
                nimInput.value.trim(),

            nama:
                namaInput.value.trim(),

            email:
                emailInput
                    ? emailInput.value.trim()
                    : "",

            divisi:
                divisiInput
                    ? divisiInput.value.trim()
                    : "",

            password:
                passwordInput.value.trim()

        };


        // =====================================
        // VALIDASI
        // =====================================

        if (
            !data.nim ||
            !data.nama ||
            !data.password
        ) {

            if (message) {

                message.textContent =
                    "NIM, Nama, dan Password wajib diisi.";

            }

            return;

        }


        if (message) {

            message.textContent =
                "Mendaftarkan akun...";

        }


        console.log(
            "[REGISTER] Mengirim data..."
        );


        // =====================================
        // REGISTER
        // =====================================

        const result =
            await Auth.register(
                data
            );


        console.log(
            "[REGISTER] Response:",
            result
        );


        if (message) {

            message.textContent =
                result.message ||
                "Pendaftaran selesai.";

        }


        // =====================================
        // REGISTER BERHASIL
        // =====================================

        if (
            result &&
            result.status
        ) {

            // Bersihkan form
            const form =
                this.getElement(
                    "registerForm"
                );


            if (form) {

                form.reset();

            }


            // Password dibersihkan
            passwordInput.value =
                "";


            // Pindah ke login
            setTimeout(
                () => {

                    this.showPage(
                        "loginPage"
                    );


                    const loginMessage =
                        this.getElement(
                            "loginMessage"
                        );


                    if (loginMessage) {

                        loginMessage.textContent =
                            "Pendaftaran berhasil. Silakan login.";

                    }

                },
                1000
            );

        }

    },


    // =========================================
    // LOGOUT
    // =========================================

    logout: function () {

        Auth.logout();

    }

};


// =============================================
// START APPLICATION
// =============================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "[APP] DOM siap."
        );


        App.init();

    }
);