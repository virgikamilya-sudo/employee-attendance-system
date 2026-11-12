const me = API.user();
if (!me) {
    location.href = "/login.html";
}

$("#who").textContent = me?.name || "";

let coords = null;

setInterval(() => {
    $("#clockNow").textContent =
        new Date().toLocaleTimeString("id-ID");
}, 1000);

(async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            }
        });

        $("#video").srcObject = stream;

    } catch (error) {
        $("#msg").textContent =
            "Kamera tidak bisa diakses. Izinkan akses kamera.";
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            $("#loc").textContent =
                `Lokasi: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        },

        () => {
            $("#loc").textContent =
                "Lokasi gagal diambil. Izinkan akses lokasi.";
        },

        {
            enableHighAccuracy: true
        }
    );

    loadHistory();

})();

function snap() {
    const video = $("#video");
    const canvas = $("#canvas");

    canvas.width = 480;

    canvas.height = Math.round(
        480 * (video.videoHeight / video.videoWidth || 0.75)
    );

    const context = canvas.getContext("2d");

    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return canvas.toDataURL("image/jpeg", 0.7);
}

async function act(type) {
    if (!coords) {
        return alert("Lokasi belum tersedia");
    }

    try {
        const response = await API.post(
            "/attendance/" + type,
            {
                photo: snap(),
                ...coords
            }
        );

        $("#msg").textContent =
            `${response.message} (${response.time})`;

        loadHistory();

    } catch (error) {
        $("#msg").textContent = error.message;
    }
}

$("#btnIn").onclick = () => {
    act("clock-in");
};

$("#btnOut").onclick = () => {
    act("clock-out");
};

async function loadHistory() {
    const list = await API.get("/attendance/me");
    $("#hist").innerHTML = list.map((record) => `
        <tr>
            <td>${record.date}</td>
            <td>${record.clock_in || "-"}</td>
            <td>${record.clock_out || "-"}</td>
            <td>
                ${record.status}
                ${record.is_valid ? "" : " ⚠️"}
            </td>
        </tr>
    `).join("");
}

$("#reqForm").onsubmit = async (event) => {

    event.preventDefault();

    try {
        const formData = Object.fromEntries(
            new FormData(event.target)
        );

        await API.post("/requests", formData);

        alert("Pengajuan terkirim");
        event.target.reset();

    } catch (error) {
        alert(error.message);
    }
};
