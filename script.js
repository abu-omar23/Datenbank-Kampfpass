import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'HIER_URL'
const supabaseKey = 'HIER_KEY'

const supabase = createClient(supabaseUrl, supabaseKey)

window.save = async function () {
  const text = document.getElementById('msg').value

  const { error } = await supabase
    .from('messages')
    .insert([{ text }])

  if (error) {
    alert("Fehler")
    console.log(error)
  } else {
    alert("Gespeichert")
  }
}
