/**
 * Script Principal de la Web Personal de Lluís Galindo
 * Arquitectura única: i18n dinámico mediante JSON, Dark Mode, Ask AI y utilidades interactivas.
 */

// Caché de traducciones para evitar peticiones repetidas
const cacheTraduccions = {};

// Idioma actualmente activo
let idiomaActual = 'es';

// Tema actual de Ask AI
let askAiCurrentTopic = null;

/**
 * Función principal para cambiar de idioma
 * @param {string} idioma - 'es' | 'ca' | 'en'
 */
async function canviarIdioma(idioma) {
  if (!['es', 'ca', 'en'].includes(idioma)) {
    idioma = 'es';
  }

  try {
    let traduccions = cacheTraduccions[idioma];

    if (!traduccions) {
      try {
        const resposta = await fetch(`lang/${idioma}.json`);
        if (!resposta.ok) throw new Error(`HTTP error! status: ${resposta.status}`);
        traduccions = await resposta.json();
      } catch (fetchErr) {
        console.warn("fetch falló (probable protocolo file://), comprobando fallback local:", fetchErr);
        if (window.__TRANSLATIONS__ && window.__TRANSLATIONS__[idioma]) {
          traduccions = window.__TRANSLATIONS__[idioma];
        } else {
          throw fetchErr;
        }
      }
      cacheTraduccions[idioma] = traduccions;
    }

    idiomaActual = idioma;

    // 1. Reemplazar texto en todos los elementos con [data-i18n]
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const clau = element.getAttribute('data-i18n');
      if (traduccions[clau] !== undefined) {
        const text = traduccions[clau];
        if (text.includes('<') && text.includes('>')) {
          element.innerHTML = text;
        } else {
          element.textContent = text;
        }
      }
    });

    // 2. Reemplazar atributos dinámicos con [data-i18n-attr]
    // Sintaxis: data-i18n-attr="title:clau,aria-label:clau,placeholder:clau"
    const elementsAttr = document.querySelectorAll('[data-i18n-attr]');
    elementsAttr.forEach(element => {
      const attrDefs = element.getAttribute('data-i18n-attr').split(',');
      attrDefs.forEach(pair => {
        const [attr, clau] = pair.split(':').map(s => s.trim());
        if (attr && clau && traduccions[clau] !== undefined) {
          element.setAttribute(attr, traduccions[clau]);
        }
      });
    });

    // 3. Actualizar metadatos de la página
    if (traduccions.page_title) {
      document.title = traduccions.page_title;
    }
    if (traduccions.page_description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', traduccions.page_description);
    }

    // 4. Actualizar estado activo en los botones del selector
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
      const btnLang = btn.getAttribute('data-lang');
      if (btnLang === idioma) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'true');
      } else {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      }
    });

    // 5. Guardar preferencia en localStorage y atributo lang del documento
    localStorage.setItem('idioma_preferit', idioma);
    document.documentElement.lang = idioma;

    // 6. Actualizar widget Ask AI si hay un tema abierto
    if (askAiCurrentTopic) {
      actualitzarAskAi(traduccions);
    }

  } catch (error) {
    console.error("Error carregant l'idioma:", error);
  }
}

// Hacer la función accesible globalmente para atributos onclick
window.canviarIdioma = canviarIdioma;

/**
 * Gestión del Tema Oscuro (Dark Mode)
 */
function inicialitzarDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const body = document.body;
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }

  const updateThemeColor = (isDark) => {
    metaTheme.setAttribute('content', isDark ? '#141413' : '#fbfaf7');
  };

  const updateIcon = (isDark) => {
    if (!darkModeToggle) return;
    const sunIcon = darkModeToggle.querySelector('.sun-icon');
    const moonIcon = darkModeToggle.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = isDark ? 'none' : 'block';
      moonIcon.style.display = isDark ? 'block' : 'none';
    }
  };

  // lnkiai.com utilitza sempre el fons clar (#fbfaf7).
  // No s'activa el mode fosc automàticament pel sistema operatiu (prefers-color-scheme).
  // Si hi havia un valor 'dark' guardat anteriorment de proves, el netegem per defecte.
  if (localStorage.getItem('theme') === 'dark') {
    localStorage.removeItem('theme');
  }

  body.classList.remove('dark-mode');
  updateIcon(false);
  updateThemeColor(false);

  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      const isNowDark = body.classList.toggle('dark-mode');
      updateIcon(isNowDark);
      updateThemeColor(isNowDark);
      localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
    });
  }
}

