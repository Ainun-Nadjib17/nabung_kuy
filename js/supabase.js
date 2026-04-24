// ==================== SUPABASE CONFIGURATION ====================
// GANTI DENGAN CREDENTIAL SUPABASE KAMU SENDIRI!
const SUPABASE_URL = 'https://awmfrlbomdmlsdnqvoxd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLIx_0RNAiJDALL9WCMu4A_FJGTrgRV';

let supabaseClient = null;

// Inisialisasi Supabase
function initSupabase() {
    try {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
    } catch (e) {
        console.warn('Supabase tidak tersedia, menggunakan localStorage sebagai fallback.');
    }
    return null;
}

supabaseClient = initSupabase();

// Helper untuk cek koneksi
async function checkSupabaseConnection() {
    if (!supabaseClient) return false;
    try {
        const { data, error } = await supabaseClient.from('savings').select('count').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
}