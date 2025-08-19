// ✅ Runs on Booking.html load
window.addEventListener("DOMContentLoaded", function () {
  // Show agent name from localStorage
  const agentName = localStorage.getItem("agentName") || "Unknown Agent";
  document.getElementById("agentNameLabel").innerText = "Agent: " + agentName;

  // Update date/time every second
  function updateDateTime() {
    const now = new Date();
    const formatted = now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    document.getElementById("dateTimeLabel").innerText = formatted;
  }
  updateDateTime();
  setInterval(updateDateTime, 1000);
});
// 🔹 Replace this with your actual Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbw4sBOSu5WL_Cep7M1B9qYgfvBSQ0iuuCfbrRQDG6y4qPl6fJfap-4LLaX_wMqvg3ZV8A/exec";

/** Navigation **/
function goBack() { history.back(); }
function goHome() { window.location.href = 'index.html'; }

// 🔹 Booking tracking
let isSubBookingMode = false;   // Tracks whether user is adding sub booking
let bookingList = [];
let subBookingCounter = 0;
let mainBookingData = null;

/** Admin Login **/
function adminLogin() {
    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    fetch(`${API_URL}?action=login&role=Admin&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(data => {
           if (data.success) {
    localStorage.setItem("agentName", data.agentName); // ✅ store real name
    window.location.href = "booking.html";
}
 else {
                alert(data.message || "Login failed");
            }
        });
}

/** Agent Login **/
function agentLogin() {
    const user = document.getElementById("agentUser").value.trim();
    const pass = document.getElementById("agentPass").value.trim();

    fetch(`${API_URL}?action=login&role=Agent&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // ✅ Save agentName from backend
                localStorage.setItem("agentName", data.agentName || user);

                // Redirect to booking page
                window.location.href = "booking.html";
            } else {
                alert(data.message || "Invalid login!");
            }
        })
        .catch(err => {
            console.error("Login error:", err);
            alert("Error during login!");
        });
}

/** Load Tests with live search from Google Sheet **/
function loadTests(searchTerm = "") {
    fetch(`${API_URL}?action=getTests&search=${encodeURIComponent(searchTerm)}`)
        .then(res => res.json())
        .then(tests => {
            const list = document.getElementById("testList");
            list.innerHTML = "";
            tests.forEach(t => {
                let chk = document.createElement("input");
                chk.type = "checkbox";
                chk.value = `${t.code}|${t.cost}|${t.name}`;
                chk.onchange = recalcTotalFromSelection;
                list.appendChild(chk);
                list.appendChild(document.createTextNode(` ${t.name} - ₹${t.cost}`));
                list.appendChild(document.createElement("br"));
            });
        });
}

/** Load Packages with live search from Google Sheet **/
function loadPackages(searchTerm = "") {
    fetch(`${API_URL}?action=getPackages&search=${encodeURIComponent(searchTerm)}`)
        .then(res => res.json())
        .then(packages => {
            const list = document.getElementById("packageList");
            list.innerHTML = "";
            packages.forEach(p => {
                let chk = document.createElement("input");
                chk.type = "checkbox";
                chk.value = `${p.code}|${p.cost}|${p.name}`;
                chk.onchange = recalcTotalFromSelection;
                list.appendChild(chk);
                list.appendChild(document.createTextNode(` ${p.name} - ₹${p.cost}`));
                list.appendChild(document.createElement("br"));
            });
        });
}

