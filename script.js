// ✅ Runs on any page (safe guards for missing elements)
window.addEventListener("DOMContentLoaded", function () {
  const agentLabel = document.getElementById("agentNameLabel");
  if (agentLabel) {
    const agentName = localStorage.getItem("agentName") || "Unknown Agent";
    agentLabel.innerText = "Agent: " + agentName;
  }

  const dateTimeLabel = document.getElementById("dateTimeLabel");
  if (dateTimeLabel) {
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
      dateTimeLabel.innerText = formatted;
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
  }
});

// 🔹 GAS Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbw4sBOSu5WL_Cep7M1B9qYgfvBSQ0iuuCfbrRQDG6y4qPl6fJfap-4LLaX_wMqvg3ZV8A/exec";

/** Reset daily data (runs at midnight or first load of new day) */
function resetDailyData() {
  const today = new Date().toISOString().split("T")[0];
  const lastReset = localStorage.getItem("lastResetDate");

  if (lastReset !== today) {
    Object.keys(localStorage).forEach(key => {
      if (
        key.startsWith("firstLogin_") ||
        key.startsWith("lastLogout_") ||
        key.startsWith("breakStart_") ||
        key.startsWith("breakTotal_")
      ) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem("lastResetDate", today);
  }
}


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
      } else {
        alert(data.message || "Login failed");
      }
    });
}


