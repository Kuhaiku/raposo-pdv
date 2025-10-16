document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin');

    const form = document.getElementById('form-produto');
    const inputImagens = document.getElementById('imagens');
    const previewsContainer = document.getElementById('previews');
    const feedbackMessage = document.getElementById('feedback-message');
    let filesToUpload = [];

    inputImagens.addEventListener('change', (e) => {
        filesToUpload = Array.from(e.target.files);
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
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackMessage.textContent = '';
        
        const formData = new FormData();
        formData.append('nome', document.getElementById('nome').value);
        formData.append('codigo', document.getElementById('codigo').value);
        formData.append('preco', document.getElementById('preco').value);
        formData.append('estoque', document.getElementById('estoque').value);
        formData.append('categoria', document.getElementById('categoria').value);
        formData.append('descricao', document.getElementById('descricao').value);
        
        filesToUpload.forEach(file => {
            formData.append('imagens', file);
        });

        try {
            // fetchWithAuth precisa ser adaptado para lidar com FormData
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/produtos', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
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
        }
    });
});