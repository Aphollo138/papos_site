
document.addEventListener("DOMContentLoaded", () => {
  const categoriesList = document.getElementById("blog-categories-list");
  const postsContainer = document.getElementById("blog-posts-grid");
  const currentCategoryTitle = document.getElementById("current-category-title");

  const BlogEngine = window.BlogEngine;
  if (!BlogEngine) return;

  
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

     
      const catPosts = BlogEngine.getPostsByCategory(catParam);
      renderFilteredPosts(catPosts);
    } else {
      
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

  
  if (categoriesList) {
    categoriesList.addEventListener("click", (e) => {
      const categoryLink = e.target.closest(".category-filter-item");
      if (!categoryLink) return;

      const slug = categoryLink.getAttribute("data-slug");
      if (!slug) return;

      
      if (window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/blog/")) {
        e.preventDefault();
        
        
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
