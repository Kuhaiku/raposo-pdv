document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-redefinir');
    const emailInput = document.getElementById('email');
    const btnEnviarCodigo = document.getElementById('btn-enviar-codigo');
    const etapaVerificacao = document.getElementById('etapa-verificacao');
    const codigoInput = document.getElementById('codigo-verificacao');
    const novaSenhaInput = document.getElementById('nova-senha');
    const toggleSenhaBtn = document.getElementById('toggle-senha');
    const feedbackMessage = document.getElementById('feedback-message');
    const submitButton = form.querySelector('button[type="submit"]');

    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    
    if (email) {
        emailInput.value = email;
    } else {
        feedbackMessage.textContent = "E-mail não fornecido. Volte e tente novamente.";
        feedbackMessage.style.color = 'red';
        btnEnviarCodigo.disabled = true;
    }

    btnEnviarCodigo.addEventListener('click', async () => {
        feedbackMessage.textContent = 'Enviando...';
        feedbackMessage.style.color = 'gray';
        btnEnviarCodigo.disabled = true;

        try {
            const response = await fetch('/api/auth/solicitar-reset-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput.value })
            });
            if (!response.ok) throw new Error('Falha ao enviar código.');
            
            feedbackMessage.textContent = 'Código enviado para o seu e-mail!';
            feedbackMessage.style.color = 'green';
            etapaVerificacao.classList.remove('hidden');
            codigoInput.focus();
        } catch (error) {
            feedbackMessage.textContent = 'Erro ao enviar código. Tente novamente.';
            feedbackMessage.style.color = 'red';
            btnEnviarCodigo.disabled = false;
        }
    });

    toggleSenhaBtn.addEventListener('click', () => {
        const isPassword = novaSenhaInput.type === 'password';
        novaSenhaInput.type = isPassword ? 'text' : 'password';
        toggleSenhaBtn.querySelector('span').textContent = isPassword ? 'visibility' : 'visibility_off';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackMessage.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Redefinindo...';

        const code = codigoInput.value;
        const novaSenha = novaSenhaInput.value;

        if (code.length !== 6) {
            feedbackMessage.textContent = 'O código deve ter 6 dígitos.';
            feedbackMessage.style.color = 'red';
            submitButton.disabled = false;
            submitButton.textContent = 'Redefinir Senha';
            return;
        }

        try {
            const response = await fetch('/api/auth/redefinir-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, novaSenha })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            feedbackMessage.textContent = 'Senha redefinida com sucesso! Redirecionando...';
            feedbackMessage.style.color = 'green';
            setTimeout(() => { window.location.href = '/login.html'; }, 2000);
        } catch (error) {
            feedbackMessage.textContent = error.message;
            feedbackMessage.style.color = 'red';
            submitButton.disabled = false;
            submitButton.textContent = 'Redefinir Senha';
        }
    });
});