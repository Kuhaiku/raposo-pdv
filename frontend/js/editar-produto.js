document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin');

    const form = document.getElementById('form-produto');
    const feedbackMessage = document.getElementById('feedback-message');
    const btnExcluir = document.getElementById('btn-excluir');
    const inputImagens = document.getElementById('imagens');
    const previewsContainer = document.getElementById('previews');
    
    let fotosExistentes = [];
    let fotosParaRemover = [];
    let novasFotos = [];

    const urlParams = new URLSearchParams(window.location.search);
    const produtoId = urlParams.get('id');

    if (!produtoId) {
        window.location.href = '/produtos.html';
        return;
    }

    async function loadProductData() {
        try {
            const response = await fetchWithAuth(`/api/produtos/${produtoId}`);
            if (!response.ok) throw new Error('Produto não encontrado');
            const produto = await response.json();
            
            document.getElementById('nome').value = produto.nome;
            document.getElementById('codigo').value = produto.codigo || '';
            document.getElementById('preco').value = produto.preco;
            document.getElementById('estoque').value = produto.estoque;
            document.getElementById('categoria').value = produto.categoria || '';
            document.getElementById('descricao').value = produto.descricao || '';
            
            fotosExistentes = produto.fotos;
            renderPreviews();
        } catch (error) {
            console.error(error);
            feedbackMessage.textContent = "Erro ao carregar dados do produto.";
            feedbackMessage.style.color = 'red';
        }
    }

    function renderPreviews() {
        previewsContainer.innerHTML = '';
        
        fotosExistentes.forEach(foto => {
            const previewDiv = `<div class="preview-image"><img src="${foto.url}" class="w-full h-24 object-cover rounded-lg"><button type="button" class="remove-image" data-db-id="${foto.id}">&times;</button></div>`;
            previewsContainer.insertAdjacentHTML('beforeend', previewDiv);
        });

        novasFotos.forEach((file, index) => {
             const reader = new FileReader();
            reader.onload = (e) => {
                 const previewDiv = `<div class="preview-image"><img src="${e.target.result}" class="w-full h-24 object-cover rounded-lg"><button type="button" class="remove-image" data-new-index="${index}">&times;</button></div>`;
                 previewsContainer.insertAdjacentHTML('beforeend', previewDiv);
            };
            reader.readAsDataURL(file);
        });
    }

    inputImagens.addEventListener('change', (e) => {
        novasFotos.push(...Array.from(e.target.files));
        renderPreviews();
    });

    previewsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-image')) {
            const dbId = e.target.dataset.dbId;
            const newIndex = e.target.dataset.newIndex;
            
            if (dbId) {
                const fotoParaRemover = fotosExistentes.find(f => f.id == dbId);
                if (fotoParaRemover) {
                    fotosParaRemover.push(fotoParaRemover);
                    fotosExistentes = fotosExistentes.filter(f => f.id != dbId);
                }
            } else if (newIndex) {
                novasFotos.splice(parseInt(newIndex, 10), 1);
            }
            renderPreviews();
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
        formData.append('fotosParaRemover', JSON.stringify(fotosParaRemover));
        
        novasFotos.forEach(file => {
            formData.append('imagens', file);
        });

        try {
            const response = await fetchWithAuth(`/api/produtos/${produtoId}`, {
                method: 'PUT',
                body: formData
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            alert('Produto atualizado com sucesso!');
            window.location.href = '/produtos.html';

        } catch (error) {
            feedbackMessage.textContent = error.message;
            feedbackMessage.style.color = 'red';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Alterações';
        }
    });

    btnExcluir.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja MOVER este produto para a lixeira?')) {
            try {
                const response = await fetchWithAuth(`/api/produtos/${produtoId}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message);
                window.location.href = '/produtos.html';
            } catch (error) {
                alert(error.message);
            }
        }
    });

    loadProductData();
});