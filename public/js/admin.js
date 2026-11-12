const me = API.user();
if (!me) {
    location.href = "/login.html";
}

else if (!["admin", "hr"].includes(me.role)) {
    location.href = "/clock.html";
}

const pad = n => String(n).padStart(2, "0");

const iso = d => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formData = f => {
    return Object.fromEntries(new FormData(f));
};

const fillForm = (f, o) => {

    for (const el of f.elements) {

        if (el.name) {
            el.value = o[el.name] ?? "";
        }
    }
};

$$("[data-close]").forEach(button => {

    button.onclick = () => {
        button.closest("dialog").close();
    };
});

const loaders = {
    attendance: () => loadAttendance(),
    employees: () => loadEmployees(),
    overtime: () => loadRequests("overtime"),
    timeoff: () => loadRequests("timeoff"),
    shifts: () => loadShifts(),
    worktime: () => loadSettings()
};

function showTab(name) {
    if (!loaders[name]) {
        name = "attendance";
    }

    $$("section.page").forEach(section => {
        section.hidden = section.id !== name;
    });

    $$(".tab").forEach(tab => {
        tab.classList.toggle(
            "active",
            tab.dataset.tab === name
        );
    });

    location.hash = name;
    loaders[name]();
}

$$(".tab").forEach(tab => {
    tab.onclick = () => {
        showTab(tab.dataset.tab);
    };
});

let currentDate = new Date();
let rows = [];
let sort = {
    key: "clock_in",
    dir: 1
};

async function loadAttendance() {
    const d = iso(currentDate);
    const y = new Date(currentDate);
    y.setDate(y.getDate() - 1);

    $("#dateLabel").textContent =
        currentDate.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long"
        });

    const from = $("#from").value;
    const to = $("#to").value;
    const range = from && to
        ? `from=${from}&to=${to}`
        : `date=${d}`;
    const qs = `${range}&q=${encodeURIComponent($("#search").value)}&status=${$("#statusFilter").value}`;
    const [list, cur, prev] = await Promise.all([
        API.get("/attendance?" + qs),
        API.get("/attendance/summary?date=" + d),
        API.get("/attendance/summary?date=" + iso(y))
    ]);

    rows = list;

    for (const k of Object.keys(cur)) {
        const diff = cur[k] - prev[k];
        $("#s_" + k).innerHTML = `
            <b>${cur[k]}</b>
            <small class="${diff > 0 ? "up" : diff < 0 ? "down" : ""}">
                ${diff > 0 ? "+" : ""}${diff} vs yesterday
            </small>
        `;
    }

    renderTable();
}

function renderTable() {
    const data = [...rows].sort((a, b) => {
        return (
            (a[sort.key] ?? "") > (b[sort.key] ?? "")
                ? 1
                : -1
        ) * sort.dir;

    });

    const dur = r => {
        if (r.clock_in && r.clock_out) {
            return fmtMin(
                toMin(r.clock_out) - toMin(r.clock_in)
            );
        }

        return "";
    };

    $("#attBody").innerHTML = data.map(r => `
        <tr>
            <td>
                <div class="emp">
                    <div class="ava">
                        ${esc(r.name[0])}
                    </div>

                    <div>
                        <b>${esc(r.name)}</b>
                        <small>
                            ${esc(r.employee_no)}
                        </small>
                    </div>
                </div>
            </td>


            <td class="${r.status === "late" ? "warn" : ""}">
                ${r.clock_in || "-"} → ${r.clock_out || "-"}
                <small>
                    ${dur(r)} ${r.date}
                </small>
            </td>


            <td>
                ${r.overtime_minutes
                    ? fmtMin(r.overtime_minutes)
                    : "-"
                }
            </td>

            <td>
                ${r.in_photo
                    ? `<a class="chip" target="_blank"
                        href="/uploads/${r.in_photo}">
                        ${esc(r.in_photo)}
                    </a>`
                    : "-"
                }
            </td>

            <td>
                ${r.in_address
                    ? `<span class="chip"
                        title="${esc(r.in_address)}">
                        ${esc(r.in_address)}
                    </span>`
                    : "-"
                }

                ${r.is_valid
                    ? ""
                    : '<i class="badge red">Invalid</i>'
                }

            </td>

            <td>
                ${esc(r.note || "")}
            </td>
        </tr>

    `).join("")

    || `
        <tr>
            <td colspan="6" style="text-align:center;color:var(--muted)">
                Tidak ada data
            </td>
        </tr>
    `;

}

$$("th[data-sort]").forEach(th => {
    th.onclick = () => {
        sort = {
            key: th.dataset.sort,

            dir: sort.key === th.dataset.sort
                ? -sort.dir
                : 1
        };

        renderTable();

    };

});

$("#prev").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadAttendance();
};

$("#next").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadAttendance();
};

let timer;

$("#search").oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(loadAttendance, 300);
};

["from", "to", "statusFilter"].forEach(id => {
    $("#" + id).onchange = loadAttendance;
});

