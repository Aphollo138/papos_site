
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("blog-search-input");
  const postsContainer = document.getElementById("blog-posts-grid");
  const resultsCounter = document.getElementById("search-results-counter");

  if (!searchInput || !postsContainer) return;

  const BlogEngine = window.BlogEngine;
  if (!BlogEngine) {
    console.error("[Blog Search] Motor central do blog não foi carregado.");
    return;
  }

  
  let searchTimeout = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    const query = e.target.value;
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 250);
  });

  
  const searchButton = document.getElementById("blog-search-btn");
  if (searchButton) {
    searchButton.addEventListener("click", () => {
      performSearch(searchInput.value);
    });
  }

  function performSearch(query) {
    console.log(`[Blog Search] Buscando posts por: "${query}"`);
    const filteredPosts = BlogEngine.searchPosts(query);
    
    
    if (resultsCounter) {
      if (query.trim() === "") {
        resultsCounter.classList.add("d-none");
      } else {
        resultsCounter.classList.remove("d-none");
        resultsCounter.innerHTML = `Encontrado(s) <strong class="text-success">${filteredPosts.length}</strong> artigo(s) para "<span class="text-white">${query}</span>"`;
      }
    }

    
    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="p-4 border border-secondary rounded-4 bg-dark max-width-md mx-auto" style="max-width: 500px;">
            <i class="bi bi-search fs-1 text-secondary mb-3 d-block"></i>
            <h4 class="fw-bold text-white mb-2">Nenhum artigo encontrado</h4>
            <p class="text-secondary small mb-4">Não encontramos resultados para sua pesquisa. Tente usar outras palavras-chave ou explorar nossas categorias.</p>
            <button class="btn btn-sm btn-outline-light rounded-pill" onclick="document.getElementById('blog-search-input').value = ''; document.getElementById('blog-search-input').dispatchEvent(new Event('input'));">
              Limpar pesquisa
            </button>
          </div>
        </div>
      `;
      return;
    }

    let postsHtml = "";
    filteredPosts.forEach(post => {
      postsHtml += BlogEngine.buildPostCardHtml(post);
    });
    postsContainer.innerHTML = postsHtml;

    
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
