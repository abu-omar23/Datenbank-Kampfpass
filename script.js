const studentsList = document.getElementById("studentsList")
const form = document.getElementById("studentForm")
const searchInput = document.getElementById("searchInput")

let data = {
  students:[]
}

async function loadData(){

  const res = await fetch("data.json")
  data = await res.json()

  render()
}

function saveData(){

  localStorage.setItem(
    "students",
    JSON.stringify(data)
  )
}

function render(){

  const search = searchInput.value.toLowerCase()

  studentsList.innerHTML = ""

  data.students
    .filter(s => {

      return (
        s.firstName.toLowerCase().includes(search) ||
        s.lastName.toLowerCase().includes(search)
      )

    })
    .forEach(student => {

      const div = document.createElement("div")
      div.className = "student"

      div.innerHTML = `

        <h3>
          ${student.lastName},
          ${student.firstName}
        </h3>

        <p>
          Geburtstag:
          ${student.birthday}
        </p>

        <p>
          Gürtel:
          ${student.belt}
        </p>

        <p>
          Sichtmarke:
          ${student.annualStamp}
          ${student.annualStampYear}
        </p>

        <p>
          ${student.notes || ""}
        </p>

        <button onclick="editStudent('${student.id}')">
          Bearbeiten
        </button>

        <button onclick="deleteStudent('${student.id}')">
          Löschen
        </button>

        <div class="exam">

          <h4>Prüfungen</h4>

          ${
            (student.exams || [])
              .map(exam => `
                <div>

                  ${exam.date}
                  -
                  ${exam.belt}

                  <button onclick="
                    deleteExam(
                      '${student.id}',
                      '${exam.id}'
                    )
                  ">
                    X
                  </button>

                </div>
              `)
              .join("")
          }

          <button onclick="
            addExam('${student.id}')
          ">
            Prüfung hinzufügen
          </button>

        </div>

      `

      studentsList.appendChild(div)

    })

}

form.addEventListener("submit", e => {

  e.preventDefault()

  const id =
    document.getElementById("studentId").value
    || Date.now().toString()

  const existing =
    data.students.find(
      s => s.id === id
    )

  const student = {

    id,

    firstName:
      document.getElementById("firstName").value,

    lastName:
      document.getElementById("lastName").value,

    birthday:
      document.getElementById("birthday").value,

    belt:
      document.getElementById("belt").value,

    annualStamp:
      document.getElementById("annualStamp").value,

    annualStampYear:
      document.getElementById("annualStampYear").value,

    notes:
      document.getElementById("notes").value,

    exams:
      existing?.exams || []

  }

  if(existing){

    Object.assign(existing, student)

  }else{

    data.students.push(student)

  }

  saveData()
  render()
  form.reset()

})

function editStudent(id){

  const s =
    data.students.find(
      x => x.id === id
    )

  document.getElementById("studentId").value = s.id
  document.getElementById("firstName").value = s.firstName
  document.getElementById("lastName").value = s.lastName
  document.getElementById("birthday").value = s.birthday
  document.getElementById("belt").value = s.belt
  document.getElementById("annualStamp").value = s.annualStamp
  document.getElementById("annualStampYear").value = s.annualStampYear
  document.getElementById("notes").value = s.notes

}

function deleteStudent(id){

  data.students =
    data.students.filter(
      s => s.id !== id
    )

  saveData()
  render()

}

function addExam(studentId){

  const date =
    prompt("Prüfungsdatum")

  const belt =
    prompt("Gürtelgrad")

  if(!date || !belt) return

  const student =
    data.students.find(
      s => s.id === studentId
    )

  student.exams ||= []

  student.exams.push({

    id:Date.now().toString(),
    date,
    belt

  })

  student.belt = belt

  saveData()
  render()

}

function deleteExam(studentId, examId){

  const student =
    data.students.find(
      s => s.id === studentId
    )

  student.exams =
    student.exams.filter(
      e => e.id !== examId
    )

  saveData()
  render()

}

searchInput.addEventListener(
  "input",
  render
)

loadData()