$("#btnReport").onclick = async () => {
    const d = iso(currentDate);
    const from = $("#from").value || d;
    const to = $("#to").value || d;
    const res = await fetch(
        `/api/attendance/export?from=${from}&to=${to}`,
        {
            headers: {
                Authorization: "Bearer " + API.token()
            }
        }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `attendance_${from}_${to}.csv`;
    a.click();
};

$("#btnAdd").onclick = async () => {

    const emps = await API.get("/employees");
    const f = $("#formAtt");
    f.reset();
    f.elements.employee_id.innerHTML = emps
        .filter(e => e.role === "employee")
        .map(e => `
            <option value="${e.id}">
                ${esc(e.name)}
            </option>
        `)
        .join("");

    f.elements.date.value = iso(currentDate);
    $("#dlgAtt").showModal();
};

$("#formAtt").onsubmit = async e => {
    e.preventDefault();
    try {
        await API.post(
            "/attendance/manual",
            formData(e.target)
        );
        $("#dlgAtt").close();
        loadAttendance();
    } catch (err) {
        alert(err.message);
    }
};


let shiftsCache = [];
async function loadEmployees() {
    const [list, shifts] = await Promise.all([
        API.get("/employees"),
        API.get("/shifts")
    ]);


    shiftsCache = shifts;

    $("#empBody").innerHTML = list.map(e => `

        <tr>
            <td>${esc(e.employee_no)}</td>
            <td>${esc(e.name)}</td>
            <td>${esc(e.email)}</td>
            <td>${esc(e.role)}</td>
            <td>${esc(e.department || "-")}</td>
            <td>${esc(e.shift || "-")}</td>
            <td>
                <button class="btn" data-edit="${e.id}">
                    Edit
                </button>

                <button class="btn" data-del="${e.id}">
                    Hapus
                </button>

            </td>
        </tr>

    `).join("");

    $$("[data-edit]").forEach(button => {

        button.onclick = () => {
            const employee = list.find(
                e => e.id == button.dataset.edit
            );
            openEmp(employee);
        };
    });

    $$("[data-del]").forEach(button => {
        button.onclick = async () => {
            if (confirm("Nonaktifkan karyawan ini?")) {
                await API.del(
                    "/employees/" + button.dataset.del
                );
                loadEmployees();}
        };
    });
}

async function openEmp(e = {}) {
    if (!shiftsCache.length) {
        shiftsCache = await API.get("/shifts");
    }

    const f = $("#formEmp");
    f.reset();
    f.elements.shift_id.innerHTML = shiftsCache
        .map(s => `
            <option value="${s.id}">
                ${esc(s.name)}
                (${s.start_time}-${s.end_time})
            </option>
        `)

        .join("");

    fillForm(f, {
        role: "employee",
        shift_id: shiftsCache[0]?.id,
        ...e,
        eid: e.id,
        password: ""
    });

    $("#dlgEmp").showModal();
}

$("#btnAddEmp").onclick = () => openEmp();

$("#formEmp").onsubmit = async ev => {
    ev.preventDefault();
    const d = formData(ev.target);
    try {

        if (d.eid) {
            await API.put("/employees/" + d.eid, d);
        }

        else {
            await API.post("/employees", d);
        }

        $("#dlgEmp").close();
        loadEmployees();
    } catch (err) {

        alert(err.message);
    }

};

async function loadRequests(kind) {
    const list = await API.get(
        "/requests?kind=" + kind
    );

    const body = $("#" + kind + "Body");
    body.innerHTML = list.map(r => `

        <tr>
            <td>${esc(r.name)}</td>
            <td>
                ${kind === "overtime"

                    ? `${r.start_date} (${fmtMin(r.minutes)})`

                    : `${esc(r.type || "")}: ${r.start_date} → ${r.end_date}`

                }
            </td>

            <td>
                ${esc(r.reason || "")}
            </td>

            <td>
                <i class="badge ${r.status}">
                    ${r.status}
                </i>
            </td>

            <td>

                ${r.status === "pending"

                    ? `

                        <button class="btn"
                            data-id="${r.id}"
                            data-s="approved">
                            Approve
                        </button>

                        <button class="btn"
                            data-id="${r.id}"
                            data-s="rejected">
                            Reject
                        </button>
                    `: ""
                }
            </td>
        </tr>

    `).join("")
    || `
        <tr>
            <td colspan="5" style="text-align:center;color:var(--muted)">
                Belum ada pengajuan
            </td>
        </tr>
    `;

    $$("button[data-id]", body).forEach(button => {
        button.onclick = async () => {
            await API.patch(
                "/requests/" + button.dataset.id,
                {
                    status: button.dataset.s
                }

            );

            loadRequests(kind);
            loadBadges();
        };
    });
}

async function loadShifts() {

    shiftsCache = await API.get("/shifts");
    $("#shiftBody").innerHTML = shiftsCache.map(s => `
        <tr>
            <td>${esc(s.name)}</td>
            <td>${s.start_time}</td>
            <td>${s.end_time}</td>
            <td>
                <button class="btn"
                    data-sedit="${s.id}">
                    Edit
                </button>
            </td>
        </tr>

    `).join("");
    $$("[data-sedit]").forEach(button => {
        button.onclick = () => {
            const shift = shiftsCache.find(
                s => s.id == button.dataset.sedit
            );
            openShift(shift);
        };
    });

}

function openShift(s = {}) {
    const f = $("#formShift");
    f.reset();
    fillForm(f, {
        ...s,
        sid: s.id
    });

    $("#dlgShift").showModal();
}
$("#btnAddShift").onclick = () => openShift();
$("#formShift").onsubmit = async ev => {
    ev.preventDefault();
    const d = formData(ev.target);
    try {
        if (d.sid) {
            await API.put("/shifts/" + d.sid, d);
        }

        else {
            await API.post("/shifts", d);
        }

        $("#dlgShift").close();
        loadShifts();
    } catch (err) {
        alert(err.message);
    }
};

async function loadSettings() {
    const settings = await API.get("/settings");
    fillForm($("#formSettings"), settings);

}

$("#formSettings").onsubmit = async ev => {
    ev.preventDefault();
    try {
        await API.put(
            "/settings",
            formData(ev.target)
        );

        alert("Pengaturan tersimpan");
    } catch (err) {
        alert(err.message);
    }
};

showTab(location.hash.slice(1));
loadBadges();