// Search filters
function filterTests(query) { loadTests(query); }
function filterPackages(query) { loadPackages(query); }

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
                    <td>${b.status}</td>
                    <td><button class="small-btn edit" onclick="editBooking('${b.bookingId}')">E</button></td>
                    <td><button class="small-btn cancel" onclick="updateStatus('${b.bookingId}','Cancel')">X</button></td>
                    <td><button class="small-btn paid" onclick="updateStatus('${b.bookingId}','Paid')">P</button></td>
                `;
                body.appendChild(tr);
            });
        });
}

/** Save Booking with mandatory field check **/
function createBooking() {
    let custNumber = document.getElementById("custNumber").value.trim();

    // Debug check
    console.log("custNumber:", custNumber, "length:", custNumber.length);

    if (!/^\d{10}$/.test(custNumber)) {
        alert("Enter valid 10-digit customer number");
        return;
    }
    if (!document.getElementById("custName").value.trim()) return alert("Enter customer name");
    if (!document.getElementById("age").value) return alert("Enter age");
    if (!document.getElementById("gender").value) return alert("Select gender");
    if (!document.getElementById("address").value.trim()) return alert("Enter address");
    if (!document.getElementById("location").value.trim()) return alert("Enter location");
    if (!document.getElementById("city").value) return alert("Select city");
    if (!document.getElementById("phleboList").value) return alert("Select phlebo");
    if (!document.getElementById("prefDate").value) return alert("Select preferred date");
    if (!document.getElementById("prefTime").value) return alert("Select preferred time");

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
    agentName: localStorage.getItem("agentName") || "",
    // 🔹 NEW
    bookingType: (bookingList.length === 0) ? "Main" : "Sub"
};
    const query = new URLSearchParams(params).toString();
    fetch(`${API_URL}?${query}`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            let label;
           if (bookingList.length === 0) {
    label = "Main Booking";
    // Save main booking values
    mainBookingData = {
        custNumber: params.customerNumber,
        address: params.address,
        location: params.location,
        city: params.city,
        phlebo: params.phleboName,
        pincode: params.pincode,
        prefDate: params.preferredDate,
        prefTime: params.preferredTime
    };
} else {
    subBookingCounter++;
    label = `Sub Booking ${subBookingCounter}`;
}

            bookingList.push({
                type: label,
                name: params.mainCustomerName,
                datetime: `${params.preferredDate} ${params.preferredTime}`,
                cost: params.totalToPay
            });

            renderBookingTable();
            document.getElementById("addMoreBtn").style.display = "inline-block";
            addSubBooking();
        } else {
            alert("Booking failed");
        }
    });
}

// ✅ keep this OUTSIDE
function renderBookingTable() {
    const body = document.getElementById("mainBookingPreviewBody");
    body.innerHTML = "";
    bookingList.forEach(b => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${b.type}: ${b.name}</td>
            <td>${b.datetime}</td>
            <td>${b.cost}</td>
        `;
        body.appendChild(tr);
    });
    document.getElementById("mainBookingPreview").style.display = "block";
}

function getSelectedCodes(containerId) {
    const checks = document.querySelectorAll(`#${containerId} input[type='checkbox']:checked`);
    return Array.from(checks).map(chk => chk.value.split("|")[0]).join(",");
}

function recalcTotalFromSelection() {
    let totalTestCost = 0;
    let totalPackageCost = 0;

    document.querySelectorAll(`#testList input[type='checkbox']:checked`).forEach(chk => {
        totalTestCost += parseFloat(chk.value.split("|")[1]) || 0;
    });

    document.querySelectorAll(`#packageList input[type='checkbox']:checked`).forEach(chk => {
        totalPackageCost += parseFloat(chk.value.split("|")[1]) || 0;
    });

    let totalAmount = totalTestCost + totalPackageCost;
    document.getElementById("totalAmount").value = totalAmount.toFixed(2);

    let discountPercent = parseFloat(document.getElementById("discountList").value) || 0;
    let techCharge = parseFloat(document.getElementById("techCharge").value) || 0;

    let discounted = (totalAmount - totalPackageCost) * (1 - discountPercent / 100);
    let totalPayable = discounted + totalPackageCost + techCharge;

    document.getElementById("totalToPay").value = totalPayable.toFixed(2);
}

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

