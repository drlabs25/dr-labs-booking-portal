// 🔹 Replace this with your actual Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbw4sBOSu5WL_Cep7M1B9qYgfvBSQ0iuuCfbrRQDG6y4qPl6fJfap-4LLaX_wMqvg3ZV8A/exec";

/** Navigation **/
function goBack() { history.back(); }
function goHome() { window.location.href = 'index.html'; }

/** Admin Login **/
function adminLogin() {
    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    fetch(`${API_URL}?action=login&role=Admin&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                sessionStorage.setItem("adminName", data.agentName);
                window.location.href = "admin-dashboard.html";
            } else {
                alert(data.message || "Login failed");
            }
        });
}

/** Agent Login **/
function agentLogin() {
    const user = document.getElementById("agentUser").value;
    const pass = document.getElementById("agentPass").value;

    fetch(`${API_URL}?action=login&role=Agent&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                sessionStorage.setItem("agentName", data.agentName);
                window.location.href = "booking.html";
            } else {
                alert(data.message || "Login failed");
            }
        });
}

/** Load Tests **/
function loadTests() {
    fetch(`${API_URL}?action=getTests`)
        .then(res => res.json())
        .then(tests => {
            const list = document.getElementById("testList");
            list.innerHTML = "";
            tests.forEach(t => {
                let chk = document.createElement("input");
                chk.type = "checkbox";
                chk.value = `${t.code}|${t.cost}`;
                chk.onchange = recalcTotalFromSelection;
                list.appendChild(chk);
                list.appendChild(document.createTextNode(` ${t.name} - ₹${t.cost}`));
                list.appendChild(document.createElement("br"));
            });
        });
}

/** Load Packages **/
function loadPackages() {
    fetch(`${API_URL}?action=getPackages`)
        .then(res => res.json())
        .then(packages => {
            const list = document.getElementById("packageList");
            list.innerHTML = "";
            packages.forEach(p => {
                let chk = document.createElement("input");
                chk.type = "checkbox";
                chk.value = `${p.code}|${p.cost}`;
                chk.onchange = recalcTotalFromSelection;
                list.appendChild(chk);
                list.appendChild(document.createTextNode(` ${p.name} - ₹${p.cost}`));
                list.appendChild(document.createElement("br"));
            });
        });
}

/** Load Phlebos **/
function loadPhlebos() {
    fetch(`${API_URL}?action=getPhlebos`)
        .then(res => res.json())
        .then(phlebos => {
            const sel = document.getElementById("phleboList");
            sel.innerHTML = `<option value="">--Select Phlebo--</option>`;
            phlebos.forEach(name => {
                let opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
        });
}

/** Phlebo Availability Check **/
function checkPhleboAvailability() {
    const phlebo = document.getElementById("phleboList").value;
    const date = document.getElementById("prefDate").value;
    const time = document.getElementById("prefTime").value;
    if (phlebo && date && time) {
        fetch(`${API_URL}?action=checkPhleboSlot&phlebo=${encodeURIComponent(phlebo)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.available) {
                    alert("Preferred time not available");
                    document.getElementById("prefTime").value = "";
                }
            });
    }
}

/** Search Booking History **/
function searchCustomer() {
    const number = document.getElementById("custNumber").value;
    if (number.length !== 10) {
        alert("Enter a valid 10-digit number");
        return;
    }
    fetch(`${API_URL}?action=searchBookings&customerNumber=${encodeURIComponent(number)}`)
        .then(res => res.json())
        .then(bookings => {
            const body = document.getElementById("historyBody");
            body.innerHTML = "";
            if (bookings.length === 0) {
                alert("No booking history for this number");
                return;
            }
            document.getElementById("history").style.display = "block";
            bookings.forEach(b => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${b.customerNumber}</td>
                    <td>${b.name}</td>
                    <td>${b.dateTime}</td>
                    <td>${b.phlebo}</td>
                    <td>${b.agent}</td>
                    <td><button class="small-btn edit" onclick="editBooking('${b.bookingId}')">E</button></td>
                    <td><button class="small-btn cancel" onclick="updateStatus('${b.bookingId}','Cancel')">X</button></td>
                    <td><button class="small-btn paid" onclick="updateStatus('${b.bookingId}','Paid')">P</button></td>
                `;
                body.appendChild(tr);
            });
        });
}

