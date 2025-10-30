let currentModel = 'openai';

document.getElementById('toggle-model').addEventListener('click', () => {
    currentModel = currentModel === 'openai' ? 'gemini' : 'openai';
    document.getElementById('toggle-model').innerText = `Modelo: ${currentModel === 'openai' ? 'OpenAI' : 'Gemini'}`;
});

document.querySelectorAll('.ask-btn').forEach(button => {
    button.addEventListener('click', function () {
        let section = this.parentElement;
        let questionBox = section.querySelector('.question-box');

        if (questionBox.innerHTML.trim() === '') {
            questionBox.innerHTML = `
                <textarea class="question-input" placeholder="Escribe tu pregunta..."></textarea>
                <button class="send-btn">Enviar</button>
                <div class="response"></div>
            `;
            questionBox.style.display = 'block';

            let sendBtn = questionBox.querySelector('.send-btn');
            sendBtn.addEventListener('click', async function () {
                let inputField = questionBox.querySelector('.question-input');
                let responseBox = questionBox.querySelector('.response');
                let question = inputField.value.trim();

                if (question === '') {
                    responseBox.innerHTML = "Por favor, escribe una pregunta.";
                    return;
                }

                responseBox.innerHTML = "Pensando...";

                try {
                    const response = await fetch('http://localhost:5001/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            prompt: question,
                            model: currentModel
                        })
                    });

                    if (!response.ok) throw new Error("Error en la respuesta del servidor");

                    const data = await response.json();
                    const answer = formatAnswer(data.bot.trim());
                    responseBox.innerHTML = answer;

                } catch (error) {
                    responseBox.innerHTML = "Error al obtener la respuesta.";
                    console.error(error);
                }
            });
        }
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