function updateStatus(bookingId, status) {
    fetch(`${API_URL}?action=updateBookingStatus&bookingId=${encodeURIComponent(bookingId)}&status=${encodeURIComponent(status)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`Booking marked as ${status}`);
                searchCustomer();
            } else {
                alert("Failed to update status");
            }
        });
}

function editBooking(bookingId) {
  console.log("🔹 editBooking called with ID:", bookingId);  // check if button sends ID

  fetch(`${API_URL}?action=getBookingDetails&bookingId=${encodeURIComponent(bookingId)}`)
    .then(res => res.json())
    .then(data => {
      console.log("🔹 Booking details response:", data);  // check if backend sends details

      if (!data || !data.bookingId) {
        alert("Booking not found!");
        return;
      }

      // ✅ Fill form fields
      document.getElementById("custNumber").value = data.customerNumber || "";
      document.getElementById("custName").value = data.mainCustomerName || "";
      document.getElementById("dob").value = data.dob || "";
      document.getElementById("age").value = data.age || "";
      document.getElementById("gender").value = data.gender || "";
      document.getElementById("address").value = data.address || "";
      document.getElementById("location").value = data.location || "";
      document.getElementById("city").value = data.city || "";
      document.getElementById("pincode").value = data.pincode || "";
      document.getElementById("phleboList").value = data.phleboName || "";
      document.getElementById("prefDate").value = data.preferredDate || "";
      document.getElementById("prefTime").value = data.preferredTime || "";
      document.getElementById("totalAmount").value = data.totalAmount || 0;
      document.getElementById("discountList").value = data.discount || 0;
      document.getElementById("techCharge").value = data.techCharge || 0;
      document.getElementById("totalToPay").value = data.totalToPay || 0;

      // ✅ Switch buttons
      document.getElementById("submitBtn").style.display = "none";
      document.getElementById("updateBtn").style.display = "inline-block";

      // ✅ Show form
      document.getElementById("bookingForm").style.display = "block";
    })
    .catch(err => {
      console.error("Error fetching booking details:", err);
      alert("Error loading booking details");
    });
}


function updateBookingFromForm() {
  const bookingId = document.getElementById("updateBtn").getAttribute("data-booking-id");
  if (!bookingId) {
    alert("No booking selected for update!");
    return;
  }

  const params = {
    action: "updateBooking",
    bookingId: bookingId,
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
    agentName: localStorage.getItem("agentName") || ""
  };

  const query = new URLSearchParams(params).toString();

  fetch(`${API_URL}?${query}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("Booking updated successfully!");
        document.getElementById("submitBtn").style.display = "inline-block";
        document.getElementById("updateBtn").style.display = "none";
        searchCustomer(); // refresh table
      } else {
        alert("Update failed!");
      }
    })
    .catch(err => {
      console.error("Error updating booking:", err);
      alert("Error updating booking!");
    });
}


function addSubBooking() {
    document.querySelectorAll("#bookingForm input, #bookingForm select, #bookingForm textarea")
        .forEach(el => {
            if (el.type === "hidden") return;
            if (el.tagName.toLowerCase() === "select") {
                el.selectedIndex = 0;
            } else {
                el.value = "";
            }
            el.removeAttribute("readonly");
            el.removeAttribute("disabled");
        });

    document.getElementById("selectedTestsBody").innerHTML = "";
    document.getElementById("selectedPackagesBody").innerHTML = "";
    document.getElementById("totalAmount").value = "";
    document.getElementById("techCharge").value = "";
    document.getElementById("totalToPay").value = "";
    document.getElementById("discountList").value = "0";

    // ✅ If main booking exists → lock fields
    if (mainBookingData) {
        document.getElementById("custNumber").value = mainBookingData.custNumber;
document.getElementById("custNumber").readOnly = true;

        document.getElementById("phleboList").value = mainBookingData.phlebo;
        document.getElementById("phleboList").disabled = true;

        document.getElementById("prefDate").value = mainBookingData.prefDate;
        document.getElementById("prefDate").readOnly = true;

        document.getElementById("prefTime").value = mainBookingData.prefTime;
        document.getElementById("prefTime").readOnly = true;

        document.getElementById("address").value = mainBookingData.address;
        document.getElementById("address").readOnly = true;

        document.getElementById("location").value = mainBookingData.location;
        document.getElementById("location").readOnly = true;

        document.getElementById("pincode").value = mainBookingData.pincode;
        document.getElementById("pincode").readOnly = true;

        document.getElementById("city").value = mainBookingData.city;
        document.getElementById("city").disabled = true;
    }

    document.getElementById("bookingForm").style.display = "block";
    document.getElementById("addMoreBtn").style.display = "inline-block";
}

