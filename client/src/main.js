import '../style.css';

// Fallback para asegurar que el CSS se inyecta aunque el link falle
(function(){
  try{
    var hasStyle = Array.prototype.slice.call(document.styleSheets||[]).some(function(s){ return (s.href||'').indexOf('style.css') !== -1; });
    if(!hasStyle){
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'style.css?v=' + Date.now();
      document.head.appendChild(link);
    }
  }catch(e){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'style.css?v=' + Date.now();
    document.head.appendChild(link);
  }
})();
let currentModel = 'openai';

// Comentario: mantiene el estado de modelo y actualiza el boton de alternancia
// Toggle de modelo
document.getElementById('toggle-model')?.addEventListener('click', () => {
  currentModel = currentModel === 'openai' ? 'gemini' : 'openai';
  const btn = document.getElementById('toggle-model');
  if (btn) btn.innerText = `Modelo: ${currentModel === 'openai' ? 'OpenAI' : 'Gemini'}`;
});

// ===== Navegación de temas por archivo =====
const TOPICS = [
  { id: 'data-types',  label: 'Tipos de Datos en Python', file: 'data-types.html' },
  { id: 'variables',   label: 'Variables y Operadores',    file: 'variables.html' },
  { id: 'control',     label: 'Estructuras de Control',     file: 'control.html' },
  { id: 'functions',   label: 'Funciones',                  file: 'functions.html' },
  { id: 'modules',     label: 'Módulos y Paquetes',         file: 'modules.html' },
  { id: 'files',       label: 'Manejo de Archivos',         file: 'files.html' },
  { id: 'errors',      label: 'Manejo de Errores',          file: 'errors.html' },
  { id: 'oop',         label: 'Programación Orientada a Objetos', file: 'oop.html' },
];

const nav = document.getElementById('topicsNav');
const content = document.getElementById('content');
const topicTitle = document.getElementById('topicTitle');
let current = (decodeURIComponent(location.hash.slice(1)) || localStorage.getItem('py-topic') || 'data-types');

// Renderiza la barra lateral de temas y marca el tema actual
function renderNav(){
  if (!nav) return;
  nav.innerHTML = '';
  TOPICS.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    if (t.id === current) btn.setAttribute('aria-current','page');
    btn.addEventListener('click', () => {
      // sincroniza con URL hash para deep link
      location.hash = encodeURIComponent(t.id);
    });
    nav.appendChild(btn);
  });
}

async function loadTopic(){
  const t = TOPICS.find(x => x.id === current);
  if (!t || !content) return;
  if (topicTitle) topicTitle.textContent = t.label;
  try{
    const res = await fetch(`/topics/${t.file}`);
    const html = await res.text();
    content.innerHTML = html;
    // Reaplica widgets interactivos y prompts al cambiar de tema
    wireAskButtons(content);
    enhanceCodeBlocks(content);
    enhanceSolutions(content);
    await ensurePromptsLoaded();
    window.scrollTo({top:0, behavior:'smooth'});
  }catch(e){
    content.innerHTML = `<div class="section"><p class="muted">No se pudo cargar el tema.</p></div>`;
  }
}

// Mantén nav y contenido sincronizados con el hash
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  current = id;
  localStorage.setItem('py-topic', current);
  renderNav();
  loadTopic();
});

// Base de API: en producción usa VITE_API_TARGET, en desarrollo se mantiene /api con proxy
const API_BASE = (import.meta.env && import.meta.env.VITE_API_TARGET)
  ? import.meta.env.VITE_API_TARGET.replace(/\/+$/, '')
  : '';

