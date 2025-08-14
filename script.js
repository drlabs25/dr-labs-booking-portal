<script>
// ===== NAVIGATION =====
function goToPage(pageName) {
  const baseUrl = "https://script.google.com/macros/s/AKfycbyLXVqjq8B5qpoqNOIxaUK6W0JQeaUTHQJMhYlJEBrDDGRgSOn5_EAzlMNFtq1nxTlx9Q/exec";
  window.location.href = `${baseUrl}?page=${pageName}`;
}

function goBack() { window.history.back(); }
function goHome() { goToPage('index'); }

// ===== LOGIN =====
function adminLogin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value.trim();
  google.script.run.withSuccessHandler(function(result) {
    if (result.success && result.role === "Admin") {
      goToPage('admin-dashboard');
    } else {
      alert(result.message || "Invalid Admin Credentials");
    }
  }).loginUser(user, pass);
}

function agentLogin() {
  const user = document.getElementById('agentUser').value.trim();
  const pass = document.getElementById('agentPass').value.trim();
  google.script.run.withSuccessHandler(function(result) {
    if (result.success && result.role === "Agent") {
      sessionStorage.setItem('agentName', result.agentName);
      goToPage('agent-dashboard');
    } else {
      alert(result.message || "Invalid Agent Credentials");
    }
  }).loginUser(user, pass);
}

// ===== CREATE CREDENTIALS =====
function searchUser() {
  const empId = document.getElementById('searchInput').value.trim();
  google.script.run.withSuccessHandler(function(user) {
    const tableBody = document.getElementById('resultBody');
    tableBody.innerHTML = '';
    if (!user) { alert("No user found"); return; }
    tableBody.innerHTML = `<tr>
      <td>${user[0]}</td>
      <td>${user[3]}</td>
      <td>${user[5]}</td>
      <td><select><option>Active</option><option>Inactive</option></select></td>
    </tr>`;
  }).searchUserByEmpId(empId);
}

function saveUserForm() {
  const f = document.getElementById('userForm');
  const data = Array.from(f.elements).map(el => el.value);
  google.script.run.withSuccessHandler(msg => alert(msg))
    .saveUser(data[3], data[0], data[1], data[2], data[4], "Active");
}

// ===== REPORTS =====
function filterReport() {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const phlebo = document.getElementById('phleboName').value;
  const agent = document.getElementById('agentNameFilter').value;
  const loc = document.getElementById('locationFilter').value;
  google.script.run.withSuccessHandler(function(rows) {
    const tableBody = document.getElementById('reportBody');
    tableBody.innerHTML = '';
    rows.forEach(r => {
      tableBody.innerHTML += `<tr>
        <td>${r[0]}</td><td>${r[1]}</td>
        <td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td>
      </tr>`;
    });
  }).filterReportData(start, end, phlebo, agent, loc);
}
</script>