function showBookingForm() {
    let custNumber = document.getElementById("custNumber").value.trim();

    // Debug log (remove after testing)
    console.log("custNumber:", custNumber, "length:", custNumber.length);

    if (!/^\d{10}$/.test(custNumber)) {
        alert("Enter a valid 10-digit Customer Number");
        return;
    }

    // ✅ Passed validation → show booking form
    document.getElementById("bookingForm").style.display = "block";
}
function confirmBooking() {
    if (bookingList.length === 0) {
        alert("No bookings to confirm!");
        return;
    }

    // ✅ Take customer number from the form
    const customerNumber = document.getElementById("custNumber").value.trim();

    if (!/^\d{10}$/.test(customerNumber)) {
        alert("Missing or invalid customer number!");
        return;
    }

    // 🔹 Call backend
    fetch(`${API_URL}?action=confirmBooking&customerNumber=${encodeURIComponent(customerNumber)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("All bookings confirmed successfully!");

                // ✅ Clear both search + form numbers
                document.getElementById("searchCustNumber").value = "";
                document.getElementById("custNumber").value = "";

                // ✅ Hide Add More + Confirm buttons
                document.getElementById("addMoreBtn").style.display = "none";
                document.getElementById("confirmBtn").style.display = "none";

                // ✅ Clear booking preview
                document.getElementById("mainBookingPreviewBody").innerHTML = "";
                document.getElementById("mainBookingPreview").style.display = "none";

                // ✅ Hide booking form
                document.getElementById("bookingForm").style.display = "none";

                // ✅ Reset booking state
                bookingList = [];
                subBookingCounter = 0;
                mainBookingData = null;

                // ✅ Reset button back to Main Booking mode
                const createBtn = document.getElementById("createBookingBtn");
                if (createBtn) {
                    createBtn.textContent = "Create Booking";
                    createBtn.onclick = showBookingForm;
                }

                // ✅ Unfreeze all fields for fresh Main Booking
                ["custNumber","address","location","city","phleboList","pincode","prefDate","prefTime"].forEach(id => {
                    let el = document.getElementById(id);
                    if (!el) return;
                    el.readOnly = false;
                    el.disabled = false;
                    el.style.backgroundColor = ""; // reset styling
                });

            } else {
                alert("Failed to confirm bookings");
            }
        })
        .catch(err => {
            console.error("Confirm booking error:", err);
            alert("Error confirming bookings. Please try again.");
        });
}
function showHeaderInfo(agentName) {
    document.getElementById("agentNameLabel").textContent = "Agent: " + agentName;

    const now = new Date();
    const dateTimeString = now.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    document.getElementById("dateTimeLabel").textContent = dateTimeString;
}

window.onload = function () {
    // Existing code for prefDate & phleboList…
    let prefDate = document.getElementById("prefDate");
    if (prefDate) {
        let today = new Date().toISOString().split("T")[0];
        prefDate.min = today;
    }
    if (document.getElementById("phleboList")) loadPhlebos();

    // ✅ NEW: Show agent info
   const agent = localStorage.getItem("agentName") || "Unknown";
    showHeaderInfo(agent);
};
