const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const shifts = ["", "صبح", "وسط", "عصر", "OFF"];
const storageKey = "shift-manager-fa-v3";

let staff = loadStaff();

function loadStaff() {
    try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];

    return saved.map(person => ({
        name: String(person.name || ""),
        assignments: days.map((_, index) => {
        const oldShift = person.assignments?.[index];
        // Keep shifts saved by the previous version, where OFF was called "استراحت".
        const shift = oldShift === "استراحت" ? "OFF" : oldShift;
        return shifts.includes(shift) ? shift : "";
        })
    })).filter(person => person.name);
    } catch {
    return [];
    }
}

function saveStaff() {
    localStorage.setItem(storageKey, JSON.stringify(staff));
}

function shiftClass(shift) {
    if (shift === "صبح") return "morning";
    if (shift === "وسط") return "mid";
    if (shift === "عصر") return "evening";
    if (shift === "OFF") return "off";
    return "empty";
}

function setShift(personIndex, dayIndex, shift) {
    if (!shifts.includes(shift)) return;
    staff[personIndex].assignments[dayIndex] = shift;
    saveStaff();
    render();
}

function render() {
    const table = document.getElementById("shift-table");
    table.replaceChildren();

    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    const dayHeading = document.createElement("th");
    dayHeading.textContent = "روز هفته";
    headingRow.appendChild(dayHeading);

    staff.forEach((person, personIndex) => {
    const th = document.createElement("th");
    th.className = "staff-heading";

    const name = document.createElement("span");
    name.className = "staff-heading-name";
    name.textContent = person.name;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove";
    removeButton.textContent = "حذف";
    removeButton.setAttribute("aria-label", `حذف ${person.name}`);
    removeButton.addEventListener("click", () => {
        staff.splice(personIndex, 1);
        saveStaff();
        render();
    });

    th.append(name, removeButton);
    headingRow.appendChild(th);
    });

    thead.appendChild(headingRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (staff.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 1;
    cell.className = "empty-table";
    cell.textContent = "برای نمایش جدول، ابتدا پرسنل را اضافه کنید.";
    row.appendChild(cell);
    tbody.appendChild(row);
    } else {
    days.forEach((day, dayIndex) => {
        const row = document.createElement("tr");
        const dayCell = document.createElement("td");
        dayCell.className = "day-name";
        dayCell.textContent = day;
        row.appendChild(dayCell);

        staff.forEach((person, personIndex) => {
        const cell = document.createElement("td");
        cell.className = "shift-cell";

        const shift = person.assignments[dayIndex];
        const badge = document.createElement("span");
        badge.className = `assignment ${shiftClass(shift)}`;
        badge.textContent = shift || "—";
        cell.appendChild(badge);

        cell.addEventListener("click", () => {
            const currentIndex = shifts.indexOf(person.assignments[dayIndex]);
            setShift(personIndex, dayIndex, shifts[(currentIndex + 1) % shifts.length]);
        });

        cell.addEventListener("dragover", event => {
            event.preventDefault();
            cell.classList.add("drag-over");
        });

        cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));

        cell.addEventListener("drop", event => {
            event.preventDefault();
            cell.classList.remove("drag-over");
            setShift(personIndex, dayIndex, event.dataTransfer.getData("text/plain"));
        });

        row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
    }

    table.appendChild(tbody);
}

document.querySelectorAll(".shift-token").forEach(token => {
    token.addEventListener("dragstart", event => {
    event.dataTransfer.setData("text/plain", token.dataset.shift);
    event.dataTransfer.effectAllowed = "copy";
    });
});

document.getElementById("add-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = document.getElementById("name-input");
    const name = input.value.trim();
    if (!name) return;

    if (staff.some(person => person.name === name)) {
    alert("این نام قبلاً اضافه شده است.");
    return;
    }

    staff.push({ name, assignments: Array(days.length).fill("") });
    saveStaff();
    input.value = "";
    input.focus();
    render();
});

document.getElementById("export-button").addEventListener("click", async event => {
    const button = event.currentTarget;

    if (typeof html2canvas === "undefined") {
    alert("ابزار ساخت تصویر بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
    return;
    }

    button.disabled = true;
    button.textContent = "در حال ساخت تصویر…";

    const table = document.getElementById("shift-table");
    table.classList.add("exporting");

    try {
    const canvas = await html2canvas(table, {
        backgroundColor: "#ffffff",
        scale: 2,
        width: table.scrollWidth,
        windowWidth: Math.max(document.documentElement.clientWidth, table.scrollWidth)
    });

    const link = document.createElement("a");
    link.download = "جدول-شیفت‌ها.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    } catch (error) {
    alert("ساخت تصویر انجام نشد. لطفاً دوباره تلاش کنید.");
    console.error(error);
    } finally {
    table.classList.remove("exporting");
    button.disabled = false;
    button.textContent = "خروجی تصویر";
    }
});

const qrDialog = document.getElementById("qr-dialog");
const qrForm = document.getElementById("qr-form");
const qrCanvas = document.getElementById("qr-canvas");
const qrResult = document.getElementById("qr-result");
const qrError = document.getElementById("qr-error");

document.getElementById("open-qr-button").addEventListener("click", () => {
    qrError.textContent = "";
    qrResult.style.display = "none";
    qrDialog.showModal();
});

document.getElementById("close-qr-button").addEventListener("click", () => {
    qrDialog.close();
});

qrForm.addEventListener("submit", async event => {
    event.preventDefault();
    qrError.textContent = "";
    qrResult.style.display = "none";

    if (typeof QRCode === "undefined") {
    qrError.textContent = "ابزار ساخت QR Code بارگذاری نشد. اتصال اینترنت را بررسی کنید.";
    return;
    }

    const url = document.getElementById("image-url").value.trim();

    try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("Invalid URL protocol");
    }

    await QRCode.toCanvas(qrCanvas, url, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M"
    });

    qrResult.style.display = "block";
    } catch (error) {
    qrError.textContent = "نشانی معتبر تصویر را وارد کنید.";
    }
});

document.getElementById("download-qr-button").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "QR-جدول-شیفت‌ها.png";
    link.href = qrCanvas.toDataURL("image/png");
    link.click();
});

render();
