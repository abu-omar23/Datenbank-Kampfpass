const DATA_PATH = "data.json";

let students = [];
let currentFileSha = null;

const form = document.getElementById("studentForm");
const studentsList = document.getElementById("studentsList");
const searchInput = document.getElementById("searchInput");
const statusText = document.getElementById("statusText");

const settingsDialog = document.getElementById("settingsDialog");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const tokenInput = document.getElementById("tokenInput");

function getSettings() {
  return {
    owner: localStorage.getItem("github_owner") || "",
    repo: localStorage.getItem("github_repo") || "",
    branch: localStorage.getItem("github_branch") || "main",
    token: localStorage.getItem("github_token") || ""
  };
}

function loadSettingsIntoInputs() {
  const s = getSettings();
  ownerInput.value = s.owner;
  repoInput.value = s.repo;
  branchInput.value = s.branch;
  tokenInput.value = s.token;
}

function saveSettings() {
  localStorage.setItem("github_owner", ownerInput.value.trim());
  localStorage.setItem("github_repo", repoInput.value.trim());
  localStorage.setItem("github_branch", branchInput.value.trim() || "main");
  localStorage.setItem("github_token", tokenInput.value.trim());
  alert("Einstellungen gespeichert.");
}

function githubUrl() {
  const { owner, repo } = getSettings();
  return `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_PATH}`;
}

function assertSettings() {
  const s = getSettings();
  if (!s.owner || !s.repo || !s.branch || !s.token) {
    throw new Error("Bitte zuerst GitHub Einstellungen ausfüllen.");
  }
  return s;
}

function encodeBase64Unicode(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64Unicode(value) {
  return decodeURIComponent(escape(atob(value.replace(/\n/g, ""))));
}

async function loadStudents() {
  const { branch, token } = assertSettings();

  statusText.textContent = "Lade Daten von GitHub ...";

  const response = await fetch(`${githubUrl()}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    throw new Error("Daten konnten nicht geladen werden. Prüfe Benutzername, Repo, Branch, Token und data.json.");
  }

  const file = await response.json();
  currentFileSha = file.sha;

  const text = decodeBase64Unicode(file.content);
  students = JSON.parse(text || "[]");

  renderStudents();
  statusText.textContent = `${students.length} Schüler geladen`;
}

async function saveStudentsToGitHub() {
  const { branch, token } = assertSettings();

  if (!currentFileSha) {
    await loadStudents();
  }

  const content = JSON.stringify(students, null, 2);

  const response = await fetch(githubUrl(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Schülerdaten aktualisiert",
      content: encodeBase64Unicode(content),
      sha: currentFileSha,
      branch
    })
  });

  if (!response.ok) {
    throw new Error("Speichern fehlgeschlagen. Prüfe deinen Token und Repo-Rechte.");
  }

  const result = await response.json();
  currentFileSha = result.content.sha;
  statusText.textContent = "Daten gespeichert";
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function getFormData() {
  return {
    id: document.getElementById("studentId").value || makeId(),
    name: document.getElementById("name").value.trim(),
    birthday: document.getElementById("birthday").value,
    belt: document.getElementById("belt").value,
    examDate: document.getElementById("examDate").value,
    notes: document.getElementById("notes").value.trim(),
    updatedAt: new Date().toISOString()
  };
}

function fillForm(student) {
  document.getElementById("studentId").value = student.id;
  document.getElementById("name").value = student.name || "";
  document.getElementById("birthday").value = student.birthday || "";
  document.getElementById("belt").value = student.belt || "";
  document.getElementById("examDate").value = student.examDate || "";
  document.getElementById("notes").value = student.notes || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  document.getElementById("studentId").value = "";
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString + "T00:00:00").toLocaleDateString("de-DE");
}

function getAge(birthday) {
  if (!birthday) return "-";
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} Jahre`;
}

function renderStudents() {
  const query = searchInput.value.toLowerCase().trim();

  const filtered = students
    .filter(s => {
      return !query ||
        (s.name || "").toLowerCase().includes(query) ||
        (s.belt || "").toLowerCase().includes(query);
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  if (filtered.length === 0) {
    studentsList.innerHTML = `<div class="empty">Keine Schüler gefunden.</div>`;
    return;
  }

  studentsList.innerHTML = filtered.map(student => `
    <article class="student-card">
      <div class="student-top">
        <div>
          <h3>${escapeHtml(student.name)}</h3>
          <strong>${escapeHtml(student.belt || "-")}</strong>
        </div>
      </div>

      <div class="student-meta">
        <div><strong>Geburtstag:</strong><br>${formatDate(student.birthday)}</div>
        <div><strong>Alter:</strong><br>${getAge(student.birthday)}</div>
        <div><strong>Letzte Prüfung:</strong><br>${formatDate(student.examDate)}</div>
        <div><strong>Aktualisiert:</strong><br>${student.updatedAt ? new Date(student.updatedAt).toLocaleString("de-DE") : "-"}</div>
      </div>

      ${student.notes ? `<div class="notes">${escapeHtml(student.notes)}</div>` : ""}

      <div class="actions">
        <button class="secondary-btn" onclick="editStudent('${student.id}')">Bearbeiten</button>
        <button class="danger-btn" onclick="deleteStudent('${student.id}')">Löschen</button>
      </div>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.editStudent = function(id) {
  const student = students.find(s => s.id === id);
  if (student) fillForm(student);
};

window.deleteStudent = async function(id) {
  if (!confirm("Diesen Schüler wirklich löschen?")) return;

  students = students.filter(s => s.id !== id);
  renderStudents();

  try {
    await saveStudentsToGitHub();
  } catch (error) {
    alert(error.message);
  }
};

form.addEventListener("submit", async event => {
  event.preventDefault();

  const student = getFormData();
  const existingIndex = students.findIndex(s => s.id === student.id);

  if (existingIndex >= 0) {
    students[existingIndex] = student;
  } else {
    students.push(student);
  }

  renderStudents();

  try {
    await saveStudentsToGitHub();
    resetForm();
  } catch (error) {
    alert(error.message);
  }
});

searchInput.addEventListener("input", renderStudents);

openSettingsBtn.addEventListener("click", () => {
  loadSettingsIntoInputs();
  settingsDialog.showModal();
});

saveSettingsBtn.addEventListener("click", saveSettings);
loadBtn.addEventListener("click", () => loadStudents().catch(error => alert(error.message)));
resetBtn.addEventListener("click", resetForm);

loadSettingsIntoInputs();

if (getSettings().owner && getSettings().repo && getSettings().token) {
  loadStudents().catch(() => {
    statusText.textContent = "Noch nicht geladen";
  });
}
