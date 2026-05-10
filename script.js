const GURTE = [
  "Weiß",
  "Gelb",
  "Gelb-Orange",
  "Orange",
  "Orange-Grün",
  "Grün",
  "Grün-Blau",
  "Blau",
  "Blau-Braun",
  "Braun",
  "Braun-Schwarz",
  "Schwarz",
  "1. Dan",
  "2. Dan",
  "3. Dan",
  "4. Dan",
  "5. Dan",
  "6. Dan",
  "7. Dan",
  "8. Dan"
];

const studentsList = document.getElementById("studentsList");
const searchInput = document.getElementById("searchInput");
const beltFilter = document.getElementById("beltFilter");
const planningFilter = document.getElementById("planningFilter");
const statusText = document.getElementById("statusText") || document.getElementById("planningStatusText");

const studentModal = document.getElementById("studentModal");
const settingsModal = document.getElementById("settingsModal");
const planningModal = document.getElementById("planningModal");

const studentForm = document.getElementById("studentForm");
const studentModalTitle = document.getElementById("studentModalTitle");
const deleteStudentBtn = document.getElementById("deleteStudentBtn");

const detailsArea = document.getElementById("detailsArea");

const examFormArea = document.getElementById("examFormArea");
const examList = document.getElementById("examList");

const stampFormArea = document.getElementById("stampFormArea");
const stampList = document.getElementById("stampList");

const planningList = document.getElementById("planningList");
const planningTableBody = document.getElementById("planningTableBody");

let data = {
  students: []
};

let currentSha = null;
let currentStudentId = null;
let editingExamId = null;

function getSettings() {
  return {
    owner: localStorage.getItem("github_owner") || "",
    repo: localStorage.getItem("github_repo") || "",
    branch: localStorage.getItem("github_branch") || "main",
    token: localStorage.getItem("github_token") || ""
  };
}

function setStatus(text) {
  if (statusText) {
    statusText.textContent = text;
  }
}

function openSettings() {
  const settings = getSettings();

  document.getElementById("ownerInput").value = settings.owner;
  document.getElementById("repoInput").value = settings.repo;
  document.getElementById("branchInput").value = settings.branch;
  document.getElementById("tokenInput").value = settings.token;

  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

function saveSettings() {
  localStorage.setItem("github_owner", document.getElementById("ownerInput").value.trim());
  localStorage.setItem("github_repo", document.getElementById("repoInput").value.trim());
  localStorage.setItem("github_branch", document.getElementById("branchInput").value.trim() || "main");
  localStorage.setItem("github_token", document.getElementById("tokenInput").value.trim());

  closeSettings();
  loadStudents();
}

function githubFileUrl() {
  const settings = getSettings();
  return `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/data.json`;
}

function checkSettings() {
  const settings = getSettings();

  if (!settings.owner || !settings.repo || !settings.branch || !settings.token) {
    throw new Error("Bitte zuerst GitHub Verbindung eintragen.");
  }

  return settings;
}

function encodeBase64Unicode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Unicode(base64) {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ""))));
}

function normalizeData(loadedData) {
  if (!loadedData || typeof loadedData !== "object") {
    return { students: [] };
  }

  if (!Array.isArray(loadedData.students)) {
    loadedData.students = [];
  }

  loadedData.students = loadedData.students.map(student => {
    return {
      id: student.id || makeId(),
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      birthday: student.birthday || "",
      belt: student.belt || "Weiß",
      beltSize: student.beltSize || "",
      notes: student.notes || "",
      plannedExam: Boolean(student.plannedExam),
      planningPaidAmount: student.planningPaidAmount || "",
      planningRegistrationType: student.planningRegistrationType || "",
      planningPaymentMethod: student.planningPaymentMethod || "",
      planningTargetBelt: student.planningTargetBelt || "",
      annualStamps: Array.isArray(student.annualStamps)
        ? student.annualStamps
        : oldStampToArray(student),
      exams: Array.isArray(student.exams) ? student.exams : []
    };
  });

  return loadedData;
}

