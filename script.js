const studentsList =
  document.getElementById("studentsList")

const studentForm =
  document.getElementById("studentForm")

const searchInput =
  document.getElementById("searchInput")

const examList =
  document.getElementById("examList")

let data = {
  students:[]
}

let currentStudent = null

// ======================
// GitHub Settings
// ======================

function getSettings(){

  return {

    owner:
      localStorage.getItem("github_owner") || "",

    repo:
      localStorage.getItem("github_repo") || "",

    branch:
      localStorage.getItem("github_branch") || "main",

    token:
      localStorage.getItem("github_token") || ""

  }

}

function saveSettings(){

  localStorage.setItem(
    "github_owner",
    document.getElementById("ownerInput").value
  )

  localStorage.setItem(
    "github_repo",
    document.getElementById("repoInput").value
  )

  localStorage.setItem(
    "github_branch",
    document.getElementById("branchInput").value
  )

  localStorage.setItem(
    "github_token",
    document.getElementById("tokenInput").value
  )

  alert("Gespeichert")

  closeSettings()

  loadStudents()

}

function openSettings(){

  document
    .getElementById("settingsModal")
    .classList.remove("hidden")

}

function closeSettings(){

  document
    .getElementById("settingsModal")
    .classList.add("hidden")

}

// ======================
// GitHub Verbindung
// ======================

let currentSha = null

async function loadStudents(){

  const settings = getSettings()

  const res = await fetch(

    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/data.json?ref=${settings.branch}`,

    {

      headers:{
        Authorization:
          `Bearer ${settings.token}`
      }

    }

  )

  const file = await res.json()

  currentSha = file.sha

  data = JSON.parse(
    atob(file.content)
  )

  render()

}

async function saveStudents(){

  const settings = getSettings()

  await fetch(

    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/data.json`,

    {

      method:"PUT",

      headers:{

        Authorization:
          `Bearer ${settings.token}`,

        "Content-Type":
          "application/json"

      },

      body:JSON.stringify({

        message:"update students",

        content:btoa(
          JSON.stringify(data,null,2)
        ),

        sha:currentSha,

        branch:settings.branch

      })

    }

  )

  await loadStudents()

}

// ======================
// Render
// ======================

function render(){

  const search =
    searchInput.value.toLowerCase()

  studentsList.innerHTML = ""

  data.students

    .filter(student => {

      return (

        student.firstName
          .toLowerCase()
          .includes(search)

        ||

        student.lastName
          .toLowerCase()
          .includes(search)

      )

    })

    .forEach(student => {

      const div =
        document.createElement("div")

      div.className =
        "student-card"

      div.innerHTML = `

        <h3>
          ${student.lastName},
          ${student.firstName}
        </h3>

        <p>
          <strong>
            ${student.belt}
          </strong>
        </p>

        <button onclick="
          editStudent('${student.id}')
        ">
          Öffnen
        </button>

      `

      studentsList.appendChild(div)

    })

}

// ======================
// Schüler
// ======================

function openAddModal(){

  currentStudent = null

  studentForm.reset()

  examList.innerHTML = ""

  document
    .getElementById("studentModal")
    .classList.remove("hidden")

}

function closeModal(){

  document
    .getElementById("studentModal")
    .classList.add("hidden")

}

studentForm.addEventListener(
  "submit",
  async e => {

    e.preventDefault()

    const student = {

      id:
        currentStudent?.id
        || Date.now().toString(),

      firstName:
        document.getElementById("firstName").value,

      lastName:
        document.getElementById("lastName").value,

      birthday:
        document.getElementById("birthday").value,

      belt:
        document.getElementById("belt").value,

      notes:
        document.getElementById("notes").value,

      annualStamp:
        document.getElementById("annualStamp").value,

      annualStampYear:
        document.getElementById("annualStampYear").value,

      exams:
        currentStudent?.exams || []

    }

    if(currentStudent){

      const index =
        data.students.findIndex(
          s => s.id === student.id
        )

      data.students[index] = student

    }else{

      data.students.push(student)

    }

    await saveStudents()

    closeModal()

  }

)

function editStudent(id){

  currentStudent =
    data.students.find(
      s => s.id === id
    )

  document.getElementById("firstName").value =
    currentStudent.firstName

  document.getElementById("lastName").value =
    currentStudent.lastName

  document.getElementById("birthday").value =
    currentStudent.birthday

  document.getElementById("belt").value =
    currentStudent.belt

  document.getElementById("notes").value =
    currentStudent.notes

  document.getElementById("annualStamp").value =
    currentStudent.annualStamp || "nein"

  document.getElementById("annualStampYear").value =
    currentStudent.annualStampYear || ""

  renderExams()

  document
    .getElementById("studentModal")
    .classList.remove("hidden")

}

// ======================
// Prüfungen
// ======================

function renderExams(){

  examList.innerHTML = ""

  currentStudent.exams ||= []

  currentStudent.exams.forEach(exam => {

    const div =
      document.createElement("div")

    div.className =
      "exam-item"

    div.innerHTML = `

      <strong>
        ${exam.date}
      </strong>

      <p>
        ${exam.belt}
      </p>

      <button onclick="
        deleteExam('${exam.id}')
      ">
        Löschen
      </button>

    `

    examList.appendChild(div)

  })

}

function addExam(){

  if(!currentStudent){

    alert(
      "Erst Schüler speichern"
    )

    return

  }

  const date =
    prompt(
      "Wann wurde der Gürtel erreicht?"
    )

  const belt =
    prompt(
      "Welcher Gürtel?"
    )

  if(!date || !belt) return

  currentStudent.exams.push({

    id:
      Date.now().toString(),

    date,
    belt

  })

  currentStudent.belt = belt

  renderExams()

  saveStudents()

}

function deleteExam(id){

  currentStudent.exams =
    currentStudent.exams.filter(
      e => e.id !== id
    )

  renderExams()

  saveStudents()

}

// ======================

searchInput.addEventListener(
  "input",
  render
)

// automatische Verbindung

window.addEventListener(
  "load",
  () => {

    const settings =
      getSettings()

    if(
      settings.owner &&
      settings.repo &&
      settings.token
    ){

      loadStudents()

    }

  }
)