/**
 * Widget Flotante "Ask AI"
 */
function inicialitzarAskAi() {
  const widget = document.getElementById('askAiWidget');
  const trigger = document.getElementById('askAiTrigger');
  const pop = document.getElementById('askAiPop');
  const closeBtn = document.getElementById('askAiClose');
  const copyBtn = document.getElementById('askAiCopyPrompt');
  const copyText = document.getElementById('copyPromptText');
  const chips = document.querySelectorAll('.askai-chip');

  if (!trigger || !pop) return;

  if (widget) {
    setTimeout(() => {
      widget.classList.add('is-visible');
    }, 400);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.classList.remove('open');
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      askAiCurrentTopic = chip.getAttribute('data-topic');
      const traduccions = cacheTraduccions[idiomaActual];
      if (traduccions) {
        actualitzarAskAi(traduccions);
      }
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const traduccions = cacheTraduccions[idiomaActual] || {};
      const promptText = traduccions.askai_prompt_text || '';
      try {
        await navigator.clipboard.writeText(promptText);
        if (copyText) {
          const prev = copyText.textContent;
          copyText.textContent = traduccions.askai_copied || '¡Prompt copiado!';
          setTimeout(() => {
            copyText.textContent = prev;
          }, 2200);
        }
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    });
  }

  // Cerrar al hacer clic fuera del popover
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && !trigger.contains(e.target)) {
      pop.classList.remove('open');
    }
  });
}

function actualitzarAskAi(traduccions) {
  const answerEl = document.getElementById('askAiAnswer');
  if (!answerEl || !askAiCurrentTopic) return;

  const keyMap = {
    experience: 'askai_answer_exp',
    skills: 'askai_answer_skills',
    ai: 'askai_answer_ai',
    contact: 'askai_answer_contact'
  };

  const answerKey = keyMap[askAiCurrentTopic] || 'askai_answer_exp';
  answerEl.innerHTML = traduccions[answerKey] || '';
  answerEl.classList.add('show');
}

/**
 * Interacción de copiado rápido de correo electrónico
 */
function inicialitzarCopiaEmail() {
  const copyBtn = document.getElementById('copyEmailBtn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = 'llgalindoe@outlook.com';
    const traduccions = cacheTraduccions[idiomaActual] || {};
    try {
      await navigator.clipboard.writeText(email);
      const span = copyBtn.querySelector('.copy-feedback');
      if (span) {
        const prevText = span.textContent;
        span.textContent = traduccions.social_copied || '¡Copiado!';
        span.style.color = '#3ECF8E';
        setTimeout(() => {
          span.textContent = prevText;
          span.style.color = '';
        }, 2200);
      }
    } catch (err) {
      window.location.href = `mailto:${email}`;
    }
  });
}

