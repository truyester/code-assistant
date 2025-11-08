let currentModel = 'openai';

document.getElementById('toggle-model').addEventListener('click', () => {
    currentModel = currentModel === 'openai' ? 'gemini' : 'openai';
    document.getElementById('toggle-model').innerText = `Modelo: ${currentModel === 'openai' ? 'OpenAI' : 'Gemini'}`;
});

document.querySelectorAll('.ask-btn').forEach(button => {
    button.addEventListener('click', function () {
        const section = this.parentElement;
        const questionBox = section.querySelector('.question-box');

        const isOpen = questionBox.style.display === 'block';
        if (isOpen) {
            // Cierra y limpia el área de pregunta/respuesta
            questionBox.style.display = 'none';
            questionBox.innerHTML = '';
            return;
        }

        // Abre un nuevo espacio para una nueva pregunta
        questionBox.innerHTML = `
            <textarea class="question-input" placeholder="Escribe tu pregunta..."></textarea>
            <button class="send-btn">Enviar</button>
            <div class="response"></div>
        `;
        questionBox.style.display = 'block';

        const sendBtn = questionBox.querySelector('.send-btn');
        sendBtn.addEventListener('click', async function () {
            const inputField = questionBox.querySelector('.question-input');
            const responseBox = questionBox.querySelector('.response');
            const question = inputField.value.trim();

            if (question === '') {
                responseBox.innerHTML = "Por favor, escribe una pregunta.";
                return;
            }

            responseBox.innerHTML = "Pensando...";

            try {
                // Timeout to avoid hanging forever
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const response = await fetch('/api/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt: question,
                        model: currentModel
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) throw new Error("Error en la respuesta del servidor");

                const data = await response.json();
                const answer = formatAnswer(data.bot.trim());
                responseBox.innerHTML = answer;

            } catch (error) {
                if (error.name === 'AbortError') {
                    responseBox.innerHTML = "Tiempo de espera agotado. Verifica que el servidor esté activo y tu conexión a la API.";
                    return;
                }
                responseBox.innerHTML = "Error al obtener la respuesta.";
                console.error(error);
            }
        });
    });
});

// Animación de escritura
function typeText(element, text) {
    let index = 0;
    element.innerHTML = ""; // Limpia antes de empezar
    let interval = setInterval(() => {
        if (index < text.length) {
            element.innerHTML += text.charAt(index);
            index++;
        } else {
            clearInterval(interval);
        }
    }, 8);
}

// Da formato bonito a la respuesta (con <pre>, <code>, saltos de línea)
function formatAnswer(text) {
    // Si viene como HTML, lo usamos directamente
    if (text.startsWith('<') && text.includes('</')) return text;

    // Detecta bloques ```código``` y los transforma a <pre><code>
    const htmlFormatted = text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const safeLang = lang || 'plaintext';
            return `<pre><code class="language-${safeLang}">${code.trim()}</code></pre>`;
        })
        .replace(/\n/g, "<br>");

    return `<div>${htmlFormatted}</div>`;
}
