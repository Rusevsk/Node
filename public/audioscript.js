let directoryHistory = [];

async function loadContent(directoryPath = '') {
    try {
        const encodedPath = encodeURIComponent(directoryPath);
        const response = await fetch(`/list-audio?path=${encodedPath}`);
        const content = await response.json();

        const contentListElement = document.getElementById('contentList');
        contentListElement.innerHTML = ''; // Limpiar el contenido existente

        // Añadir el enlace para volver atrás, si es necesario
        if (directoryHistory.length > 1) {  // El primer elemento es '', así que necesitamos más de uno para volver atrás
            const goBackLink = document.createElement('a');
            goBackLink.innerText = 'Regresar al directorio anterior';
            goBackLink.href = '#';
            goBackLink.classList.add('goBack');
            goBackLink.onclick = (e) => {
                e.preventDefault();
                directoryHistory.pop(); // Remueve el último directorio visitado
                loadContent(directoryHistory[directoryHistory.length - 1]);
            };
            contentListElement.appendChild(goBackLink);
        }

        // Mostrar los elementos del directorio actual
        content.forEach(item => {
            const listItem = document.createElement('div');
            listItem.innerText = item.name;

            if (item.type === 'directory') {
                listItem.classList.add('directory');
                listItem.onclick = () => {
                    const newPath = directoryPath ? `${directoryPath}/${item.name}` : item.name;
                    directoryHistory.push(newPath); // Añadir nuevo path al historial
                    loadContent(newPath);
                };
            } else if (item.type === 'file') {
                listItem.classList.add('audio');
                listItem.onclick = () => playAudio(item.path);
            }

            contentListElement.appendChild(listItem);
        });

        // Actualizar el historial si no estaba incluido aún
        if(directoryPath && !directoryHistory.includes(directoryPath)) {
            directoryHistory.push(directoryPath);
        }
    } catch (error) {
        console.error('Error loading content:', error);
    }
}


function cutAudio() {
    const startMinute = document.getElementById('startMinuteAudio').value;
    const startSecond = document.getElementById('startSecondAudio').value;
    const endMinute = document.getElementById('endMinuteAudio').value;
    const endSecond = document.getElementById('endSecondAudio').value;

    const cutButton = document.querySelector("#videoCutter button");
    cutButton.disabled = true;
    cutButton.innerText = "Procesando...";
    cutButton.style.backgroundColor = ""; // Reset color

    const postData = JSON.stringify({
        audioUrl: currentAudioUrl,
        startMinute: startMinute,
        startSecond: startSecond,
        endMinute: endMinute,
        endSecond: endSecond
    });

    fetch('/cut-audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: postData
    })
    .then(response => response.json())
    .then(data => {
        const fragmentPath = data.fragmentPath;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = fragmentPath;
        a.download = 'fragment-' + Date.now() + '.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        cutButton.innerText = "Cortar y Descargar";
        cutButton.disabled = false;
    })
    .catch(error => {
        console.error('Error:', error);
        cutButton.innerText = "Error al cortar";
        cutButton.style.backgroundColor = "red";
        cutButton.disabled = false;
    });
}


let currentAudioUrl = '';

function playAudio(audioPath) {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = `/radio/${audioPath}`;
    currentAudioUrl = audioPlayer.src;
    audioPlayer.play();
}



// Llama a loadContent solo una vez al final del archivo
loadContent();



