async function apiRequest(action, data = {}) {

    const payload = {

        action:
            action,

        ...data

    };


    const safePayload = {
        ...payload
    };

    if ("qr" in safePayload) {

        safePayload.qr =
            "[REDACTED]";

    }

    if ("password" in safePayload) {

        safePayload.password =
            "[REDACTED]";

    }


    console.log(
        "[API] REQUEST:",
        safePayload
    );


    try {

        const response =
            await fetch(

                CONFIG.API_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );


        const text =
            await response.text();


        console.log(
            "[API] STATUS:",
            response.status
        );


        if (!response.ok) {

            return {

                status:
                    false,

                message:
                    "HTTP Error " +
                    response.status

            };

        }


        // =====================================
        // PARSE JSON
        // =====================================

        let result;


        try {

            result =
                JSON.parse(
                    text
                );

        } catch (error) {

            console.error(
                "[API] Response bukan JSON."
            );


            return {

                status:
                    false,

                message:
                    "Server tidak mengirim response JSON."

            };

        }


        return result;


    } catch (error) {

        console.error(
            "[API] ERROR:",
            error
        );


        return {

            status:
                false,

            message:
                "Tidak dapat terhubung ke server.",

            error:
                error.message

        };

    }

}