async function apiRequest(action, data = {}) {

    const payload = {

        action:
            action,

        ...data

    };


    console.log(
        "[API] REQUEST:",
        payload
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


        console.log(
            "[API] RESPONSE:",
            text
        );


        if (!response.ok) {

            return {

                status:
                    false,

                message:
                    "HTTP Error " +
                    response.status,

                raw:
                    text

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
                "[API] Response bukan JSON:",
                text
            );


            return {

                status:
                    false,

                message:
                    "Server tidak mengirim response JSON.",

                raw:
                    text

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