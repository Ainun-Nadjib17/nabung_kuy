// ==================== AUTHENTICATION ====================

let currentUser = null;

// Cek autentikasi saat load halaman
async function checkAuth() {
    // Coba cek session Supabase (dengan timeout 3 detik)
    if (supabaseClient) {
        try {
            const authPromise = supabaseClient.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), 3000)
            );
            
            const { data: { session } } = await Promise.race([authPromise, timeoutPromise]);
            if (session) {
                const { data: { user } } = await supabaseClient.auth.getUser();
                currentUser = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.email
                };
                updateUserDisplay();
                return true;
            }
        } catch (e) {
            console.warn('Supabase auth check skipped:', e.message || e);
        }
    }

    // Fallback ke localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserDisplay();
            return true;
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }

    // Redirect ke login jika belum login
    const path = window.location.pathname.toLowerCase();
    const filename = path.split('/').pop();
    if (filename !== 'index.html' && filename !== 'register.html' && filename !== '' && filename !== '/') {
        window.location.href = 'index.html';
    }
    return false;
}

function updateUserDisplay() {
    const userNameElements = document.querySelectorAll('#userName');
    userNameElements.forEach(el => {
        if (el) el.textContent = currentUser?.name || currentUser?.email || 'User';
    });
}

// Login
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btnText = document.getElementById('loginText');
    const btnLoading = document.getElementById('loginLoading');

    if (!email || !password) {
        errorEl.textContent = 'Email dan password harus diisi!';
        return;
    }

    // UI Loading
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    errorEl.textContent = '';

    // Coba login Supabase
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data.user) {
                currentUser = {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.full_name || data.user.email
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                window.location.href = 'dashboard.html';
                return;
            }
            if (error) {
                // Don't return yet, try localStorage fallback
                console.warn('Supabase login error:', error.message);
            }
        } catch (e) {
            console.warn('Supabase login exception:', e);
        }
    }

    // Fallback localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        currentUser = { id: user.email, email: user.email, name: user.name };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        window.location.href = 'dashboard.html';
    } else {
        errorEl.textContent = 'Email atau password salah!';
    }

    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
}

// Register
async function register() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');
    const btnText = document.getElementById('registerText');
    const btnLoading = document.getElementById('registerLoading');

    if (!name || !email || !password) {
        errorEl.textContent = 'Semua field harus diisi!';
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password minimal 6 karakter!';
        return;
    }

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    errorEl.textContent = '';

    // Coba register Supabase
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });
            if (!error) {
                alert('Pendaftaran berhasil! Silakan cek email untuk verifikasi (jika diaktifkan), lalu masuk.');
                window.location.href = 'index.html';
                return;
            }
            if (error && !error.message.includes('User already registered')) {
                errorEl.textContent = error.message;
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
                return;
            }
        } catch (e) {
            console.warn('Supabase register exception:', e);
        }
    }

    // Fallback localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) {
        errorEl.textContent = 'Email sudah terdaftar!';
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        return;
    }

    users.push({ name, email, password });
    localStorage.setItem('users', JSON.stringify(users));

    alert('Pendaftaran berhasil! Silakan masuk.');
    window.location.href = 'index.html';
}

// Logout
async function logout() {
    if (supabaseClient) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) {
            console.warn('Supabase signOut error:', e);
        }
    }
    localStorage.removeItem('currentUser');
    currentUser = null;
    window.location.href = 'index.html';
}

// Get storage key berdasarkan user
function getStorageKey(key) {
    return currentUser ? `${key}_${currentUser.id}` : key;
}