function agentLogin() {
  const user = document.getElementById("agentUser").value.trim();
  const pass = document.getElementById("agentPass").value.trim();

  fetch(`${API_URL}?action=login&role=Agent&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const agentName = data.agentName || user;
        localStorage.setItem("agentName", agentName);
        localStorage.setItem("role", "Agent");

        const today = new Date().toISOString().split("T")[0];
        const firstKey = "firstLogin_" + agentName + "_" + today;

        // ✅ Capture locally (for header panel)
        if (!localStorage.getItem(firstKey)) {
          localStorage.setItem(firstKey, new Date().toLocaleTimeString());
        }

        // ✅ Tell backend to record first login in Agent Dashboard sheet
        fetch(`${API_URL}?action=recordFirstLogin&agent=${encodeURIComponent(agentName)}`);

        // Redirect
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


function logout() {
  const agentName = localStorage.getItem("agentName");
  const today = new Date().toISOString().split("T")[0];
  const lastKey  = "lastLogout_" + agentName + "_" + today;
  const breakTotalKey = "breakTotal_" + agentName + "_" + today;

  const now = new Date().toLocaleTimeString();
  localStorage.setItem(lastKey, now);

  const breakMs = parseInt(localStorage.getItem(breakTotalKey) || "0", 10);
  const breakMins = Math.floor(breakMs / (1000 * 60));

  fetch(`${API_URL}?action=recordLastLogout&agent=${encodeURIComponent(agentName)}&breakHours=${breakMins}`);
  
  window.location.href = "agent-login.html";
}




function startBreak(agentName) {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem("breakStart_" + agentName + "_" + today, new Date().getTime());
}

function endBreak(agentName) {
  const today = new Date().toISOString().split("T")[0];
  const start = parseInt(localStorage.getItem("breakStart_" + agentName + "_" + today) || "0", 10);
  if (start) {
    const diff = new Date().getTime() - start;
    const key = "breakTotal_" + agentName + "_" + today;
    let total = parseInt(localStorage.getItem(key) || "0", 10);
    total += diff;
    localStorage.setItem(key, total);
    localStorage.removeItem("breakStart_" + agentName + "_" + today);
  }
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
      if (!sel) return;
      sel.innerHTML = `<option value="">--Select Phlebo--</option>`;
      phlebos.forEach(p => {
        const name = (typeof p === "string") ? p : (p && p.name) ? p.name : "";
        if (!name) return;
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
  const bookingId = document.getElementById("bookingId") ? document.getElementById("bookingId").value : "";

  if (!phlebo || !date || !time) return;

  // ✅ Add this log
  console.log("CHECK SLOT (frontend):", { phlebo, date, time, bookingId });

  fetch(`${API_URL}?action=checkAvailability&phlebo=${encodeURIComponent(phlebo)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&bookingId=${encodeURIComponent(bookingId)}`)
    .then(res => res.json())
    .then(data => {
      console.log("CHECK SLOT (backend response):", data); // ✅ log backend response
      if (!data.available) {
        alert("Preferred time not available for this technician. Please choose another time.");
        document.getElementById("prefTime").value = "";
      }
    });
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
  if (!/^\d{10}$/.test(custNumber)) return alert("Enter valid 10-digit customer number");
  if (!document.getElementById("custName").value.trim()) return alert("Enter customer name");
  if (!document.getElementById("age").value) return alert("Enter age");
  if (!document.getElementById("gender").value) return alert("Select gender");
  if (!document.getElementById("address").value.trim()) return alert("Enter address");
  if (!document.getElementById("location").value.trim()) return alert("Enter location");
  if (!document.getElementById("city").value) return alert("Select city");
  if (!document.getElementById("phleboList").value) return alert("Select phlebo");
  if (!document.getElementById("prefDate").value) return alert("Select preferred date");
  if (!document.getElementById("prefTime").value) return alert("Select preferred time");

  const newBookingId = "BKG_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  const params = {
    action: "saveBooking",
    bookingId: newBookingId,
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
    bookingType: (bookingList.length === 0) ? "Main" : "Sub"
  };

  const query = new URLSearchParams(params).toString();
  fetch(`${API_URL}?${query}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return alert("Booking failed");

      // Use real backend ID if provided, fall back to our generated one
      const realId = data.bookingId || newBookingId;

      let label;
      if (bookingList.length === 0) {
        label = "Main Booking";
        // Save main booking values (for sub-booking locks)
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

      // Save EVERYTHING so we can reopen locally if needed
      bookingList.push({
        id: realId,
        type: label,
        name: params.mainCustomerName,
        datetime: `${params.preferredDate} ${params.preferredTime}`,
        cost: parseFloat(params.totalToPay) || 0,

        // full payload for local edit
        customerNumber: params.customerNumber,
        dob: params.dob,
        age: params.age,
        gender: params.gender,
        address: params.address,
        location: params.location,
        city: params.city,
        pincode: params.pincode,
        phleboName: params.phleboName,
        preferredDate: params.preferredDate,
        preferredTime: params.preferredTime,
        tests: params.tests,
        packages: params.packages,
        totalAmount: params.totalAmount,
        discount: params.discount,
        techCharge: params.techCharge,
        totalToPay: params.totalToPay
      });

      renderBookingTable();
      renderPendingSummary();
      document.getElementById("addMoreBtn").style.display = "inline-block";
      addSubBooking();
    });
}


function renderBookingTable() {
  const body = document.getElementById("mainBookingPreviewBody");
  body.innerHTML = "";

  bookingList.forEach(b => {
    const costNum = Number(b.cost) || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="#" class="pending-edit" data-id="${b.id || ''}">${b.type}: ${b.name}</a></td>
      <td>${b.datetime}</td>
      <td>₹${costNum.toFixed(2)}</td>
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
    startDate: document.getElementById("prefStartDate").value,   // Preferred date range
    endDate: document.getElementById("prefEndDate").value,
    createdStart: document.getElementById("createdStartDate").value, // Created date range
    createdEnd: document.getElementById("createdEndDate").value,
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
          <td>${r.phleboName}</td>
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
  fetch(`${API_URL}?action=getBookingDetails&bookingId=${bookingId}`)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.bookingId) {
        alert("Booking not found!");
        return;
      }

      // Fill form with existing booking data
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

      // ✅ Restore Tests
      if (data.tests) {
        const testCodes = data.tests.split(",");
        document.querySelectorAll("#testList input[type='checkbox']").forEach(chk => {
          const code = chk.value.split("|")[0];
          if (testCodes.includes(code)) {
            chk.checked = true;
          }
        });
      }

      // ✅ Restore Packages
      if (data.packages) {
        const packageCodes = data.packages.split(",");
        document.querySelectorAll("#packageList input[type='checkbox']").forEach(chk => {
          const code = chk.value.split("|")[0];
          if (packageCodes.includes(code)) {
            chk.checked = true;
          }
        });
      }

      // ✅ Recalculate totals after restoring selections
      recalcTotalFromSelection();

      // Store bookingId for update
      document.getElementById("updateBtn").setAttribute("data-booking-id", bookingId);

      // Switch buttons
      document.getElementById("submitBtn").style.display = "none";
      document.getElementById("updateBtn").style.display = "inline-block";

      // Show form
      document.getElementById("bookingForm").style.display = "block";
    })
    .catch(err => {
      console.error("Error fetching booking details:", err);
      alert("Error fetching booking details!");
    });
}

// Make any <a class="pending-edit" data-id="..."> act like the Edit button
document.addEventListener('click', function (ev) {
  const a = ev.target.closest('a.pending-edit');
  if (!a) return;
  ev.preventDefault();
  const id = a.dataset.id;
  if (!id) return;
  handlePendingEditClick(id);   // 👈 instead of editBooking(id)
});


function handlePendingEditClick(id) {
  // Try local (pending) list first
  const pending = bookingList.find(x => x.id === id);
  if (pending) {
    populateFormFromBooking(pending);
    return;
  }
  // Not found locally? Use backend (works for history table items)
  editBooking(id);
}

