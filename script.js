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

/** Agent Login **/
function agentLogin() {
  const user = document.getElementById("agentUser").value.trim();
  const pass = document.getElementById("agentPass").value.trim();

  fetch(`${API_URL}?action=login&role=Agent&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem("agentName", data.agentName || user);
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
  const custNumber = document.getElementById("custNumber").value.trim();

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

  // ✅ Decide booking type *before* request
  const isMain = (bookingList.length === 0);
  const nextSubIndex = subBookingCounter + 1;
  const bookingTypeValue = isMain ? "Main" : `Sub ${nextSubIndex}`;

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
    bookingType: bookingTypeValue
  };

  const query = new URLSearchParams(params).toString();
  fetch(`${API_URL}?${query}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return alert("Booking failed");

      // ✅ Always capture backend’s ID (or fallback to generated one)
      const realId = data.bookingId || newBookingId;

      // UI label + freeze rules
      let label;
      if (isMain) {
        label = "Main Booking";
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
        subBookingCounter = nextSubIndex;
        label = `Sub Booking ${subBookingCounter}`;
      }

      // ✅ Store in bookingList with guaranteed ID
      bookingList.push({
        id: realId,
        type: label,
        name: params.mainCustomerName,
        datetime: `${params.preferredDate} ${params.preferredTime}`,
        cost: parseFloat(params.totalToPay) || 0,

        // full payload (not strictly needed if we always use backend editBooking)
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

      console.log("✅ Booking saved. Server ID:", realId, "Type:", data.bookingType || bookingTypeValue);
    })
    .catch(err => {
      console.error("Booking save error:", err);
      alert("Booking failed, please try again");
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
  editBooking(id);
});



function handlePendingEditClick(id) {
  // ✅ First, try to find this booking in local pending list
  const pending = bookingList.find(x => x.id === id);
  if (pending) {
    populateFormFromBooking(pending);   // fill form from local data
    return;
  }

  // ❌ Not found locally? → Fetch from backend (for already saved bookings)
  editBooking(id);
}

function populateFormFromBooking(b) {
  // tiny helper to safely set values
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  // Basic info
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

  // ✅ Clear all current selections first
  document.querySelectorAll('#testList input[type="checkbox"]').forEach(chk => chk.checked = false);
  document.querySelectorAll('#packageList input[type="checkbox"]').forEach(chk => chk.checked = false);

  // ✅ Restore Tests
  (b.tests || "").split(",").filter(Boolean).forEach(code => {
    const chk = [...document.querySelectorAll('#testList input[type="checkbox"]')]
      .find(c => c.value.split("|")[0] === code);
    if (chk) chk.checked = true;
  });

  // ✅ Restore Packages
  (b.packages || "").split(",").filter(Boolean).forEach(code => {
    const chk = [...document.querySelectorAll('#packageList input[type="checkbox"]')]
      .find(c => c.value.split("|")[0] === code);
    if (chk) chk.checked = true;
  });

  // ✅ Switch to update mode
  const updateBtn = document.getElementById("updateBtn");
  if (updateBtn) updateBtn.setAttribute("data-booking-id", b.id);

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.style.display = "none";
  if (updateBtn) updateBtn.style.display = "inline-block";

  // ✅ Show the booking form
  document.getElementById("bookingForm").style.display = "block";

  // ✅ Recalculate totals after restoring selections
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
  // Show the correct buttons after main booking is saved (and while adding subs)
const createBtn = document.getElementById("createBookingBtn");
if (createBtn) createBtn.style.display = "none";

const submitBtn = document.getElementById("submitBtn");
if (submitBtn) submitBtn.style.display = "inline-block";

const addMoreBtn = document.getElementById("addMoreBtn");
if (addMoreBtn) addMoreBtn.style.display = "inline-block";

const confirmBtn = document.getElementById("confirmBtn");
if (confirmBtn) confirmBtn.style.display = "inline-block";

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
        <div style="font-weight:600">${b.name || "-"}</div>
        <div style="font-size:12px;color:#666;">
          ${b.type || ("Booking " + (idx+1))}
        </div>
        <div>
          <a href="#" onclick="editBooking('${b.id}')" 
             style="font-size:12px;color:#007bff;text-decoration:underline;">
            ✏️ Edit
          </a>
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
  // Min date for prefDate
  let prefDate = document.getElementById("prefDate");
  if (prefDate) {
    let today = new Date().toISOString().split("T")[0];
    prefDate.min = today;
  }
  if (document.getElementById("phleboList")) loadPhlebos();

  // ✅ Show agent info (if header exists on this page)
  const agent = localStorage.getItem("agentName") || "Unknown";
  showHeaderInfo(agent);

  // Hide these by default on first load
  ["addMoreBtn", "confirmBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}; // <-- CLOSE the onload function here. Nothing below is inside onload.

/* Make functions available to inline HTML onclicks (login pages, buttons, etc.) */
window.adminLogin = adminLogin;
window.agentLogin = agentLogin;
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

// Optional tiny sanity check:
console.log("script.js loaded and globals exported");
