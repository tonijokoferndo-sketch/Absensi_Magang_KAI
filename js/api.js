async function apiRequest(action, data = {}) {

    const payload = {

        action:
            action,

        ...data

    };


    console.log(
        "[API] REQUEST:",
        action
    );

    try {

        if (
            action !== "login" &&
            action !== "register"
        ) {

            const storedUser =
                JSON.parse(
                    localStorage.getItem("user") || "null"
                );

            if (storedUser && storedUser.sessionToken) {
                payload.sessionToken =
                    storedUser.sessionToken;
            }

        }

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


        if (!response.ok) {

            return result || {
                status: false,
                message: "HTTP Error " + response.status
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