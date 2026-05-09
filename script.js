const token = "DEIN_TOKEN"
const owner = "DEIN_GITHUB_NAME"
const repo = "DEIN_REPO"

async function saveData(text) {

  // Datei laden
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data.json`,
    {
      headers: {
        Authorization: `token ${token}`
      }
    }
  )

  const file = await response.json()

  // Alte Daten lesen
  const content = JSON.parse(atob(file.content))

  // Neue Daten hinzufügen
  content.push({ text })

  // Neue Datei hochladen
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data.json`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "update data",
        content: btoa(JSON.stringify(content, null, 2)),
        sha: file.sha
      })
    }
  )

  alert("Gespeichert")
}
