const Scanner = {

    html5QrCode: null,

    isRunning: false,

    lastResult: "",


    // =========================================
    // START SCANNER
    // =========================================

    start: async function (
        elementId,
        onScanSuccess
    ) {

        try {

            // Pastikan library tersedia

            if (
                typeof Html5Qrcode ===
                "undefined"
            ) {

                console.error(
                    "Html5Qrcode tidak ditemukan."
                );

                throw new Error(
                    "Library QR Scanner belum tersedia."
                );

            }


            // Hentikan scanner sebelumnya

            if (
                this.html5QrCode &&
                this.isRunning
            ) {

                await this.stop();

            }


            const element =
                document.getElementById(
                    elementId
                );


            if (!element) {

                throw new Error(
                    "Element QR Reader tidak ditemukan."
                );

            }


            // Buat instance scanner

            this.html5QrCode =
                new Html5Qrcode(
                    elementId
                );


            // Konfigurasi kamera

            const config = {

                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1.0

            };


            // Mulai kamera

            await this.html5QrCode.start(

                {
                    facingMode: "environment"
                },

                config,

                (decodedText, decodedResult) => {

                    console.log(
                        "QR TERBACA:",
                        decodedText
                    );


                    // Hindari scan berulang
                    if (
                        this.lastResult ===
                        decodedText
                    ) {

                        return;

                    }


                    this.lastResult =
                        decodedText;


                    if (
                        typeof onScanSuccess ===
                        "function"
                    ) {

                        onScanSuccess(
                            decodedText,
                            decodedResult
                        );

                    }

                },

                (errorMessage) => {

                    // Error scan biasa
                    // tidak perlu ditampilkan
                    // terus-menerus

                }

            );


            this.isRunning = true;


            console.log(
                "QR Scanner berhasil dimulai."
            );


        } catch (error) {

            console.error(
                "SCANNER ERROR:",
                error
            );


            throw error;

        }

    },


    // =========================================
    // STOP SCANNER
    // =========================================

    stop: async function () {

        try {

            if (
                this.html5QrCode &&
                this.isRunning
            ) {

                await this.html5QrCode.stop();


                this.isRunning =
                    false;


                console.log(
                    "QR Scanner dihentikan."
                );

            }

        } catch (error) {

            console.error(
                "STOP SCANNER ERROR:",
                error
            );

        }

    },


    // =========================================
    // RESET HASIL SCAN
    // =========================================

    reset: function () {

        this.lastResult = "";

    }

};