/**
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  inicialitzarDarkMode();
  inicialitzarAskAi();
  inicialitzarCopiaEmail();

  // Detecta el idioma guardado, o el del navegador, o por defecto 'es'
  const navLang = (navigator.language || 'es').split('-')[0];
  const defaultLang = ['es', 'ca', 'en'].includes(navLang) ? navLang : 'es';
  const idiomaInicial = localStorage.getItem('idioma_preferit') || defaultLang;

  canviarIdioma(idiomaInicial);
});

// Fallback local embebido para soporte fuera de servidor (file://)
window.__TRANSLATIONS__ = {
  "es": {
    "page_title": "Lluís Galindo · Fullstack Developer & Project Manager",
    "page_description": "Sitio web personal de Lluís Galindo, Fullstack Developer & Project Manager. Proyectos, trayectoria, cheatsheets y stack tecnológico moderno.",
    "lang_selector_aria": "Selector de idioma",
    "hero_title": "Lluís Galindo",
    "hero_role": "Fullstack Developer & Project Manager",
    "hero_status": "Disponible para proyectos",
    "hero_contact_btn": "Contacto",
    "hero_bio_p1": "Desarrollador full-stack y project manager especializado en soluciones web modernas, arquitecturas escalables y flujos de trabajo impulsados por IA. Con más de 20 años en el sector IT combinando liderazgo técnico, desarrollo de software y docencia.",
    "hero_bio_p2": "Especializado en el ecosistema <strong>JavaScript / TypeScript</strong>, <strong>React</strong>, <strong>Node.js</strong> y bases de datos relacionales y NoSQL, con foco en clean code, rendimiento y experiencia de usuario.",
    "featured_eyebrow": "Proyecto Destacado",
    "featured_badge": "Arquitectura & Desarrollo",
    "featured_title": "Plataforma Web Moderna & Workflows IA",
    "featured_desc": "Diseño e implementación de arquitectura web completa orientada a performance, accesibilidad y modularidad. Integración de tooling inteligente y pipelines automatizados con agentes de programación.",
    "featured_tag1": "Fullstack",
    "featured_tag2": "AI Tooling",
    "featured_tag3": "Clean Code",
    "featured_metric_exp": "20+ años IT",
    "featured_metric_companies": "Buff · Smith&Nephew",
    "featured_metric_role": "Lead Instructor",
    "timeline_eyebrow": "Trayectoria",
    "timeline_job1_when": "2024 - Act.",
    "timeline_job1_role": "Project Manager & Lead Instructor",
    "timeline_job1_company": "Winfor · Software & Formación",
    "timeline_job1_desc": "Dirección de proyectos de software y docencia técnica fullstack (React, Node, Express, MongoDB, Supabase). Formación de nuevos perfiles IT y mentoría técnica.",
    "timeline_job2_when": "2022 - 2024",
    "timeline_job2_role": "I.T. Infrastructures Lead",
    "timeline_job2_company": "Buff · Estrategia Digital",
    "timeline_job2_desc": "Liderazgo de infraestructuras IT, optimización de sistemas críticos y despliegue de soluciones tecnológicas alineadas con los objetivos de negocio.",
    "timeline_job3_when": "2019 - 2022",
    "timeline_job3_role": "Technical Coordinator & Systems",
    "timeline_job3_company": "Smith&Nephew · Soluciones Digitales",
    "timeline_job3_desc": "Liderazgo técnico en sistemas y Backup.",
    "timeline_job3_achieve": "Trabajo en equipos internacionales coordinando sistemas en 3 continentes.",
    "skills_eyebrow": "Skills & Stack",
    "cheatsheet_html5_title": "HTML5",
    "cheatsheet_html5_desc": "Estructura semántica, accesibilidad y tips fundamentales.",
    "cheatsheet_html5_badge": "PDF · Sprint 1",
    "cheatsheet_css3_title": "CSS3",
    "cheatsheet_css3_desc": "Layouts con Flexbox, Grid, variables y trucos de diseño.",
    "cheatsheet_css3_badge": "PDF · Sprint 2",
    "cheatsheet_claude_title": "Claude Code Guide",
    "cheatsheet_claude_desc": "Guía de uso y funcionamiento de agentes de IA en CLI.",
    "cheatsheet_claude_badge": "Documento · Pages",
    "cheatsheet_fullstack_title": "Fullstack Cheatsheet",
    "cheatsheet_fullstack_desc": "APIs, bases de datos y patrones de backend moderno.",
    "cheatsheet_fullstack_badge": "PDF · Sprint 5",
    "skill_react_title": "React",
    "skill_react_desc": "Componentes funcionales, hooks personalizados, estado reactivo y construcción de Single Page Applications (SPAs).",
    "skill_react_badge": "Frontend",
    "skill_supabase_title": "Supabase",
    "skill_supabase_desc": "Backend-as-a-Service basado en PostgreSQL, autenticación de usuarios, APIs generadas al vuelo y realtime subscriptions.",
    "skill_supabase_badge": "BaaS / SQL",
    "skill_mongodb_title": "MongoDB",
    "skill_mongodb_desc": "Base de datos no relacional orientada a documentos BSON, diseño de esquemas flexibles y modelado con Mongoose.",
    "skill_mongodb_badge": "NoSQL",
    "skill_node_title": "Node",
    "skill_node_desc": "Entorno de ejecución backend con JavaScript, desarrollo de APIs RESTful escalables, Express.js y microservicios.",
    "skill_node_badge": "Backend",
    "skills_more_title": "Otras tecnologías & herramientas",
    "skill_chip_js_name": "JavaScript",
    "skill_chip_js_tag": "Lenguaje",
    "skill_chip_js_title": "ES6+, manipulación del DOM, programación funcional, fetch API y asincronía.",
    "skill_chip_ts_name": "TypeScript",
    "skill_chip_ts_tag": "Tipado",
    "skill_chip_ts_title": "Tipado estático para JavaScript, interfaces y mayor robustez en proyectos grandes.",
    "skill_chip_html_name": "HTML5",
    "skill_chip_html_tag": "Frontend",
    "skill_chip_html_title": "Estructura semántica, accesibilidad web (a11y) y SEO técnico.",
    "skill_chip_css_name": "CSS3",
    "skill_chip_css_tag": "Estilos",
    "skill_chip_css_title": "Flexbox, Grid, custom properties, responsive design y animaciones modernas.",
    "skill_chip_git_name": "Git",
    "skill_chip_git_tag": "Tooling",
    "skill_chip_git_title": "Control de versiones distribuido, branching y flujos de trabajo colaborativos.",
    "skill_chip_docker_name": "Docker",
    "skill_chip_docker_tag": "DevOps",
    "skill_chip_docker_title": "Contenedores para entornos de desarrollo consistentes y despliegue continuo.",
    "skill_chip_tailwind_name": "Tailwind CSS",
    "skill_chip_tailwind_tag": "Estilos",
    "skill_chip_tailwind_title": "Framework utility-first para diseño de interfaces ágiles y sistemas de diseño.",
    "skill_chip_next_name": "Next.js",
    "skill_chip_next_tag": "Framework",
    "skill_chip_next_title": "Renderizado híbrido SSR/SSG, enrutamiento basado en archivos y optimización fullstack.",
    "social_eyebrow": "Contacto & Redes",
    "social_write_msg": "Escribir mensaje",
    "social_copy_email": "Copiar correo",
    "social_copied": "¡Copiado!",
    "footer_copy": "© 2026 Lluís Galindo · Fullstack Developer & PM",
    "footer_theme": "Cambiar tema",
    "footer_contact": "Contacto",
    "askai_btn_label": "Preguntar a IA",
    "askai_title": "Ask AI · Lluís Galindo",
    "askai_desc": "Descubre detalles sobre el perfil, trayectoria y especialidad de Lluís:",
    "askai_chip_exp": "💼 Experiencia y liderazgo IT",
    "askai_chip_skills": "💻 Stack técnico y metodologías",
    "askai_chip_ai": "🤖 IA aplicada al desarrollo",
    "askai_chip_contact": "✉️ Colaboraciones y contacto",
    "askai_copy_prompt": "Copiar prompt para ChatGPT / Claude",
    "askai_copied": "¡Prompt copiado!",
    "askai_answer_exp": "Lluís cuenta con más de 20 años de experiencia en IT, habiendo liderado infraestructuras en <b>Buff</b>, proyectos estratégicos en <b>Smith&Nephew</b> y gestión/docencia en <b>Winfor</b>. Su perfil une visión de negocio, arquitectura de sistemas y gestión de equipos.",
    "askai_answer_skills": "Especializado en JavaScript/TypeScript, React, Supabase, MongoDB, Node.js, Express, HTML5, CSS3, Docker y Git. Destaca en clean code, arquitectura escalable y buenas prácticas devops.",
    "askai_answer_ai": "Actualmente enfoca su energía en la integración de Inteligencia Artificial aplicada al ciclo de vida del software: tooling automatizado, agentes, prompt engineering estructurado y aceleración de entregas.",
    "askai_answer_contact": "Lluís está disponible para proyectos de desarrollo fullstack, consultoría tecnológica y formación. Puedes contactarle directamente en <a href='mailto:llgalindoe@outlook.com' style='text-decoration:underline; font-weight:600;'>llgalindoe@outlook.com</a>.",
    "askai_prompt_text": "Eres un asistente que evalúa el perfil profesional de Lluís Galindo.\nContexto:\n- Nombre: Lluís Galindo (@lluisgalindo)\n- Rol: Fullstack Developer & IT Systems / Project Manager\n- Experiencia: Más de 20 años en IT (Buff, Winfor, Smith&Nephew, The Bridge, Netmind).\n- Stack clave: React, Supabase, MongoDB, Node.js, JavaScript, TypeScript, Docker.\n- Enfoque: Arquitectura web escalable, desarrollo frontend & backend moderno, clean code e IA aplicada al desarrollo de software."
  },
  "ca": {
    "page_title": "Lluís Galindo · Fullstack Developer & Project Manager",
    "page_description": "Lloc web personal de Lluís Galindo, Fullstack Developer & Project Manager. Projectes, trajectòria, cheatsheets i stack tecnològic modern.",
    "lang_selector_aria": "Selector d'idioma",
    "hero_title": "Lluís Galindo",
    "hero_role": "Fullstack Developer & Project Manager",
    "hero_status": "Disponible per a projectes",
    "hero_contact_btn": "Contacte",
    "hero_bio_p1": "Desenvolupador full-stack i project manager especialitzat en solucions web modernes, arquitectures escalables i fluxos de treball impulsats per IA. Amb més de 20 anys en el sector IT combinant lideratge tècnic, desenvolupament de programari i docència.",
    "hero_bio_p2": "Especialitzat en l'ecosistema <strong>JavaScript / TypeScript</strong>, <strong>React</strong>, <strong>Node.js</strong> i bases de dades relacionals i NoSQL, amb focus en clean code, rendiment i experiència d'usuari.",
    "featured_eyebrow": "Projecte Destacat",
    "featured_badge": "Arquitectura & Desenvolupament",
    "featured_title": "Plataforma Web Moderna & Workflows IA",
    "featured_desc": "Disseny i implementació d'arquitectura web completa orientada a performance, accessibilitat i modularitat. Integració de tooling intel·ligent i pipelines automatitzats amb agents de programació.",
    "featured_tag1": "Fullstack",
    "featured_tag2": "AI Tooling",
    "featured_tag3": "Clean Code",
    "featured_metric_exp": "20+ anys IT",
    "featured_metric_companies": "Buff · Smith&Nephew",
    "featured_metric_role": "Lead Instructor",
    "timeline_eyebrow": "Trajectòria",
    "timeline_job1_when": "2024 - Act.",
    "timeline_job1_role": "Project Manager & Lead Instructor",
    "timeline_job1_company": "Winfor · Software & Formació",
    "timeline_job1_desc": "Direcció de projectes de programari i docència tècnica fullstack (React, Node, Express, MongoDB, Supabase). Formació de nous perfils IT i mentoria tècnica.",
    "timeline_job2_when": "2022 - 2024",
    "timeline_job2_role": "I.T. Infrastructures Lead",
    "timeline_job2_company": "Buff · Estratègia Digital",
    "timeline_job2_desc": "Lideratge d'infraestructures IT, optimització de sistemes crítics i desplegament de solucions tecnològiques alineades amb els objectius de negoci.",
    "timeline_job3_when": "2019 - 2022",
    "timeline_job3_role": "Technical Coordinator & Systems",
    "timeline_job3_company": "Smith&Nephew · Solucions Digitals",
    "timeline_job3_desc": "Lideratge tècnic en sistemes i Backup.",
    "timeline_job3_achieve": "Treball en equips internacionals coordinant sistemes a 3 continents.",
    "skills_eyebrow": "Skills & Stack",
    "cheatsheet_html5_title": "HTML5",
    "cheatsheet_html5_desc": "Estructura semàntica, accessibilitat i trucs fonamentals.",
    "cheatsheet_html5_badge": "PDF · Sprint 1",
    "cheatsheet_css3_title": "CSS3",
    "cheatsheet_css3_desc": "Layouts amb Flexbox, Grid, variables i disseny modern.",
    "cheatsheet_css3_badge": "PDF · Sprint 2",
    "cheatsheet_claude_title": "Claude Code Guide",
    "cheatsheet_claude_desc": "Guia d'ús i funcionament d'agents d'IA en la línia d'ordres.",
    "cheatsheet_claude_badge": "Document · Pages",
    "cheatsheet_fullstack_title": "Fullstack Cheatsheet",
    "cheatsheet_fullstack_desc": "APIs, bases de dades i patrons de backend modern.",
    "cheatsheet_fullstack_badge": "PDF · Sprint 5",
    "skill_react_title": "React",
    "skill_react_desc": "Components funcionals, hooks personalitzats, estat reactiu i construcció de Single Page Applications (SPAs).",
    "skill_react_badge": "Frontend",
    "skill_supabase_title": "Supabase",
    "skill_supabase_desc": "Backend-as-a-Service basat en PostgreSQL, autenticació d'usuaris, APIs generades al vol i realtime subscriptions.",
    "skill_supabase_badge": "BaaS / SQL",
    "skill_mongodb_title": "MongoDB",
    "skill_mongodb_desc": "Base de dades no relacional orientada a documents BSON, disseny d'esquemes flexibles i modelatge amb Mongoose.",
    "skill_mongodb_badge": "NoSQL",
    "skill_node_title": "Node",
    "skill_node_desc": "Entorn d'execució backend amb JavaScript, desenvolupament d'APIs RESTful escalables, Express.js i microserveis.",
    "skill_node_badge": "Backend",
    "skills_more_title": "Altres tecnologies & eines",
    "skill_chip_js_name": "JavaScript",
    "skill_chip_js_tag": "Llenguatge",
    "skill_chip_js_title": "ES6+, manipulació del DOM, programació funcional, fetch API i asincronia.",
    "skill_chip_ts_name": "TypeScript",
    "skill_chip_ts_tag": "Tipat",
    "skill_chip_ts_title": "Tipat estàtic per a JavaScript, interfícies i major robustesa en projectes grans.",
    "skill_chip_html_name": "HTML5",
    "skill_chip_html_tag": "Frontend",
    "skill_chip_html_title": "Estructura semàntica, accessibilitat web (a11y) i SEO tècnic.",
    "skill_chip_css_name": "CSS3",
    "skill_chip_css_tag": "Estils",
    "skill_chip_css_title": "Flexbox, Grid, custom properties, responsive design i animacions modernes.",
    "skill_chip_git_name": "Git",
    "skill_chip_git_tag": "Tooling",
    "skill_chip_git_title": "Control de versions distribuït, branching i fluxos de treball col·laboratius.",
    "skill_chip_docker_name": "Docker",
    "skill_chip_docker_tag": "DevOps",
    "skill_chip_docker_title": "Contenidors per a entorns de desenvolupament consistents i desplegament continu.",
    "skill_chip_tailwind_name": "Tailwind CSS",
    "skill_chip_tailwind_tag": "Estils",
    "skill_chip_tailwind_title": "Framework utility-first per a disseny d'interfícies àgils i sistemes de disseny.",
    "skill_chip_next_name": "Next.js",
    "skill_chip_next_tag": "Framework",
    "skill_chip_next_title": "Renderitzat híbrid SSR/SSG, enrutament basat en fitxers i optimització fullstack.",
    "social_eyebrow": "Contacte & Xarxes",
    "social_write_msg": "Escriure missatge",
    "social_copy_email": "Copiar correu",
    "social_copied": "¡Copiat!",
    "footer_copy": "© 2026 Lluís Galindo · Desenvolupador Fullstack & PM",
    "footer_theme": "Canviar tema",
    "footer_contact": "Contacte",
    "askai_btn_label": "Preguntar a IA",
    "askai_title": "Ask AI · Lluís Galindo",
    "askai_desc": "Descobreix detalls sobre el perfil, trajectòria i especialitat de Lluís:",
    "askai_chip_exp": "💼 Trajectòria i lideratge IT",
    "askai_chip_skills": "💻 Stack tècnic i metodologies",
    "askai_chip_ai": "🤖 IA aplicada al desenvolupament",
    "askai_chip_contact": "✉️ Col·laboracions i contacte",
    "askai_copy_prompt": "Copiar prompt per a ChatGPT / Claude",
    "askai_copied": "¡Prompt copiat!",
    "askai_answer_exp": "Lluís compta amb més de 20 anys d'experiència en IT, havent liderat infraestructures a <b>Buff</b>, projectes estratègics a <b>Smith&Nephew</b> i gestió/docència a <b>Winfor</b>. El seu perfil uneix visió de negoci, arquitectura de sistemes i gestió d'equips.",
    "askai_answer_skills": "Especialitzat en JavaScript/TypeScript, React, Supabase, MongoDB, Node.js, Express, HTML5, CSS3, Docker i Git. Destaca en clean code, arquitectura escalable i bones pràctiques devops.",
    "askai_answer_ai": "Actualment enfoca la seva energia en la integració d'Intel·ligència Artificial aplicada al cicle de vida del programari: tooling automatitzat, agents, prompt engineering estructurat i acceleració de lliuraments.",
    "askai_answer_contact": "Lluís està disponible per a projectes de desenvolupament fullstack, consultoria tecnològica i formació. Pots contactar-hi directament a <a href='mailto:llgalindoe@outlook.com' style='text-decoration:underline; font-weight:600;'>llgalindoe@outlook.com</a>.",
    "askai_prompt_text": "Ets un assistent que avalua el perfil professional de Lluís Galindo.\nContext:\n- Nom: Lluís Galindo (@lluisgalindo)\n- Rol: Fullstack Developer & IT Systems / Project Manager\n- Experiència: Més de 20 anys en IT (Buff, Winfor, Smith&Nephew, The Bridge, Netmind).\n- Stack clau: React, Supabase, MongoDB, Node.js, JavaScript, TypeScript, Docker.\n- Enfocament: Arquitectura web escalable, desenvolupament frontend & backend modern, clean code i IA aplicada al desenvolupament de programari."
  },
  "en": {
    "page_title": "Lluís Galindo · Fullstack Developer & Project Manager",
    "page_description": "Personal website of Lluís Galindo, Fullstack Developer & Project Manager. Projects, career path, cheatsheets, and modern tech stack.",
    "lang_selector_aria": "Language selector",
    "hero_title": "Lluís Galindo",
    "hero_role": "Fullstack Developer & Project Manager",
    "hero_status": "Available for projects",
    "hero_contact_btn": "Contact",
    "hero_bio_p1": "Full-stack developer and project manager specializing in modern web solutions, scalable architecture, and AI-driven development workflows. Over 20 years in the IT sector combining technical leadership, software engineering, and tech training.",
    "hero_bio_p2": "Specialized in the <strong>JavaScript / TypeScript</strong> ecosystem, <strong>React</strong>, <strong>Node.js</strong>, relational and NoSQL databases, with a keen focus on clean code, performance, and user experience.",
    "featured_eyebrow": "Featured Project",
    "featured_badge": "Architecture & Engineering",
    "featured_title": "Modern Web Architecture & AI Workflows",
    "featured_desc": "Design and implementation of modern web architecture focused on high performance, accessibility, and modular design. Seamless integration of AI-assisted engineering and automated agent workflows.",
    "featured_tag1": "Fullstack",
    "featured_tag2": "AI Tooling",
    "featured_tag3": "Clean Code",
    "featured_metric_exp": "20+ years IT",
    "featured_metric_companies": "Buff · Smith&Nephew",
    "featured_metric_role": "Lead Instructor",
    "timeline_eyebrow": "Background",
    "timeline_job1_when": "2024 - Present",
    "timeline_job1_role": "Project Manager & Lead Instructor",
    "timeline_job1_company": "Winfor · Software & Training",
    "timeline_job1_desc": "Software project management and Fullstack technical instruction (React, Node, Express, MongoDB, Supabase). Mentoring and training junior/mid software developers.",
    "timeline_job2_when": "2022 - 2024",
    "timeline_job2_role": "I.T. Infrastructures Lead",
    "timeline_job2_company": "Buff · Digital Strategy",
    "timeline_job2_desc": "Overseeing IT infrastructures, optimizing mission-critical systems, and deploying technological solutions aligned with core business goals.",
    "timeline_job3_when": "2019 - 2022",
    "timeline_job3_role": "Technical Coordinator & Systems",
    "timeline_job3_company": "Smith&Nephew · Digital Solutions",
    "timeline_job3_desc": "Technical leadership in core systems and Backup infrastructure.",
    "timeline_job3_achieve": "Collaborated across global teams coordinating systems across 3 continents.",
    "skills_eyebrow": "Skills & Stack",
    "cheatsheet_html5_title": "HTML5",
    "cheatsheet_html5_desc": "Semantic markup, accessibility essentials, and best practices.",
    "cheatsheet_html5_badge": "PDF · Sprint 1",
    "cheatsheet_css3_title": "CSS3",
    "cheatsheet_css3_desc": "Flexbox layouts, Grid systems, CSS variables, and modern styling.",
    "cheatsheet_css3_badge": "PDF · Sprint 2",
    "cheatsheet_claude_title": "Claude Code Guide",
    "cheatsheet_claude_desc": "Practical guide to leveraging CLI-based AI coding agents.",
    "cheatsheet_claude_badge": "Document · Pages",
    "cheatsheet_fullstack_title": "Fullstack Cheatsheet",
    "cheatsheet_fullstack_desc": "APIs, database patterns, and modern backend architecture.",
    "cheatsheet_fullstack_badge": "PDF · Sprint 5",
    "skill_react_title": "React",
    "skill_react_desc": "Functional components, custom hooks, reactive state, and Single Page Application (SPA) architecture.",
    "skill_react_badge": "Frontend",
    "skill_supabase_title": "Supabase",
    "skill_supabase_desc": "PostgreSQL-powered BaaS, user authentication, instant APIs, and realtime subscriptions.",
    "skill_supabase_badge": "BaaS / SQL",
    "skill_mongodb_title": "MongoDB",
    "skill_mongodb_desc": "BSON document database, flexible schema design, aggregations, and data modeling with Mongoose.",
    "skill_mongodb_badge": "NoSQL",
    "skill_node_title": "Node",
    "skill_node_desc": "Server-side JavaScript runtime, scalable RESTful API architecture, Express.js, and microservices.",
    "skill_node_badge": "Backend",
    "skills_more_title": "Other technologies & tools",
    "skill_chip_js_name": "JavaScript",
    "skill_chip_js_tag": "Language",
    "skill_chip_js_title": "ES6+, DOM manipulation, functional programming, Fetch API, and asynchronous architecture.",
    "skill_chip_ts_name": "TypeScript",
    "skill_chip_ts_tag": "Typing",
    "skill_chip_ts_title": "Static typing for JavaScript, enterprise application reliability, and type-safe systems.",
    "skill_chip_html_name": "HTML5",
    "skill_chip_html_tag": "Frontend",
    "skill_chip_html_title": "Semantic structure, web accessibility (a11y), and modern technical SEO.",
    "skill_chip_css_name": "CSS3",
    "skill_chip_css_tag": "Styles",
    "skill_chip_css_title": "Flexbox, Grid systems, CSS variables, responsive design, and fluid transitions.",
    "skill_chip_git_name": "Git",
    "skill_chip_git_tag": "Tooling",
    "skill_chip_git_title": "Distributed version control, trunk-based development, and collaborative pull requests.",
    "skill_chip_docker_name": "Docker",
    "skill_chip_docker_tag": "DevOps",
    "skill_chip_docker_title": "Containerization for reproducible development environments and CI/CD pipelines.",
    "skill_chip_tailwind_name": "Tailwind CSS",
    "skill_chip_tailwind_tag": "Styles",
    "skill_chip_tailwind_title": "Utility-first CSS framework for rapid UI prototyping and consistent design systems.",
    "skill_chip_next_name": "Next.js",
    "skill_chip_next_tag": "Framework",
    "skill_chip_next_title": "Hybrid SSR/SSG rendering, file-system routing, and production-grade fullstack performance.",
    "social_eyebrow": "Contact & Social",
    "social_write_msg": "Send message",
    "social_copy_email": "Copy email",
    "social_copied": "Copied!",
    "footer_copy": "© 2026 Lluís Galindo · Fullstack Developer & PM",
    "footer_theme": "Toggle theme",
    "footer_contact": "Contact",
    "askai_btn_label": "Ask AI",
    "askai_title": "Ask AI · Lluís Galindo",
    "askai_desc": "Learn more about Lluís Galindo's background, tech stack and focus:",
    "askai_chip_exp": "💼 IT Leadership & Experience",
    "askai_chip_skills": "💻 Tech Stack & Architecture",
    "askai_chip_ai": "🤖 AI in Software Engineering",
    "askai_chip_contact": "✉️ Collaborations & Contact",
    "askai_copy_prompt": "Copy prompt for ChatGPT / Claude",
    "askai_copied": "Prompt copied!",
    "askai_answer_exp": "Lluís has over 20 years of experience in IT, having led infrastructures at <b>Buff</b>, strategic projects at <b>Smith&Nephew</b>, and project management/teaching at <b>Winfor</b>. His profile combines business strategy, systems architecture, and team leadership.",
    "askai_answer_skills": "Specialized in JavaScript/TypeScript, React, Supabase, MongoDB, Node.js, Express, HTML5, CSS3, Docker, and Git. Focused on clean code, scalable architecture, and solid devops practices.",
    "askai_answer_ai": "Currently focusing on applied Artificial Intelligence across the software lifecycle: automated tooling, coding agents, structured prompting, and delivery acceleration.",
    "askai_answer_contact": "Lluís is available for fullstack development projects, technical consulting, and training. You can reach out directly at <a href='mailto:llgalindoe@outlook.com' style='text-decoration:underline; font-weight:600;'>llgalindoe@outlook.com</a>.",
    "askai_prompt_text": "You are an assistant evaluating the professional profile of Lluís Galindo.\nContext:\n- Name: Lluís Galindo (@lluisgalindo)\n- Role: Fullstack Developer & IT Systems / Project Manager\n- Experience: Over 20 years in IT (Buff, Winfor, Smith&Nephew, The Bridge, Netmind).\n- Key Stack: React, Supabase, MongoDB, Node.js, JavaScript, TypeScript, Docker.\n- Focus: Scalable web architecture, modern frontend & backend engineering, clean code, and AI applied to software workflows."
  }
};
