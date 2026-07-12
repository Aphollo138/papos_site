/**
 * blog-filter.js - Motor de Filtragem por Categorias e Tags para o Blog do Papos
 * 
 * Permite filtrar artigos dinamicamente por categorias no índice do blog,
 * além de guiar a visualização na página específica de categorias.
 */

document.addEventListener("DOMContentLoaded", () => {
  const categoriesList = document.getElementById("blog-categories-list");
  const postsContainer = document.getElementById("blog-posts-grid");
  const currentCategoryTitle = document.getElementById("current-category-title");

  const BlogEngine = window.BlogEngine;
  if (!BlogEngine) return;

  // Lógica para página de categorias (categoria.html)
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get("cat");

  if (catParam) {
    const matchedCategory = BlogEngine.getCategories().find(c => c.slug === catParam);
    if (matchedCategory) {
      if (currentCategoryTitle) {
        currentCategoryTitle.textContent = matchedCategory.name;
      }
      
      const categoryDesc = document.getElementById("current-category-description");
      if (categoryDesc) {
        categoryDesc.textContent = matchedCategory.description;
      }

      // Filtrar e renderizar posts da categoria
      const catPosts = BlogEngine.getPostsByCategory(catParam);
      renderFilteredPosts(catPosts);
    } else {
      // Se categoria não existe, mostra erro ou volta para índice
      if (postsContainer) {
        postsContainer.innerHTML = `
          <div class="col-12 text-center py-5">
            <h4 class="text-white">Categoria não encontrada</h4>
            <p class="text-secondary">Explore nossos artigos diretamente em nosso <a href="/blog/" class="text-success">índice do Blog</a>.</p>
          </div>
        `;
      }
    }
  }

  // Lógica para clique de categorias no Sidebar/Página do Blog
  if (categoriesList) {
    categoriesList.addEventListener("click", (e) => {
      const categoryLink = e.target.closest(".category-filter-item");
      if (!categoryLink) return;

      const slug = categoryLink.getAttribute("data-slug");
      if (!slug) return;

      // Se estiver no index.html, filtra dinamicamente em vez de recarregar
      if (window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/blog/")) {
        e.preventDefault();
        
        // Remove active class de todas as categorias
        categoriesList.querySelectorAll(".category-filter-item").forEach(el => el.classList.remove("active", "text-success"));
        categoryLink.classList.add("active", "text-success");

        const filtered = (slug === "all") ? BlogEngine.getPosts() : BlogEngine.getPostsByCategory(slug);
        renderFilteredPosts(filtered);
      }
    });
  }

  function renderFilteredPosts(posts) {
    if (!postsContainer) return;

    if (posts.length === 0) {
      postsContainer.innerHTML = `
        <div class="col-12 text-center py-5">
          <p class="text-secondary">Não há artigos publicados nesta categoria no momento.</p>
          <a href="/blog/" class="btn btn-sm btn-outline-light rounded-pill">Ver todos os artigos</a>
        </div>
      `;
      return;
    }

    let html = "";
    posts.forEach(post => {
      html += BlogEngine.buildPostCardHtml(post);
    });
    postsContainer.innerHTML = html;

    // Disparar redimensionamento e reinicialização das animações
    if ("IntersectionObserver" in window) {
      const revealElements = postsContainer.querySelectorAll(".scroll-reveal");
      const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            scrollObserver.unobserve(entry.target);
          }
        });
      }, { root: null, threshold: 0.05 });
      
      revealElements.forEach(el => scrollObserver.observe(el));
    }
  }
});
