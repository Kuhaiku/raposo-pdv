document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin');

    const form = document.getElementById('form-produto');
    const inputImagens = document.getElementById('imagens');
    const previewsContainer = document.getElementById('previews');
    const feedbackMessage = document.getElementById('feedback-message');
    let filesToUpload = [];

    inputImagens.addEventListener('change', (e) => {
        // Adiciona os novos arquivos à lista, em vez de substituir
        filesToUpload.push(...Array.from(e.target.files));
        renderPreviews();
    });

    function renderPreviews() {
        previewsContainer.innerHTML = '';
        filesToUpload.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewDiv = document.createElement('div');
                previewDiv.classList.add('preview-image');
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" class="w-full h-24 object-cover rounded-lg">
                    <button type="button" class="remove-image" data-index="${index}">&times;</button>
                `;
                previewsContainer.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        });
    }
    
    previewsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-image')) {
            const index = parseInt(e.target.dataset.index, 10);
            filesToUpload.splice(index, 1);
            renderPreviews();
            // Limpa o input para permitir selecionar o mesmo arquivo novamente se o usuário quiser
            inputImagens.value = '';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackMessage.textContent = '';
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        
        const formData = new FormData();
        formData.append('nome', document.getElementById('nome').value);
        formData.append('codigo', document.getElementById('codigo').value);
        formData.append('preco', document.getElementById('preco').value);
        formData.append('estoque', document.getElementById('estoque').value);
        formData.append('categoria', document.getElementById('categoria').value);
        formData.append('descricao', document.getElementById('descricao').value);
        
        filesToUpload.forEach(file => {
            formData.append('imagens', file); // 'imagens' é o nome do campo esperado pelo Multer
        });

        try {
            // Usamos a função fetchWithAuth que agora lida com FormData corretamente
            const response = await fetchWithAuth('/api/produtos', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            feedbackMessage.textContent = "Produto salvo com sucesso!";
            feedbackMessage.style.color = 'green';
            form.reset();
            filesToUpload = [];
            renderPreviews();
            
        } catch (error) {
            feedbackMessage.textContent = error.message;
            feedbackMessage.style.color = 'red';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Produto';
        }
    });
});