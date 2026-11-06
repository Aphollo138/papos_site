# ChatOnline - Plataforma de Salas de Bate-Papo em Tempo Real

Este é um projeto completo, responsivo e ultra moderno de salas de bate-papo online, construído utilizando **HTML5 semântico**, **CSS personalizado**, **JavaScript puro (Vanilla)** e **Bootstrap 5** para estilização.

A plataforma simula perfeitamente uma aplicação de bate-papo de alta performance (como Slack ou Discord) sem a necessidade de um backend dedicado, persistindo todas as informações diretamente no navegador do usuário por meio do **LocalStorage**.

---

## 📂 Estrutura de Pastas Organizada

O projeto está estruturado de acordo com as melhores práticas de modularização para desenvolvimento web puro:

```text
/
├── index.html               # Landing page principal e entrada do usuário
├── README.md                # Documentação técnica do projeto
├── package.json             # Dependências e scripts do servidor de desenvolvimento
├── vite.config.ts           # Configurações de build do Vite (Multi-page App)
├── metadata.json            # Metadados do aplicativo para a plataforma
├── pages/
│   ├── chat.html            # Interface de bate-papo integrada com barra lateral
│   ├── rooms.html           # Seleção de salas e ferramenta para criar novos canais
│   └── profile.html         # Página de edição de perfil e estatísticas de uso
└── assets/
    ├── css/
    │   └── style.css        # Estilos globais personalizados e variáveis de design
    └── js/
        ├── main.js          # Motor de estado global, persistência e utilitários
        ├── rooms.js         # Lógica de renderização de salas e buscador dinâmico
        └── chat.js          # Logica interativa de conversações e bot conversador
```

---

## 🌟 Funcionalidades Principais

*   **Identificação Anônima**: O usuário escolhe um apelido para entrar na rede. O apelido é armazenado de forma segura no `LocalStorage` do navegador, eliminando a necessidade de cadastros lentos ou senhas.
*   **Diretório de Salas**: Listagem de canais ativos sobre diferentes temas. Inclui indicadores fakes de usuários ativos para trazer energia visual ao projeto.
*   **Buscador Instantâneo**: Filtro em tempo real na página de salas, permitindo pesquisar canais enquanto digita.
*   **Criação de Canais Locais**: Um modal integrado permite criar novas salas de chat com nome e descrição personalizada. A nova sala é anexada ao armazenamento local imediatamente.
*   **Histórico de Conversas**: Mensagens são organizadas por sala e salvas no `LocalStorage`. O chat possui rolagem automática inteligente para manter o usuário sempre focado nas mensagens mais recentes.
*   **Interações Vivas (Bot Simulado)**: Para simular uma rede de chat movimentada e divertida, personagens virtuais fakes (como *Ana Silva*, *Carlos Dev*, *Mariana Tech*) enviam respostas automáticas contextualizadas de acordo com o que você digita!
*   **Indicador de Digitação**: O chat simula os bots digitando, exibindo balões com animações de pulsação suaves antes que a resposta seja entregue.
*   **Limpeza e Privacidade**: Botões integrados na barra de cabeçalho do chat permitem apagar todo o histórico de conversas locais de forma simples. No perfil, o usuário pode redefinir o site por completo.
*   **Perfil Customizável**: Modifique seu nickname e veja um avatar com gradiente de cor vibrante que se atualiza em tempo real enquanto você digita cada letra.

---

## 🎨 Design Premium & Experiência do Usuário

*   **Paleta de Cores Slate**: Base off-white confortável com realces profundos de cinzas, azuis ardósia e gradientes premium (púrpura a rosa).
*   **Tipografia Selecionada**: Títulos dinâmicos com a fonte estilizada *Outfit* e textos corporativos legíveis com a família *Inter*. Elementos técnicos utilizam *JetBrains Mono*.
*   **Responsividade Extrema**: A barra lateral de canais no chat converte-se em um drawer móvel de fácil acesso em telas menores, garantindo conforto em celulares e tablets.
*   **Custom Scrollbar**: Barras de rolagem discretas e estilizadas para manter a elegância da interface.

---

## 🔍 Otimização de SEO (Search Engine Optimization)

O site foi estruturado para maximizar sua indexação e amigabilidade em motores de busca como o Google, contendo:

1.  **Metadados Robustos**: Tags `<title>`, `<meta name="description">` e `<meta name="keywords">` preenchidas meticulosamente com termos de alta busca (*chat online*, *salas de bate-papo*, *conversar online*, *conhecer pessoas*, *bate-papo grátis*, *chat anônimo*).
2.  **Open Graph (OG) & Twitter Cards**: Tags para pré-visualização enriquecida com belas imagens de alta resolução ao compartilhar os links em redes sociais (Facebook, Twitter, WhatsApp, Telegram).
3.  **HTML5 Semântico**: Estruturação baseada exclusivamente em tags semânticas corretas: `<header>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<nav>` e `<footer>`.
4.  **Acessibilidade e Usabilidade**: Contraste aprimorado, fontes fluídas baseadas em rems, e atributos `alt` textuais para leitores de tela em todas as imagens.

---

## 🚀 Como Executar o Projeto

Você tem duas maneiras muito fáceis de visualizar o projeto em funcionamento:

### Opção 1: Servidor Local de Alta Performance (Vite)
Se você estiver utilizando este workspace ou quiser rodar em ambiente Node:
1.  Instale os pacotes necessários:
    ```bash
    npm install
    ```
2.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
3.  Abra o navegador em `http://localhost:3000`.

### Opção 2: Abertura Direta em Navegador
Por se tratar de um projeto construído com HTML, CSS e JavaScript puros sem compilações obrigatórias para execução cliente:
1.  Navegue até a pasta raiz do projeto.
2.  Dê um duplo clique no arquivo `index.html` para abrir diretamente em qualquer navegador moderno.

---

## 🛠️ Tecnologias Utilizadas

*   **HTML5** (Marcação Semântica)
*   **CSS3** (Variáveis customizadas, animações bezier, gradientes)
*   **JavaScript (ES6+)** (Persistência, manipulação rica do DOM, temporizadores)
*   **Bootstrap 5** (Layout flexbox responsivo e utilitários)
*   **Bootstrap Icons** (Ícones vetoriais modernos)
*   **Google Fonts** (Fontes elegantes *Inter*, *Outfit* e *JetBrains Mono*)
