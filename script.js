
function goBack() { history.back(); }
function goHome() { window.location.href = 'index.html'; }

function adminLogin() {
    let user = document.getElementById("adminUser").value;
    let pass = document.getElementById("adminPass").value;
    alert("Admin login check for: " + user);
    window.location.href = "admin-dashboard.html";
}

function agentLogin() {
    let user = document.getElementById("agentUser").value;
    let pass = document.getElementById("agentPass").value;
    alert("Agent login check for: " + user);
    window.location.href = "booking.html";
}

function saveUser() {
    alert("User details will be saved to Google Sheet.");
}

function saveTest() {
    alert("Test details will be saved to Google Sheet.");
}

function savePackage() {
    alert("Package details will be saved to Google Sheet.");
}

function createBooking() {
    alert("Booking will be saved to Google Sheet.");
}

function filterReport() {
    alert("Report will be fetched from Google Sheet.");
}
