document.addEventListener("DOMContentLoaded", () => {
  checkAuth("admin");

  // Elementos da página principal
  const productListContainer = document.getElementById("product-list");
  const statusFilter = document.getElementById("status-filter");
  const massActionsBar = document.getElementById("mass-actions-bar");

  // Elementos do Modal
  const modal = document.getElementById("product-modal");
  const modalContent = document.getElementById("modal-content");
  const modalTitle = document.getElementById("modal-title");
  const formEdit = document.getElementById("form-edit-produto");
  const galleryContainer = document.getElementById("modal-gallery");
  const inputNovasImagens = document.getElementById("modal-imagens");
  const btnModalClose = document.getElementById("btn-modal-close");
  const btnModalSave = document.getElementById("btn-modal-save");
  const btnModalInactivate = document.getElementById("btn-modal-inactivate");
  const btnModalDelete = document.getElementById("btn-modal-delete");

  let currentStatus = "ativo";
  let selectedProducts = new Set();
  let fotosExistentes = [],
    fotosParaRemover = [],
    novasFotos = [];
  let sortableGallery = null;

  const formatCurrency = (value) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // --- CARREGAMENTO E RENDERIZAÇÃO DA LISTA ---
  async function loadProducts() {
    productListContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Carregando...</p>`;
    try {
      const response = await fetchWithAuth(
        `/api/produtos?status=${currentStatus}`
      );
      const produtos = await response.json();
      renderProducts(produtos);
    } catch (error) {
      productListContainer.innerHTML = `<p class="text-center text-red-500 mt-8">Erro ao carregar produtos.</p>`;
    }
  }

  function renderProducts(produtos) {
    productListContainer.innerHTML = "";
    if (produtos.length === 0) {
      productListContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Nenhum produto encontrado.</p>`;
      return;
    }
    produtos.forEach((p) => {
      const productCard = `<div class="flex items-center gap-4 bg-white rounded-lg p-4 shadow-sm cursor-pointer" data-id="${
        p.id
      }"><input type="checkbox" class="product-checkbox h-5 w-5 pointer-events-none"><img src="${
        p.foto_url || "https://via.placeholder.com/150"
      }" class="rounded-lg w-16 h-16 object-cover"><div class="flex-1"><p class="font-semibold">${
        p.nome
      }</p><p class="text-sm text-gray-500">SKU: ${
        p.codigo || "N/A"
      }</p><p class="font-bold text-blue-600 mt-1">${formatCurrency(
        parseFloat(p.preco)
      )}</p></div></div>`;
      productListContainer.insertAdjacentHTML("beforeend", productCard);
    });
  }

  // --- LÓGICA DO MODAL ---
  async function openModal(produtoId) {
    try {
      const response = await fetchWithAuth(`/api/produtos/${produtoId}`);
      const produto = await response.json();

      // Reseta o estado das imagens
      fotosExistentes = produto.fotos;
      fotosParaRemover = [];
      novasFotos = [];
      inputNovasImagens.value = "";

      // Preenche os campos do formulário
      modalTitle.textContent = `Editar: ${produto.nome}`;
      formEdit.querySelector("#edit-id").value = produto.id;
      formEdit.querySelector("#edit-nome").value = produto.nome;
      formEdit.querySelector("#edit-codigo").value = produto.codigo || "";
      formEdit.querySelector("#edit-preco").value = produto.preco;
      formEdit.querySelector("#edit-estoque").value = produto.estoque;
      formEdit.querySelector("#edit-categoria").value = produto.categoria || "";
      formEdit.querySelector("#edit-descricao").value = produto.descricao || "";

      renderModalGallery();

      // Configura os botões do modal
      btnModalInactivate.textContent =
        produto.status === "ativo" ? "Inativar" : "Ativar";

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    } catch (error) {
      alert("Erro ao carregar detalhes do produto.");
    }
  }

  function renderModalGallery() {
    galleryContainer.innerHTML = "";

    // Renderiza fotos existentes
    fotosExistentes
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((foto) => {
        galleryContainer.insertAdjacentHTML(
          "beforeend",
          `<div class="preview-image" data-id="${foto.id}"><img src="${foto.url}" class="w-full h-24 object-cover rounded-lg"><button type="button" class="remove-image" data-db-id="${foto.id}">&times;</button></div>`
        );
      });

    // Renderiza prévias de novas fotos
    novasFotos.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        galleryContainer.insertAdjacentHTML(
          "beforeend",
          `<div class="preview-image"><img src="${e.target.result}" class="w-full h-24 object-cover rounded-lg"><button type="button" class="remove-image" data-new-index="${index}">&times;</button></div>`
        );
      };
      reader.readAsDataURL(file);
    });

    // Inicializa o drag-and-drop
    if (sortableGallery) sortableGallery.destroy();
    sortableGallery = new Sortable(galleryContainer, { animation: 150 });
  }

  // --- EVENT LISTENERS ---
  productListContainer.addEventListener("click", (e) => {
    const card = e.target.closest("div[data-id]");
    if (e.target.type === "checkbox") {
      const id = e.target.dataset.id;
      // Lógica de seleção em massa
    } else if (card) {
      openModal(card.dataset.id);
    }
  });

  statusFilter.addEventListener("change", (e) => {
    currentStatus = e.target.value;
    statusFilter
      .querySelectorAll("label")
      .forEach((l) => l.classList.remove("active"));
    e.target.parentElement.classList.add("active");
    loadProducts();
  });

  // Fechar o modal
  btnModalClose.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target.id === "product-modal") modal.classList.add("hidden");
  });

  // Salvar alterações
  btnModalSave.addEventListener("click", async () => {
    const produtoId = formEdit.querySelector("#edit-id").value;
    const formData = new FormData();
    formData.append("nome", formEdit.querySelector("#edit-nome").value);
    formData.append("codigo", formEdit.querySelector("#edit-codigo").value);
    // Adicionar outros campos ao formData...
    formData.append("fotosParaRemover", JSON.stringify(fotosParaRemover));
    novasFotos.forEach((file) => formData.append("imagens", file));

    try {
      // 1. Envia a atualização dos dados e imagens
      await fetchWithAuth(`/api/produtos/${produtoId}`, {
        method: "PUT",
        body: formData,
      });

      // 2. Envia a nova ordem das fotos
      const newOrderIds = sortableGallery.toArray();
      await fetchWithAuth(`/api/produtos/${produtoId}/reorder-fotos`, {
        method: "PATCH",
        body: JSON.stringify({ fotosOrdenadas: newOrderIds }),
      });

      modal.classList.add("hidden");
      loadProducts();
    } catch (error) {
      alert("Erro ao salvar alterações.");
    }
  });

  // Demais ações do modal
  btnModalDelete.addEventListener("click", async () => {
    /* ...lógica de exclusão suave... */
  });
  btnModalInactivate.addEventListener("click", async () => {
    /* ...lógica de inativação... */
  });
  inputNovasImagens.addEventListener("change", (e) => {
    /* ...lógica de adicionar novas fotos... */
  });
  galleryContainer.addEventListener("click", (e) => {
    /* ...lógica de remover fotos... */
  });

  loadProducts();
});
