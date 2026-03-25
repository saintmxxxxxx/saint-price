const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('authError');
const toggleModeBtn = document.getElementById('toggleModeBtn');
const toggleText = document.getElementById('toggleText');
const btnSubmit = document.getElementById('btnSubmit');

let isLogin = true;

toggleModeBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    if (isLogin) {
        document.querySelector('h1').textContent = 'Bienvenido de nuevo';
        document.querySelector('p').textContent = 'Accede a tu cuenta en Saint Price.';
        btnSubmit.textContent = 'Iniciar Sesión';
        toggleText.textContent = '¿No tienes cuenta?';
        toggleModeBtn.textContent = 'Regístrate';
    } else {
        document.querySelector('h1').textContent = 'Crear Cuenta';
        document.querySelector('p').textContent = 'Comienza a gestionar tu dinero.';
        btnSubmit.textContent = 'Registrarse';
        toggleText.textContent = '¿Ya tienes cuenta?';
        toggleModeBtn.textContent = 'Inicia Sesión';
    }
    authError.style.display = 'none';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    try {
        if (isLogin) {
            // LOGIN - JSON body
            const res = await fetch('http://localhost:8008/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) throw new Error('Credenciales incorrectas');
            const data = await res.json();
            
            localStorage.setItem('saintPriceToken', data.access_token);
            window.location.href = 'index.html';
            
        } else {
            // REGISTER
            const res = await fetch('http://localhost:8008/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error al registrar usuario');
            }
            
            // Auto login after register
            isLogin = true;
            toggleModeBtn.click();
            passwordInput.value = '';
            alert('Cuenta creada exitosamente. Por favor, inicia sesión.');
        }
    } catch (err) {
        authError.textContent = err.message;
        authError.style.display = 'block';
    }
});