function oldStampToArray(student) {
  if (student.annualStampYear) {
    return [
      {
        year: String(student.annualStampYear),
        status: student.annualStamp || "nein"
      }
    ];
  }

  return [];
}

async function loadStudents() {
  try {
    const settings = getSettings();

    setStatus("Lade Schülerdaten...");

    // 1. Wenn GitHub-Daten vorhanden sind, über GitHub API laden.
    if (settings.owner && settings.repo && settings.branch && settings.token) {
      const response = await fetch(`${githubFileUrl()}?ref=${settings.branch}`, {
        headers: {
          Authorization: `Bearer ${settings.token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (!response.ok) {
        throw new Error("GitHub API konnte data.json nicht laden. Prüfe Benutzername, Repo, Branch und Token.");
      }

      const file = await response.json();
      currentSha = file.sha;

      const content = decodeBase64Unicode(file.content);
      data = normalizeData(JSON.parse(content));

      renderStudents();
      renderPlanningTable();

      setStatus(`Verbunden · ${data.students.length} Schüler geladen`);
      return;
    }

    // 2. Ohne Token: data.json normal von GitHub Pages / lokal laden.
    // Anzeigen funktioniert dadurch auch auf der Prüfungsplanungsseite.
    const response = await fetch("data.json?cache=" + Date.now());

    if (!response.ok) {
      throw new Error("data.json konnte nicht geladen werden.");
    }

    data = normalizeData(await response.json());

    renderStudents();
    renderPlanningTable();

    setStatus(`${data.students.length} Schüler geladen · Nur Lesen, kein GitHub Token gespeichert`);
  } catch (error) {
    setStatus(error.message);
    renderStudents();
    renderPlanningTable();
  }
}

async function saveStudents() {
  const settings = checkSettings();

  async function getLatestSha() {
    const response = await fetch(`${githubFileUrl()}?ref=${settings.branch}&cache=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${settings.token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      throw new Error("Aktuelle data.json konnte nicht geladen werden.");
    }

    const file = await response.json();
    currentSha = file.sha;
    return file.sha;
  }

  async function putFile(sha) {
    const content = JSON.stringify(data, null, 2);

    return fetch(githubFileUrl(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${settings.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Schülerdaten aktualisiert",
        content: encodeBase64Unicode(content),
        sha: sha,
        branch: settings.branch
      })
    });
  }

  // Immer zuerst den neuesten SHA holen, damit GitHub den Schreibvorgang akzeptiert.
  let sha = await getLatestSha();
  let response = await putFile(sha);

  // Falls GitHub trotzdem einen Versionskonflikt meldet, einmal automatisch neu versuchen.
  if (response.status === 409) {
    sha = await getLatestSha();
    response = await putFile(sha);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GitHub Speicherfehler:", errorText);
    throw new Error("Speichern fehlgeschlagen. Bitte GitHub Verbindung neu speichern und dann erneut versuchen.");
  }

  const result = await response.json();
  currentSha = result.content.sha;

  setStatus("Gespeichert");
  renderStudents();
  renderPlanningTable();
}


function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return String(Date.now()) + String(Math.floor(Math.random() * 100000));
}

function calculateAge(birthday) {
  if (!birthday) {
    return null;
  }

  const birthDate = new Date(birthday);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function getCurrentStudent() {
  return data.students.find(student => student.id === currentStudentId);
}

function openAddStudent() {
  currentStudentId = null;
  editingExamId = null;

  studentModalTitle.textContent = "Schüler hinzufügen";
  studentForm.reset();

  document.getElementById("studentId").value = "";
  document.getElementById("belt").value = "Weiß";
  document.getElementById("beltSize").value = "";
  document.getElementById("plannedExam").checked = false;

  deleteStudentBtn.classList.add("hidden");
  detailsArea.classList.add("hidden");
  examFormArea.classList.add("hidden");
  stampFormArea.classList.add("hidden");
  examList.innerHTML = "";
  stampList.innerHTML = "";

  studentModal.classList.remove("hidden");
}

function openEditStudent(studentId) {
  const student = data.students.find(item => item.id === studentId);

  if (!student) {
    return;
  }

  currentStudentId = studentId;
  editingExamId = null;

  studentModalTitle.textContent = "Schüler bearbeiten";

  document.getElementById("studentId").value = student.id;
  document.getElementById("firstName").value = student.firstName;
  document.getElementById("lastName").value = student.lastName;
  document.getElementById("birthday").value = student.birthday;
  document.getElementById("belt").value = student.belt;
  document.getElementById("beltSize").value = student.beltSize || "";
  document.getElementById("notes").value = student.notes;
  document.getElementById("plannedExam").checked = Boolean(student.plannedExam);

  deleteStudentBtn.classList.remove("hidden");
  detailsArea.classList.remove("hidden");
  examFormArea.classList.add("hidden");
  stampFormArea.classList.add("hidden");

  renderExams();
  renderStamps();

  studentModal.classList.remove("hidden");
}

function closeStudentModal() {
  studentModal.classList.add("hidden");
}

if (studentForm) {
  studentForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const studentId = currentStudentId || makeId();

    const existingIndex = data.students.findIndex(student => student.id === studentId);
    const oldStudent = existingIndex >= 0 ? data.students[existingIndex] : {};

    const studentData = {
      id: studentId,
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      birthday: document.getElementById("birthday").value,
      belt: document.getElementById("belt").value,
      beltSize: document.getElementById("beltSize").value,
      notes: document.getElementById("notes").value.trim(),
      plannedExam: document.getElementById("plannedExam").checked,
      planningPaidAmount: oldStudent.planningPaidAmount || "",
      planningRegistrationType: oldStudent.planningRegistrationType || "",
      planningPaymentMethod: oldStudent.planningPaymentMethod || "",
      planningTargetBelt: oldStudent.planningTargetBelt || "",
      annualStamps: oldStudent.annualStamps || [],
      exams: oldStudent.exams || []
    };

    if (existingIndex >= 0) {
      data.students[existingIndex] = studentData;
    } else {
      data.students.push(studentData);
      currentStudentId = studentId;
    }

    try {
      await saveStudents();
      closeStudentModal();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function deleteCurrentStudent() {
  const student = getCurrentStudent();

  if (!student) {
    return;
  }

  const confirmed = confirm(`Schüler ${student.firstName} ${student.lastName} wirklich löschen?`);

  if (!confirmed) {
    return;
  }

  data.students = data.students.filter(item => item.id !== student.id);

  try {
    await saveStudents();
    closeStudentModal();
  } catch (error) {
    alert(error.message);
  }
}

/* Prüfungsverlauf */

function openExamForm() {
  editingExamId = null;

  document.getElementById("examDate").value = "";
  document.getElementById("examBelt").value = "Weiß";
  document.getElementById("examNote").value = "";

  examFormArea.classList.remove("hidden");
}

function closeExamForm() {
  editingExamId = null;
  examFormArea.classList.add("hidden");
}

function editExam(examId) {
  const student = getCurrentStudent();

  if (!student) {
    return;
  }

  const exam = student.exams.find(item => item.id === examId);

  if (!exam) {
    return;
  }

  editingExamId = examId;

  document.getElementById("examDate").value = exam.date || "";
  document.getElementById("examBelt").value = exam.belt || "Weiß";
  document.getElementById("examNote").value = exam.note || "";

  examFormArea.classList.remove("hidden");
}

async function saveExam() {
  const student = getCurrentStudent();

  if (!student) {
    alert("Bitte Schüler zuerst speichern.");
    return;
  }

  const date = document.getElementById("examDate").value;
  const belt = document.getElementById("examBelt").value;
  const note = document.getElementById("examNote").value.trim();

  if (!date) {
    alert("Bitte Datum eintragen.");
    return;
  }

  const examData = {
    id: editingExamId || makeId(),
    date: date,
    belt: belt,
    note: note
  };

  student.exams = student.exams || [];

  const existingIndex = student.exams.findIndex(item => item.id === examData.id);

  if (existingIndex >= 0) {
    student.exams[existingIndex] = examData;
  } else {
    student.exams.push(examData);
  }

  student.exams.sort((a, b) => b.date.localeCompare(a.date));

  const newestExam = student.exams[0];

  if (newestExam) {
    student.belt = newestExam.belt;
    document.getElementById("belt").value = newestExam.belt;
  }

  try {
    await saveStudents();
    renderExams();
    closeExamForm();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteExam(examId) {
  const student = getCurrentStudent();

  if (!student) {
    return;
  }

  const confirmed = confirm("Diesen Prüfungseintrag löschen?");

  if (!confirmed) {
    return;
  }

  student.exams = student.exams.filter(item => item.id !== examId);
  student.exams.sort((a, b) => b.date.localeCompare(a.date));

  const newestExam = student.exams[0];

  if (newestExam) {
    student.belt = newestExam.belt;
    document.getElementById("belt").value = newestExam.belt;
  }

  try {
    await saveStudents();
    renderExams();
  } catch (error) {
    alert(error.message);
  }
}

function renderExams() {
  if (!examList) {
    return;
  }

  const student = getCurrentStudent();

  if (!student) {
    examList.innerHTML = "";
    return;
  }

  const exams = (student.exams || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  if (exams.length === 0) {
    examList.innerHTML = `<div class="empty-state">Noch keine Einträge vorhanden.</div>`;
    return;
  }

  examList.innerHTML = exams.map(exam => {
    return `
      <div class="exam-item">
        <div>
          <div class="exam-main">
            <span class="belt-dot ${beltClass(exam.belt)}"></span>
            <strong>${escapeHtml(exam.belt)}</strong>
          </div>
          <div class="exam-date">${formatDate(exam.date)}</div>
          ${exam.note ? `<div class="exam-note">${escapeHtml(exam.note)}</div>` : ""}
        </div>

        <div class="form-actions">
          <button class="secondary-btn" onclick="editExam('${exam.id}')">Bearbeiten</button>
          <button class="danger-btn" onclick="deleteExam('${exam.id}')">Löschen</button>
        </div>
      </div>
    `;
  }).join("");
}

/* Jahressichtmarken */

function openStampForm() {
  const year = new Date().getFullYear();

  document.getElementById("stampYear").value = year;
  document.getElementById("stampStatus").value = "ja";

  stampFormArea.classList.remove("hidden");
}

function closeStampForm() {
  stampFormArea.classList.add("hidden");
}

async function saveStamp() {
  const student = getCurrentStudent();

  if (!student) {
    alert("Bitte Schüler zuerst speichern.");
    return;
  }

  const year = String(document.getElementById("stampYear").value).trim();
  const status = document.getElementById("stampStatus").value;

  if (!year) {
    alert("Bitte Jahr eintragen.");
    return;
  }

  student.annualStamps = student.annualStamps || [];

  const existingIndex = student.annualStamps.findIndex(item => String(item.year) === year);

  if (existingIndex >= 0) {
    student.annualStamps[existingIndex].status = status;
  } else {
    student.annualStamps.push({
      year: year,
      status: status
    });
  }

  student.annualStamps.sort((a, b) => String(b.year).localeCompare(String(a.year)));

  try {
    await saveStudents();
    renderStamps();
    closeStampForm();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteStamp(year) {
  const student = getCurrentStudent();

  if (!student) {
    return;
  }

  const confirmed = confirm(`Sichtmarke ${year} löschen?`);

  if (!confirmed) {
    return;
  }

  student.annualStamps = (student.annualStamps || []).filter(item => String(item.year) !== String(year));

  try {
    await saveStudents();
    renderStamps();
  } catch (error) {
    alert(error.message);
  }
}

function renderStamps() {
  if (!stampList) {
    return;
  }

  const student = getCurrentStudent();

  if (!student) {
    stampList.innerHTML = "";
    return;
  }

  const stamps = (student.annualStamps || []).slice().sort((a, b) => String(b.year).localeCompare(String(a.year)));

  if (stamps.length === 0) {
    stampList.innerHTML = `<div class="empty-state">Noch keine Jahressichtmarken eingetragen.</div>`;
    return;
  }

  stampList.innerHTML = stamps.map(stamp => {
    const statusText = stamp.status === "ja" ? "Vorhanden" : "Fehlt";

    return `
      <div class="exam-item">
        <div>
          <strong>${escapeHtml(stamp.year)}</strong>
          <div class="exam-date">${statusText}</div>
        </div>

        <div class="form-actions">
          <button class="danger-btn" onclick="deleteStamp('${escapeHtml(stamp.year)}')">Löschen</button>
        </div>
      </div>
    `;
  }).join("");
}

/* Prüfungsplanung Auswahl */

function openExamPlanning() {
  renderPlanningList();
  planningModal.classList.remove("hidden");
}

function closeExamPlanning() {
  planningModal.classList.add("hidden");
}

function renderPlanningList() {
  if (!planningList) {
    return;
  }

  const students = data.students.slice().sort((a, b) => {
    const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
    const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
    return nameA.localeCompare(nameB, "de");
  });

  if (students.length === 0) {
    planningList.innerHTML = `<div class="empty-state">Keine Schüler vorhanden.</div>`;
    return;
  }

  planningList.innerHTML = students.map(student => {
    return `
      <label class="planning-item">
        <input type="checkbox" data-planning-id="${student.id}" ${student.plannedExam ? "checked" : ""}>

        <div>
          <strong>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</strong>
        </div>

        <div class="belt-row">
          <span class="belt-dot ${beltClass(student.belt)}"></span>
          <span class="belt-text">${escapeHtml(student.belt)}</span>
        </div>
      </label>
    `;
  }).join("");
}

async function savePlanning() {
  const checkboxes = planningList.querySelectorAll("input[data-planning-id]");

  checkboxes.forEach(checkbox => {
    const student = data.students.find(item => item.id === checkbox.dataset.planningId);

    if (student) {
      student.plannedExam = checkbox.checked;
    }
  });

  try {
    await saveStudents();
    closeExamPlanning();
  } catch (error) {
    alert(error.message);
  }
}

/* Eigene Prüfungsplanung Tabelle */

function renderPlanningTable() {
  if (!planningTableBody) {
    return;
  }

  const plannedStudents = data.students
    .filter(student => student.plannedExam)
    .sort((a, b) => {
      const ageA = calculateAge(a.birthday);
      const ageB = calculateAge(b.birthday);
      const targetA = a.planningTargetBelt || getNextBelt(a.belt, ageA);
      const targetB = b.planningTargetBelt || getNextBelt(b.belt, ageB);

      const targetCompare = beltOrder(targetA) - beltOrder(targetB);
      if (targetCompare !== 0) {
        return targetCompare;
      }

      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB, "de");
    });

  if (plannedStudents.length === 0) {
    planningTableBody.innerHTML = `
      <tr>
        <td colspan="10">Keine Schüler für die Prüfung eingeplant.</td>
      </tr>
    `;
    return;
  }

  planningTableBody.innerHTML = plannedStudents.map(student => {
    const age = calculateAge(student.birthday);
    const targetBelt = student.planningTargetBelt || getNextBelt(student.belt, age);

    return `
      <tr data-student-id="${student.id}">
        <td>
          <strong>${escapeHtml(student.lastName)}, ${escapeHtml(student.firstName)}</strong>
        </td>

        <td>
          <div class="belt-row center-belt">
            <span class="belt-dot ${beltClass(student.belt)}"></span>
            <span class="belt-text">${escapeHtml(student.belt)}</span>
          </div>
        </td>

        <td>
          <select class="table-select" data-field="planningTargetBelt">
            ${GURTE.map(belt => `<option value="${belt}" ${belt === targetBelt ? "selected" : ""}>${belt}</option>`).join("")}
          </select>
        </td>

        <td>
          <strong>${age === null ? "-" : age}</strong>
        </td>

        <td>
          <strong>${escapeHtml(student.beltSize || "-")}</strong>
        </td>

        <td>
          <span class="${getCurrentStampYears(student) !== "-" ? "status-neutral" : "status-bad"}">
            ${getCurrentStampYears(student)}
          </span>
        </td>

        <td>
          <select class="table-select" data-field="planningRegistrationType">
            <option value="" ${!student.planningRegistrationType ? "selected" : ""}>-</option>
            <option value="mündlich" ${student.planningRegistrationType === "mündlich" ? "selected" : ""}>mündlich</option>
            <option value="Zettel" ${student.planningRegistrationType === "Zettel" ? "selected" : ""}>Zettel</option>
          </select>
        </td>

        <td>
          <input class="table-input euro-input" type="text" data-field="planningPaidAmount" value="${escapeHtml(student.planningPaidAmount || "")}" placeholder="25 €">
        </td>

        <td>
          <select class="table-select" data-field="planningPaymentMethod">
            <option value="" ${!student.planningPaymentMethod ? "selected" : ""}>-</option>
            <option value="Bar" ${student.planningPaymentMethod === "Bar" ? "selected" : ""}>Bar</option>
            <option value="Überweisung" ${student.planningPaymentMethod === "Überweisung" ? "selected" : ""}>Überweisung</option>
          </select>
        </td>

        <td>
          <button class="danger-btn small-remove-btn" onclick="removeStudentFromPlanning('${student.id}')">×</button>
        </td>
      </tr>
    `;
  }).join("");
}

async function savePlanningTable() {
  savePlanningTableValuesFromDom();

  try {
    await saveStudents();
    alert("Prüfungsplanung gespeichert.");
    await loadStudents();
  } catch (error) {
    alert(error.message);
  }
}

async function removeStudentFromPlanning(studentId) {
  const student = data.students.find(item => item.id === studentId);

  if (!student) {
    return;
  }

  const confirmed = confirm(`${student.firstName} ${student.lastName} aus der Prüfungsplanung entfernen?`);

  if (!confirmed) {
    return;
  }

  student.plannedExam = false;
  student.planningPaidAmount = "";
  student.planningRegistrationType = "";
  student.planningPaymentMethod = "";

  try {
    await saveStudents();
    renderPlanningTable();
  } catch (error) {
    alert(error.message);
  }
}

function getNextBelt(currentBelt, age) {
  const currentIndex = GURTE.indexOf(currentBelt);

  if (currentIndex < 0 || currentIndex >= GURTE.length - 1) {
    return currentBelt || "Weiß";
  }

  let nextIndex = currentIndex + 1;

  if (age !== null && age >= 14) {
    while (nextIndex < GURTE.length - 1 && isHalfBelt(GURTE[nextIndex])) {
      nextIndex++;
    }
  }

  return GURTE[nextIndex];
}

function isHalfBelt(belt) {
  return [
    "Gelb-Orange",
    "Orange-Grün",
    "Grün-Blau",
    "Blau-Braun",
    "Braun-Schwarz"
  ].includes(belt);
}


function beltOrder(belt) {
  const index = GURTE.indexOf(belt);
  return index === -1 ? 999 : index;
}

function exportPlanningExcel() {
  savePlanningTableValuesFromDom();

  const plannedStudents = data.students
    .filter(student => student.plannedExam)
    .sort((a, b) => {
      const ageA = calculateAge(a.birthday);
      const ageB = calculateAge(b.birthday);
      const targetA = a.planningTargetBelt || getNextBelt(a.belt, ageA);
      const targetB = b.planningTargetBelt || getNextBelt(b.belt, ageB);

      const targetCompare = beltOrder(targetA) - beltOrder(targetB);
      if (targetCompare !== 0) {
        return targetCompare;
      }

      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB, "de");
    });

  const rowsHtml = plannedStudents.map(student => {
    const age = calculateAge(student.birthday);
    const targetBelt = student.planningTargetBelt || getNextBelt(student.belt, age);

    return `
      <tr>
        <td><b>${escapeHtml(student.lastName)}, ${escapeHtml(student.firstName)}</b></td>
        <td>${escapeHtml(student.belt || "")}</td>
        <td>${escapeHtml(targetBelt || "")}</td>
        <td>${age === null ? "" : age}</td>
        <td>${escapeHtml(student.beltSize || "")}</td>
        <td class="${getCurrentStampYears(student) !== "-" ? "neutral" : "bad"}">${escapeHtml(getCurrentStampYears(student))}</td>
        <td>${escapeHtml(student.planningRegistrationType || "")}</td>
        <td>${escapeHtml(student.planningPaidAmount || "")}</td>
        <td>${escapeHtml(student.planningPaymentMethod || "")}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table {
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            width: 100%;
          }

          th {
            background: #f8fafc;
            font-weight: 900;
            text-align: center;
            border: 1px solid #d1d5db;
            padding: 8px;
          }

          td {
            text-align: center;
            border: 1px solid #d1d5db;
            padding: 8px;
          }

          .bad {
            background: #fee2e2;
            color: #991b1b;
            font-weight: 800;
          }

          .neutral {
            background: #eef2ff;
            color: #1e3a8a;
            font-weight: 800;
          }

          .summary {
            background: #f8fafc;
            font-weight: 900;
          }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Aktueller Gurt</th>
              <th>Zielgurt</th>
              <th>Alter</th>
              <th>Gürtellänge</th>
              <th>Jahressichtmarke</th>
              <th>Anmeldung</th>
              <th>Bezahlt in €</th>
              <th>Zahlungsart</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="9">Keine Schüler für die Prüfung eingeplant.</td></tr>`}
            <tr class="summary">
              <td colspan="8">Gesamtzahl Prüflinge</td>
              <td>${plannedStudents.length}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + html], {
    type: "application/vnd.ms-excel;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pruefungsplanung-sortiert-nach-zielgurt.xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


function savePlanningTableValuesFromDom() {
  const tableBody = document.getElementById("planningTableBody");

  if (!tableBody) {
    return;
  }

  const rows = tableBody.querySelectorAll("tr[data-student-id]");

  rows.forEach(row => {
    const student = data.students.find(item => item.id === row.dataset.studentId);

    if (!student) {
      return;
    }

    const targetBelt = row.querySelector('[data-field="planningTargetBelt"]');
    const registrationType = row.querySelector('[data-field="planningRegistrationType"]');
    const paidAmount = row.querySelector('[data-field="planningPaidAmount"]');
    const paymentMethod = row.querySelector('[data-field="planningPaymentMethod"]');

    student.planningTargetBelt = targetBelt ? targetBelt.value : "";
    student.planningRegistrationType = registrationType ? registrationType.value : "";
    student.planningPaidAmount = paidAmount ? paidAmount.value.trim() : "";
    student.planningPaymentMethod = paymentMethod ? paymentMethod.value : "";
  });
}



function getCurrentStampYears(student) {
  const currentYear = String(new Date().getFullYear());

  const currentStamps = (student.annualStamps || [])
    .filter(stamp => stamp.status === "ja" && String(stamp.year) === currentYear)
    .map(stamp => String(stamp.year));

  if (currentStamps.length > 0) {
    return currentStamps.join(", ");
  }

  const allStamps = (student.annualStamps || [])
    .filter(stamp => stamp.status === "ja")
    .map(stamp => String(stamp.year))
    .sort((a, b) => b.localeCompare(a));

  return allStamps.length > 0 ? allStamps.join(", ") : "-";
}

function hasCurrentStamp(student) {
  const currentYear = String(new Date().getFullYear());

  return (student.annualStamps || []).some(stamp => {
    return String(stamp.year) === currentYear && stamp.status === "ja";
  });
}

function getCurrentStampText(student) {
  return hasCurrentStamp(student) ? "Vorhanden" : "Fehlt";
}

function beltOrder(belt) {
  const index = GURTE.indexOf(belt);
  return index === -1 ? 999 : index;
}

/* Übersicht */

function renderStudents() {
  if (!studentsList) {
    return;
  }

  const search = searchInput.value.toLowerCase().trim();
  const selectedBelt = beltFilter.value;
  const selectedPlanning = planningFilter.value;

  const students = data.students
    .filter(student => {
      const text = `${student.firstName} ${student.lastName} ${student.belt} ${student.beltSize || ""}`.toLowerCase();
      const matchesSearch = text.includes(search);
      const matchesBelt = selectedBelt === "" || student.belt === selectedBelt;
      const matchesPlanning = selectedPlanning === "" || student.plannedExam === true;

      return matchesSearch && matchesBelt && matchesPlanning;
    })
    .sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB, "de");
    });

  if (students.length === 0) {
    studentsList.innerHTML = `<div class="empty-state">Keine Schüler gefunden.</div>`;
    return;
  }

  studentsList.innerHTML = students.map(student => {
    const newestStamp = getNewestStamp(student);

    return `
      <div class="student-card" onclick="openEditStudent('${student.id}')">
        <div class="student-name">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</div>

        <div class="belt-row">
          <span class="belt-dot ${beltClass(student.belt)}"></span>
          <span class="belt-text">${escapeHtml(student.belt)}</span>
        </div>

        <div class="student-info">
          Alter: ${student.birthday ? calculateAge(student.birthday) + " Jahre" : "-"}
        </div>

        <div class="student-info">
          Gürtellänge: ${student.beltSize || "-"}
        </div>

        <div class="student-info">
          Sichtmarke: ${newestStamp}
        </div>

        ${student.plannedExam ? `<div class="planned-badge">Für Prüfung eingeplant</div>` : ""}
      </div>
    `;
  }).join("");
}

function getNewestStamp(student) {
  const stamps = (student.annualStamps || []).slice().sort((a, b) => String(b.year).localeCompare(String(a.year)));

  if (stamps.length === 0) {
    return "-";
  }

  const newest = stamps[0];
  return `${newest.year}: ${newest.status === "ja" ? "Ja" : "Nein"}`;
}

function beltClass(belt) {
  const value = String(belt || "").toLowerCase();

  if (value.includes("gelb-orange")) {
    return "belt-yellow-orange";
  }

  if (value.includes("orange-grün")) {
    return "belt-orange-green";
  }

  if (value.includes("grün-blau")) {
    return "belt-green-blue";
  }

  if (value.includes("blau-braun")) {
    return "belt-blue-brown";
  }

  if (value.includes("braun-schwarz")) {
    return "belt-brown-black";
  }

  if (value.includes("weiß")) {
    return "belt-white";
  }

  if (value.includes("gelb")) {
    return "belt-yellow";
  }

  if (value.includes("orange")) {
    return "belt-orange";
  }

  if (value.includes("grün")) {
    return "belt-green";
  }

  if (value.includes("blau")) {
    return "belt-blue";
  }

  if (value.includes("braun")) {
    return "belt-brown";
  }

  return "belt-black";
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Date(dateString + "T00:00:00").toLocaleDateString("de-DE");
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (searchInput) {
  searchInput.addEventListener("input", renderStudents);
}

if (beltFilter) {
  beltFilter.addEventListener("change", renderStudents);
}

if (planningFilter) {
  planningFilter.addEventListener("change", renderStudents);
}

window.addEventListener("load", function() {
  renderStudents();
  renderPlanningTable();
  loadStudents();
});