function populateFormFromBooking(b) {
  // tiny helper
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };

  setVal("custNumber", b.customerNumber || mainBookingData?.custNumber || "");
  setVal("custName", b.name || "");
  setVal("dob", b.dob || "");
  setVal("age", b.age || "");
  setVal("gender", b.gender || "");
  setVal("address", b.address || mainBookingData?.address || "");
  setVal("location", b.location || mainBookingData?.location || "");
  setVal("city", b.city || mainBookingData?.city || "");
  setVal("pincode", b.pincode || mainBookingData?.pincode || "");
  setVal("phleboList", b.phleboName || mainBookingData?.phlebo || "");
  setVal("prefDate", b.preferredDate || mainBookingData?.prefDate || "");
  setVal("prefTime", b.preferredTime || mainBookingData?.prefTime || "");
  setVal("totalAmount", b.totalAmount || "");
  setVal("discountList", b.discount || "0");
  setVal("techCharge", b.techCharge || "");
  setVal("totalToPay", b.totalToPay || b.cost || "");

  // Restore tests
  document.querySelectorAll('#testList input[type="checkbox"]').forEach(chk => chk.checked = false);
  (b.tests || "").split(",").filter(Boolean).forEach(code => {
    const chk = [...document.querySelectorAll('#testList input[type="checkbox"]')]
      .find(c => c.value.split("|")[0] === code);
    if (chk) chk.checked = true;
  });

  // Restore packages
  document.querySelectorAll('#packageList input[type="checkbox"]').forEach(chk => chk.checked = false);
  (b.packages || "").split(",").filter(Boolean).forEach(code => {
    const chk = [...document.querySelectorAll('#packageList input[type="checkbox"]')]
      .find(c => c.value.split("|")[0] === code);
    if (chk) chk.checked = true;
  });

  // Store bookingId for update, switch buttons, show form
  const updateBtn = document.getElementById("updateBtn");
  if (updateBtn) updateBtn.setAttribute("data-booking-id", b.id);
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.style.display = "none";
  if (updateBtn) updateBtn.style.display = "inline-block";

  document.getElementById("bookingForm").style.display = "block";

  // Refresh totals after restoring selections
  recalcTotalFromSelection();
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

  const custEl = document.getElementById("custNumber");
  const customerNumber = custEl ? custEl.value.trim() : "";
  if (!/^\d{10}$/.test(customerNumber)) {
    alert("Missing or invalid customer number!");
    return;
  }

  fetch(`${API_URL}?action=confirmBooking&customerNumber=${encodeURIComponent(customerNumber)}`)
    .then(res => res.json())
    .then(data => {
      if (!data || data.success !== true) {
        alert("Failed to confirm bookings");
        return;
      }

      alert("All bookings confirmed successfully!");

      // Clear search + form numbers
      const search = document.getElementById("searchCustNumber");
      if (search) search.value = "";
      const cust = document.getElementById("custNumber");
      if (cust) { cust.value = ""; cust.readOnly = false; }

      // Hide action buttons
      ["addMoreBtn","confirmBtn","submitBtn","updateBtn"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });

      // Clear preview + hide form
      const tb = document.getElementById("mainBookingPreviewBody");
      if (tb) tb.innerHTML = "";
      const prev = document.getElementById("mainBookingPreview");
      if (prev) prev.style.display = "none";
      const form = document.getElementById("bookingForm");
      if (form) form.style.display = "none";

      // Clear left summary
      const sumWrap = document.getElementById("bookingSummary");
      const sumBody = document.getElementById("bookingSummaryBody");
      const sumGrand = document.getElementById("bookingSummaryGrand");
      if (sumWrap && sumBody && sumGrand) {
        sumBody.innerHTML = "";
        sumGrand.textContent = "0.00";
        sumWrap.style.display = "none";
      }

      // Clear amount/grand total fields if present
      ["totalAmount","techCharge","totalToPay","grandTotalToPay"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      // Hide/clear ANY pending summary regardless of id/class naming
      document.querySelectorAll('#pendingSummaryWrap, #pendingSummaryBody, #pendingList, #pendingBookings, .pending-summary, [id*="pendingSummary"], [id*="pendingBookings"]').forEach(el => {
        if ("innerHTML" in el) el.innerHTML = "";
        el.style.display = "none";
      });

      // Hide history section
      const hist = document.getElementById("history");
      if (hist) hist.style.display = "none";

      // Reset state
      bookingList = [];
      subBookingCounter = 0;
      mainBookingData = null;

      // Reset Create Booking button
      const createBtn = document.getElementById("createBookingBtn");
      if (createBtn) {
        createBtn.textContent = "Create Booking";
        createBtn.onclick = showBookingForm;
      }

      // Un-freeze any fields for next fresh main booking
      ["custNumber","address","location","city","phleboList","pincode","prefDate","prefTime"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.readOnly = false; el.disabled = false; el.style.backgroundColor = ""; }
      });

      // Scroll back to search + disable Create until a valid number is typed
      if (search) {
        const create = document.getElementById("createBookingBtn");
        if (create) create.disabled = true;
        search.scrollIntoView({ behavior: "smooth", block: "start" });
        search.focus();
      }

      // If you want a guaranteed clean UI state, you can do:
      // window.location.replace('booking.html');
    })
    .catch(err => {
      console.error("Confirm booking error:", err);
      alert("Error confirming bookings. Please try again.");
    });
}

