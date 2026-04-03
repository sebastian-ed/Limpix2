// ============================================================
//  supabase.js  –  Configuración central de Supabase
//  ⚠️  REEMPLAZÁ las dos constantes de abajo con tus datos
// ============================================================

const SUPABASE_URL = 'https://wmzuxajtfydlredmjdhm.supabase.co';   // ← tu Project URL
const SUPABASE_ANON_KEY = 'sb_publishable_4FFP43X9EvBXXW-oT7gFdA_lBszaOpe';  // ← tu anon/public key

// Cargamos el cliente desde el CDN (se importa en cada HTML)
// No hace falta instalar nada.

window.SUPA_URL = SUPABASE_URL;
window.SUPA_KEY = SUPABASE_ANON_KEY;