// Adjunta comportamiento de Preguntar al asistente
function wireAskButtons(root){
  const buttons = root.querySelectorAll('.ask-btn');
  buttons.forEach(button => {
    button.addEventListener('click', function () {
      const section = this.closest('.section') || this.parentElement;
      const questionBox = section.querySelector('.question-box');

      const isOpen = questionBox.style.display === 'block';
      if (isOpen) {
        questionBox.style.display = 'none';
        questionBox.innerHTML = '';
        return;
      }

      questionBox.innerHTML = `
        <div id="qp"></div>
        <textarea class="question-input" placeholder="Escribe tu pregunta..."></textarea>
        <button class="send-btn">Enviar</button>
        <div class="response"></div>
      `;
      questionBox.style.display = 'block';

      const sendBtn = questionBox.querySelector('.send-btn');
      renderQuickPrompts(section, questionBox.querySelector('#qp'));
      sendBtn.addEventListener('click', async function () {
        const inputField = questionBox.querySelector('.question-input');
        const responseBox = questionBox.querySelector('.response');
        const question = inputField.value.trim();

        if (question === '') {
          responseBox.innerHTML = 'Por favor, escribe una pregunta.';
          return;
        }

        responseBox.innerHTML = 'Pensando...';

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(`${API_BASE}/api/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question, model: currentModel }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error('Error en la respuesta del servidor');

          const data = await response.json();
          const answer = formatAnswer(data.bot.trim());
          responseBox.innerHTML = answer;
          enhanceCodeBlocks(responseBox);
        } catch (error) {
          if (error.name === 'AbortError') {
            responseBox.innerHTML = 'Tiempo de espera agotado. Verifica que el servidor esté activo y tu conexión a la API.';
            return;
          }
          responseBox.innerHTML = 'Error al obtener la respuesta.';
          console.error(error);
        }
      });
    });
  });
}

// Animación de escritura (disponible por si se usa)
function typeText(element, text) {
  let index = 0;
  element.innerHTML = '';
  let interval = setInterval(() => {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 8);
}

// Formatea la respuesta manteniendo bloques de código
function formatAnswer(text) {
  if (text.startsWith('<') && text.includes('</')) return text;

  const normalized = text.replace(/\r\n/g, '\n');
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  const parts = [];
  let match;

  while ((match = codeRegex.exec(normalized)) !== null) {
    const before = normalized.slice(lastIndex, match.index).replace(/\n/g, '<br>');
    parts.push(before);

    const lang = match[1] || 'plaintext';
    const code = match[2]
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
    parts.push(`<pre><code class="language-${lang}">${code}</code></pre>`);

    lastIndex = codeRegex.lastIndex;
  }

  const after = normalized.slice(lastIndex).replace(/\n/g, '<br>');
  parts.push(after);

  return `<div>${parts.join('')}</div>`;
}

// Botón de copiar código en bloques <pre>
function enhanceCodeBlocks(container){
  const icon = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 9V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="3" y="9" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  container.querySelectorAll('pre').forEach(pre => {
    if (pre.closest('.code-block')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = 'Copiar código';
    btn.innerHTML = icon;
    wrapper.appendChild(btn);

    const copy = async () => {
      const text = pre.textContent || '';
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        btn.classList.add('copied');
        btn.innerHTML = 'Copiado';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = icon; }, 1400);
      } catch (e) {
        console.error('Copy failed', e);
        btn.innerHTML = 'Error';
        setTimeout(() => { btn.innerHTML = icon; }, 1200);
      }
    };
    btn.addEventListener('click', copy);
  });
}

// Mejora bloques de solución: cambia el texto del summary al abrir/cerrar
function enhanceSolutions(container){
  const nodes = container.querySelectorAll('details.solution');
  nodes.forEach(d => {
    const summary = d.querySelector('summary');
    if (!summary) return;
    const closedText = summary.getAttribute('data-closed') || 'Mostrar solución';
    const openText = summary.getAttribute('data-open') || 'Ocultar solución';
    summary.textContent = d.open ? openText : closedText;
    d.addEventListener('toggle', () => {
      summary.textContent = d.open ? openText : closedText;
    });
  });
}

// Init
// Inicializa respetando el hash si existe
renderNav();
loadTopic();


// Autoevaluación: encuentra bloques .self-test y evalúa con el API
// (autoevaluación revertida)


// ===== Quick Prompts (sin estilos) =====
let PROMPTS_CACHE = null;
async function ensurePromptsLoaded(){
  if (PROMPTS_CACHE) return;
  try{
    const res = await fetch('/prompts.json');
    PROMPTS_CACHE = await res.json();
  }catch(e){
    console.warn('No se pudieron cargar los prompts rápidos', e);
    PROMPTS_CACHE = {};
  }
}

// Pinta chips de prompts rapidos para el tema actual
function renderQuickPrompts(sectionEl, container){
  if (!container) return;
  container.innerHTML = '';
  container.className = 'quick-prompts';
  const id = (typeof current === 'string' && current) ? current : null;
  const prompts = (PROMPTS_CACHE && id && PROMPTS_CACHE[id]) ? PROMPTS_CACHE[id] : [];
  if (!prompts.length) return;
  // Render como una fila mínima de botones; sin CSS adicional
  const frag = document.createDocumentFragment();
  prompts.slice(0,3).forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = p;
    btn.className = 'prompt-chip';
    btn.addEventListener('click', () => {
      const box = sectionEl.querySelector('.question-box');
      const input = box?.querySelector('.question-input');
      if (input) { input.value = p; input.focus(); }
      // Solo rellena; el usuario envía manualmente
    });
    frag.appendChild(btn);
  });
  container.appendChild(frag);
}
