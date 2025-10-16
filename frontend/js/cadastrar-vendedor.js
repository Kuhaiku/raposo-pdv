document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin');

    const form = document.getElementById('cadastro-vendedor-form');
    const successMessage = document.getElementById('success-message');
    const successMessageText = successMessage.querySelector('p');
    const errorMessage = document.getElementById('error-message');
    const errorMessageText = errorMessage.querySelector('p');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        successMessage.classList.add('hidden');
        errorMessage.classList.add('hidden');

        const nome = document.getElementById('nome').value;
        const email = document.getElementById('email').value;
        
        // Objeto de dados não inclui mais a senha
        const dados = { nome, email };

        try {
            const response = await fetchWithAuth('/api/usuarios/cadastrar', {
                method: 'POST',
                body: JSON.stringify(dados)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro.');
            }

            form.reset();
            successMessageText.textContent = data.message; // Usa a mensagem de sucesso da API
            successMessage.classList.remove('hidden');

        } catch (error) {
            errorMessageText.textContent = error.message;
            errorMessage.classList.remove('hidden');
        }
    });
});