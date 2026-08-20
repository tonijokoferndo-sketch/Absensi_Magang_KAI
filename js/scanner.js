const Scanner = {

    // =========================================
    // PROPERTY
    // =========================================

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

        console.log(
            "Memulai QR Scanner..."
        );


        // =====================================
        // CEK LIBRARY
        // =====================================

        if (
            typeof Html5Qrcode ===
            "undefined"
        ) {

            console.error(
                "Html5Qrcode tidak ditemukan."
            );

            throw new Error(
                "Library QR Scanner tidak ditemukan. Periksa path assets/html5-qrcode.min.js"
            );

        }


        try {

            // =================================
            // HENTIKAN SCANNER LAMA
            // =================================

            if (
                this.html5QrCode &&
                this.isRunning
            ) {

                await this.stop();

            }


            if (
                this.html5QrCode
            ) {

                try {

                    await this.html5QrCode.clear();

                } catch (error) {

                    console.warn(
                        "Clear scanner:",
                        error
                    );

                }

                this.html5QrCode = null;

            }


            // =================================
            // CEK ELEMENT
            // =================================

            const element =
                document.getElementById(
                    elementId
                );


            if (!element) {

                throw new Error(
                    "Element #" +
                    elementId +
                    " tidak ditemukan."
                );

            }


            // Bersihkan container

            element.innerHTML = "";


            // =================================
            // RESET
            // =================================

            this.lastResult = "";


            // =================================
            // BUAT INSTANCE
            // =================================

            this.html5QrCode =
                new Html5Qrcode(
                    elementId
                );


            // =================================
            // KONFIGURASI
            // =================================

            const config = {

                fps: 10,

                qrbox: function (
                    viewfinderWidth,
                    viewfinderHeight
                ) {

                    let size =
                        Math.min(
                            viewfinderWidth,
                            viewfinderHeight
                        ) * 0.70;

                    size =
                        Math.max(
                            180,
                            Math.min(
                                size,
                                300
                            )
                        );

                    return {
                        width: size,
                        height: size
                    };

                },

                aspectRatio: 1.0,

                disableFlip: false

            };


            // =================================
            // CALLBACK BERHASIL
            // =================================

            const successCallback =
                (
                    decodedText,
                    decodedResult
                ) => {

                    console.log(
                        "QR TERBACA:",
                        decodedText
                    );


                    // Hindari hasil sama
                    // berulang kali

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

                };


            // =================================
            // CALLBACK ERROR SCAN
            // =================================

            const errorCallback =
                (errorMessage) => {

                    // Error seperti
                    // QR belum terlihat
                    // adalah normal.

                };


            // =================================
            // COBA KAMERA BELAKANG
            // =================================

            try {

                console.log(
                    "Mencoba kamera belakang..."
                );


                await this.html5QrCode.start(

                    {
                        facingMode:
                            "environment"
                    },

                    config,

                    successCallback,

                    errorCallback

                );


                this.isRunning =
                    true;


                console.log(
                    "Kamera belakang berhasil dibuka."
                );


                return;

            } catch (
                environmentError
            ) {

                console.warn(
                    "Kamera belakang gagal:",
                    environmentError
                );

            }


            // =================================
            // FALLBACK CAMERA
            // =================================

            console.log(
                "Mencari daftar kamera..."
            );


            const cameras =
                await Html5Qrcode.getCameras();


            if (
                !cameras ||
                cameras.length === 0
            ) {

                throw new Error(
                    "Tidak ada kamera yang ditemukan."
                );

            }


            console.log(
                "Daftar kamera:",
                cameras
            );


            // =================================
            // PILIH KAMERA
            // =================================

            let selectedCamera =
                cameras[0].id;


            // Prioritaskan kamera belakang

            const backCamera =
                cameras.find(
                    camera => {

                        const label =
                            String(
                                camera.label ||
                                ""
                            ).toLowerCase();

                        return (
                            label.includes(
                                "back"
                            ) ||

                            label.includes(
                                "rear"
                            ) ||

                            label.includes(
                                "environment"
                            )

                        );

                    }
                );


            if (backCamera) {

                selectedCamera =
                    backCamera.id;

            }


            // =================================
            // START DENGAN CAMERA ID
            // =================================

            await this.html5QrCode.start(

                selectedCamera,

                config,

                successCallback,

                errorCallback

            );


            this.isRunning =
                true;


            console.log(
                "Kamera berhasil dibuka:",
                selectedCamera
            );


        } catch (error) {

            console.error(
                "SCANNER ERROR:",
                error
            );


            this.isRunning =
                false;


            this.html5QrCode =
                null;


            let message =
                "Kamera tidak dapat dibuka.";


            if (
                error &&
                error.message
            ) {

                message +=
                    " " +
                    error.message;

            }


            throw new Error(
                message
            );

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

                console.log(
                    "Menghentikan scanner..."
                );


                await this.html5QrCode.stop();


                try {

                    await this.html5QrCode.clear();

                } catch (clearError) {

                    console.warn(
                        "Clear warning:",
                        clearError
                    );

                }

            }

        } catch (error) {

            console.error(
                "STOP SCANNER ERROR:",
                error
            );

        } finally {

            this.html5QrCode =
                null;

            this.isRunning =
                false;

            this.lastResult =
                "";

        }

    },


    // =========================================
    // RESET
    // =========================================

    reset: function () {

        this.lastResult =
            "";

    }

};