document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');
    const senhaInput = document.getElementById('senha');
    const toggleSenhaBtn = document.getElementById('toggle-senha');
    const toggleSenhaIcon = toggleSenhaBtn.querySelector('span');

    // --- LÓGICA PARA MOSTRAR/ESCONDER SENHA ---
    toggleSenhaBtn.addEventListener('click', () => {
        const isPassword = senhaInput.type === 'password';
        senhaInput.type = isPassword ? 'text' : 'password';
        toggleSenhaIcon.textContent = isPassword ? 'visibility' : 'visibility_off';
    });

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageDiv.textContent = '';
        const email = document.getElementById('email').value;
        const senha = senhaInput.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erro ao tentar fazer login.');
            }

            localStorage.setItem('authToken', data.token);

            if (data.role === 'admin') {
                window.location.href = '/painel-empresa.html';
            } else {
                window.location.href = '/painel.html';
            }
        } catch (error) {
            errorMessageDiv.textContent = error.message;
        }
    });
});