/** Save Booking **/
function createBooking() {
    const params = {
        action: "saveBooking",
        customerNumber: document.getElementById("custNumber").value,
        mainCustomerName: document.getElementById("custName").value,
        dob: document.getElementById("dob").value,
        age: document.getElementById("age").value,
        gender: document.getElementById("gender").value,
        address: document.getElementById("address").value,
        location: document.getElementById("location").value,
        city: document.getElementById("city").value,
        phleboName: document.getElementById("phleboList").value,
        pincode: document.getElementById("pincode").value,
        preferredDate: document.getElementById("prefDate").value,
        preferredTime: document.getElementById("prefTime").value,
        tests: getSelectedCodes("testList"),
        packages: getSelectedCodes("packageList"),
        totalAmount: document.getElementById("totalAmount").value,
        discount: document.getElementById("discountList").value,
        techCharge: document.getElementById("techCharge").value,
        totalToPay: document.getElementById("totalToPay").value,
        agentName: sessionStorage.getItem("agentName") || ""
    };

    const query = new URLSearchParams(params).toString();
    fetch(`${API_URL}?${query}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`Booking saved! ID: ${data.bookingId}`);
                location.reload();
            } else {
                alert("Booking failed");
            }
        });
}

/** Helper to get selected test/package codes **/
function getSelectedCodes(containerId) {
    const checks = document.querySelectorAll(`#${containerId} input[type='checkbox']:checked`);
    return Array.from(checks).map(chk => chk.value.split("|")[0]).join(",");
}

/** Recalculate totals from selections **/
function recalcTotalFromSelection() {
    let total = 0;
    ["testList", "packageList"].forEach(id => {
        document.querySelectorAll(`#${id} input[type='checkbox']:checked`).forEach(chk => {
            total += parseFloat(chk.value.split("|")[1]) || 0;
        });
    });
    document.getElementById("totalAmount").value = total;
    recalculateTotal();
}

/** Report Filter **/
function filterReport() {
    const params = {
        action: "getReport",
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        phleboName: document.getElementById("repPhlebo").value,
        agentName: document.getElementById("repAgent").value,
        location: document.getElementById("repLocation").value
    };
    const query = new URLSearchParams(params).toString();
    fetch(`${API_URL}?${query}`)
        .then(res => res.json())
        .then(report => {
            const tbody = document.querySelector("#reportTable tbody");
            tbody.innerHTML = "";
            report.forEach(r => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${r.agentName}</td>
                    <td>${r.totalBookings}</td>
                    <td>${r.totalCancelled}</td>
                    <td>${r.totalPaid}</td>
                    <td>${r.confirmedBookings}</td>
                `;
                tbody.appendChild(tr);
            });
        });
}

/** Update booking status **/
function updateStatus(bookingId, status) {
    fetch(`${API_URL}?action=updateBookingStatus&bookingId=${encodeURIComponent(bookingId)}&status=${encodeURIComponent(status)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`Booking marked as ${status}`);
                searchCustomer(); // Refresh table after update
            } else {
                alert("Failed to update status");
            }
        });
}

/** Edit booking **/
function editBooking(bookingId) {
    fetch(`${API_URL}?action=getBookingDetails&bookingId=${encodeURIComponent(bookingId)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success === false) {
                alert("Booking not found");
                return;
            }
            showBookingForm();
            document.getElementById("custNumber").value = data.customerNumber;
            document.getElementById("custName").value = data.mainCustomerName;
            document.getElementById("dob").value = data.dob;
            document.getElementById("age").value = data.age;
            document.getElementById("gender").value = data.gender;
            document.getElementById("address").value = data.address;
            document.getElementById("location").value = data.location;
            document.getElementById("city").value = data.city;
            document.getElementById("phleboList").value = data.phleboName;
            document.getElementById("pincode").value = data.pincode;
            document.getElementById("prefDate").value = data.preferredDate;
            document.getElementById("prefTime").value = data.preferredTime;
            document.getElementById("totalAmount").value = data.totalAmount;
            document.getElementById("discountList").value = data.discount;
            document.getElementById("techCharge").value = data.techCharge;
            document.getElementById("totalToPay").value = data.totalToPay;
        });
}
