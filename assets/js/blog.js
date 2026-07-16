
(function() {
  
  if (window.BLOG_ENGINE_INITIALIZED) return;
  window.BLOG_ENGINE_INITIALIZED = true;

  console.log("[Blog Engine] Inicializando portal de conteúdo integrado...");

  const BlogEngine = {
    getPosts() {
      return window.BLOG_POSTS || [];
    },

    getCategories() {
      return window.BLOG_CATEGORIES || [];
    },

    getRecentPosts(limit = 3) {
      return this.getPosts().slice(0, limit);
    },

    getPopularPosts(limit = 4) {
     
      return this.getPosts().filter((_, i) => i % 2 === 0).slice(0, limit);
    },

    getRelatedPosts(categorySlug, currentSlug, limit = 3) {
      return this.getPosts()
        .filter(p => p.categorySlug === categorySlug && p.slug !== currentSlug)
        .slice(0, limit);
    },

    getPostBySlug(slug) {
      return this.getPosts().find(p => p.slug === slug) || null;
    },

    getPostsByCategory(categorySlug) {
      return this.getPosts().filter(p => p.categorySlug === categorySlug);
    },

    searchPosts(query) {
      if (!query) return this.getPosts();
      const cleanQuery = query.toLowerCase().trim();
      return this.getPosts().filter(p => {
        return p.title.toLowerCase().includes(cleanQuery) ||
               p.description.toLowerCase().includes(cleanQuery) ||
               p.category.toLowerCase().includes(cleanQuery) ||
               p.tags.some(t => t.toLowerCase().includes(cleanQuery)) ||
               p.sections.some(s => s.title.toLowerCase().includes(cleanQuery) || s.content.toLowerCase().includes(cleanQuery));
      });
    },

    
    updateSEO(post) {
      if (!post) return;

      const fullTitle = `${post.title} | Blog Papos`;
      document.title = fullTitle;

     
      this.setMeta("description", post.description);
      
      
      let canonicalEl = document.querySelector("link[rel='canonical']");
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      const canonicalUrl = `https://papo.net.br/blog/artigo.html?slug=${post.slug}`;
      canonicalEl.setAttribute("href", canonicalUrl);

      
      this.setMetaProperty("og:type", "article");
      this.setMetaProperty("og:title", fullTitle);
      this.setMetaProperty("og:description", post.description);
      this.setMetaProperty("og:url", canonicalUrl);
      this.setMetaProperty("og:image", post.image);

      
      this.setMeta("twitter:card", "summary_large_image");
      this.setMeta("twitter:title", fullTitle);
      this.setMeta("twitter:description", post.description);
      this.setMeta("twitter:image", post.image);

      
      const oldSchemas = document.querySelectorAll("script[data-schema='blog']");
      oldSchemas.forEach(el => el.remove());

      
      const articleSchema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.description,
        "image": post.image,
        "datePublished": post.dateIso,
        "dateModified": post.dateIso,
        "author": {
          "@type": "Person",
          "name": post.author
        },
        "publisher": {
          "@type": "Organization",
          "name": "Papos",
          "url": "https://papo.net.br/",
          "logo": {
            "@type": "ImageObject",
            "url": "https://papos.net.br/favicon.svg"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl
        }
      };

      const articleScript = document.createElement("script");
      articleScript.type = "application/ld+json";
      articleScript.setAttribute("data-schema", "blog");
      articleScript.textContent = JSON.stringify(articleSchema);
      document.head.appendChild(articleScript);

      
      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Papos",
            "item": "https://papo.net.br/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Blog",
            "item": "https://papo.net.br/blog/"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": post.category,
            "item": `https://papo.net.br/blog/categoria.html?cat=${post.categorySlug}`
          },
          {
            "@type": "ListItem",
            "position": 4,
            "name": post.title,
            "item": canonicalUrl
          }
        ]
      };

      const breadcrumbScript = document.createElement("script");
      breadcrumbScript.type = "application/ld+json";
      breadcrumbScript.setAttribute("data-schema", "blog");
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
      document.head.appendChild(breadcrumbScript);

      
      if (post.faq && post.faq.length > 0) {
        const faqSchema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": post.faq.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": f.answer
            }
          }))
        };

        const faqScript = document.createElement("script");
        faqScript.type = "application/ld+json";
        faqScript.setAttribute("data-schema", "blog");
        faqScript.textContent = JSON.stringify(faqSchema);
        document.head.appendChild(faqScript);
      }
    },

    setMeta(name, content) {
      let el = document.querySelector(`meta[name='${name}']`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    },

    setMetaProperty(property, content) {
      let el = document.querySelector(`meta[property='${property}']`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    },

    
    renderTOC() {
      const tocContainer = document.getElementById("auto-toc-container");
      if (!tocContainer) return;

      const contentArea = document.getElementById("post-body-content");
      if (!contentArea) return;

      const headings = contentArea.querySelectorAll("h2");
      if (headings.length === 0) {
        tocContainer.parentElement.style.display = "none";
        return;
      }

      let tocHtml = `<ul class="list-unstyled d-flex flex-column gap-2 mb-0">`;
      headings.forEach((heading, index) => {
        const id = `toc-heading-${index}`;
        heading.id = id;
        tocHtml += `
          <li>
            <a href="#${id}" class="toc-link text-decoration-none d-block small py-1 text-secondary" style="transition: var(--transition-smooth);">
              <i class="bi bi-chevron-right me-1 small opacity-50"></i> ${heading.textContent}
            </a>
          </li>
        `;
      });
      tocHtml += `</ul>`;
      tocContainer.innerHTML = tocHtml;

      
      tocContainer.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const targetId = link.getAttribute("href");
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            const headerOffset = 90;
            const elementPosition = targetEl.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: "smooth"
            });
          }
        });
      });
    },

    
    buildPostCardHtml(post) {
      return `
        <div class="col-md-6 col-lg-4 scroll-reveal">
          <article class="card h-100 border border-secondary bg-dark overflow-hidden position-relative d-flex flex-column" style="transition: transform 0.3s ease, border-color 0.3s ease;">
            <div class="position-relative overflow-hidden" style="height: 200px; background-color: var(--surface);">
              <img src="${post.image}" class="w-100 h-100 object-fit-cover" alt="${post.title}" loading="lazy" />
              <span class="position-absolute top-3 start-3 badge bg-primary text-white py-1.5 px-3 rounded-pill fw-medium small" style="z-index: 10;">
                ${post.category}
              </span>
            </div>
            
            <div class="card-body p-4 d-flex flex-column flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-2 text-secondary small" style="font-size: 0.8rem;">
                <time datetime="${post.dateIso}">${post.date}</time>
                <span>&bull;</span>
                <span>${post.readTime}</span>
              </div>
              
              <h3 class="h5 fw-bold text-white mb-2 line-clamp-2" style="letter-spacing: -0.5px;">
                <a href="/blog/artigo.html?slug=${post.slug}" class="text-decoration-none text-white hover:text-success" style="transition: color 0.2s;">
                  ${post.title}
                </a>
              </h3>
              
              <p class="text-secondary small mb-4 line-clamp-3">
                ${post.description}
              </p>
              
              <div class="mt-auto d-flex align-items-center justify-content-between pt-3 border-top border-secondary">
                <span class="text-secondary small">Por <strong>${post.author}</strong></span>
                <a href="/blog/artigo.html?slug=${post.slug}" class="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1 py-1.5 px-3 rounded-pill" style="font-size: 0.78rem;">
                  Ler artigo <i class="bi bi-arrow-right-short fs-6"></i>
                </a>
              </div>
            </div>
          </article>
        </div>
      `;
    }
  };

  
  window.BlogEngine = BlogEngine;

})();