function showHeaderInfo(agentName) {
  const agentLabel = document.getElementById("agentNameLabel");
  if (agentLabel) agentLabel.textContent = "Agent: " + agentName;

  const dt = document.getElementById("dateTimeLabel");
  if (dt) {
    const now = new Date();
    const dateTimeString = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    dt.textContent = dateTimeString;
  }
}

function renderPendingSummary() {
  const wrap = document.getElementById("bookingSummary");
  const body = document.getElementById("bookingSummaryBody");
  const grandEl = document.getElementById("bookingSummaryGrand");
  if (!wrap || !body || !grandEl) return;

  body.innerHTML = "";
  let grand = 0;

  bookingList.forEach((b, idx) => {
    const costNum = parseFloat(b.cost) || 0;
    grand += costNum;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:600">
          <a href="#" onclick="editBooking('${b.id}')">${b.name || "-"}</a>
        </div>
        <div style="font-size:12px;color:#666;">
          ${b.type || ("Booking " + (idx+1))}
        </div>
      </td>
      <td>₹${costNum.toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });

  grandEl.textContent = grand.toFixed(2);
  wrap.style.display = bookingList.length ? "block" : "none";
}


window.onload = function () {
  const agentName = localStorage.getItem("agentName") || "Unknown";
  const today = new Date().toISOString().split("T")[0];

  const firstKey = "firstLogin_" + agentName + "_" + today;
  const lastKey  = "lastLogout_" + agentName + "_" + today;
  const breakStartKey = "breakStart_" + agentName + "_" + today;
  const breakTotalKey = "breakTotal_" + agentName + "_" + today;

  // First login (store once + backend sync)
  if (!localStorage.getItem(firstKey)) {
    const now = new Date().toLocaleTimeString();
    localStorage.setItem(firstKey, now);
    fetch(`${API_URL}?action=recordFirstLogin&agent=${encodeURIComponent(agentName)}`);
  }

  function updatePanel() {
    const firstLogin = localStorage.getItem(firstKey) || "-";
    const lastLogout = localStorage.getItem(lastKey) || "-";
    const breakMs = parseInt(localStorage.getItem(breakTotalKey) || "0", 10);

    // First & Last
    document.getElementById("firstLoginTime").value = firstLogin;
    document.getElementById("lastLogoutTime").value = lastLogout;

    // Break hours
    let breakHrs = Math.floor(breakMs / (1000 * 60 * 60));
    let breakMins = Math.floor((breakMs % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById("breakHours").value = `${breakHrs}h ${breakMins}m`;

    // Total login hours
    if (firstLogin !== "-") {
      const now = new Date();
      const loginDate = new Date(today + " " + firstLogin);
      let diffMs = now - loginDate;
      let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      document.getElementById("loggedinHours").value = `${diffHrs}h ${diffMins}m`;

      // Production = Login – Break
      let prodHrs = diffHrs - breakHrs;
      let prodMins = diffMins - breakMins;
      if (prodMins < 0) { prodHrs -= 1; prodMins += 60; }
      document.getElementById("productionHours").value = `${Math.max(prodHrs,0)}h ${Math.max(prodMins,0)}m`;
    }
  }

  updatePanel();
  setInterval(updatePanel, 60000); // refresh every 1 min
};





/* Make functions available to inline HTML onclicks (especially on login page) */
window.agentLogin = agentLogin;
window.adminLogin = adminLogin;
window.showBookingForm = showBookingForm;
window.createBooking = createBooking;
window.addSubBooking = addSubBooking;
window.confirmBooking = confirmBooking;
window.updateBookingFromForm = updateBookingFromForm;
window.searchCustomer = searchCustomer;
window.updateStatus = updateStatus;
window.editBooking = editBooking;
window.filterTests = filterTests;
window.filterPackages = filterPackages;
