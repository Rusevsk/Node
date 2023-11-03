let directoryHistory = [];
let videoList = [];
let currentVideoIndex = -1;


async function loadContent(directoryPath = '') {
    console.log(`Loading content for directory: ${directoryPath}`);
    try {
        if(directoryPath) {
            directoryHistory.push(directoryPath);
        }

        const response = await fetch(`/list-videos?path=${encodeURIComponent(directoryPath)}`);
        const content = await response.json();

        const contentListElement = document.getElementById('contentList');
        contentListElement.innerHTML = ''; // Limpiar el contenido existente

        // Si hay historia, muestra el botón para regresar
        if (directoryHistory.length > 1) {
            const goBackLink = document.createElement('a');
            goBackLink.innerText = 'Regresar al directorio anterior';
            goBackLink.classList.add('goBack');
            goBackLink.onclick = () => {
                directoryHistory.pop(); // Remueve el directorio actual
                loadContent(directoryHistory.pop()); // Carga el directorio anterior
            };
            contentListElement.appendChild(goBackLink);
        }

        videoList = []; // Limpiamos la lista de videos al cargar nuevo contenido

        content.forEach(item => {
            console.log('Processing item:', item);
            const listItem = document.createElement('div');
            listItem.innerText = item.name;

            if (item.type === 'directory') {
                listItem.classList.add('directory');
                listItem.onclick = () => loadContent(item.path);
            } else if (item.type === 'file') {
                listItem.classList.add('video');

                videoList.push(item.path); // Agregamos el video a videoList

                listItem.onclick = () => {
                    currentVideoIndex = videoList.indexOf(item.path); // Establecemos el índice del video actual
                    playVideo(item.path);
                };
            }

            contentListElement.appendChild(listItem);
        });
        if (currentVideoUrl) {
            currentVideoIndex = videoList.indexOf(currentVideoUrl);
        } else {
            currentVideoIndex = -1; // Si no hay un video actualmente seleccionado
        }
        updateNavButtons();
        console.log('Complete videoList:', videoList);
    } catch (error) {
        console.error('Error loading content:', error);
    }
}


let currentVideoUrl = ''; // Agregar esta línea al inicio del archivo para declarar la variable global

async function loadYears() {
    console.log('Trying to fetch years...');
    try {
        const response = await fetch('/list-years');
        const years = await response.json();
        const yearSelect = document.getElementById('yearSelect');
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.innerText = year;
            yearSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading years:', error);
    }
}

async function loadMonthsForSelectedYear() {
    const year = document.getElementById('yearSelect').value;
    try {
        const response = await fetch(`/list-months?year=${encodeURIComponent(year)}`);
        const months = await response.json();

        console.log('Received months:', months);

        const monthSelect = document.getElementById('monthSelect');
        monthSelect.innerHTML = '';  // Clear previous options
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.innerText = month;
            monthSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading months:', error);
    }
}


async function loadChannels(year, month) {
    console.log(`Fetching channels for year: ${year}, month: ${month}`);
    try {
        const response = await fetch(`/list-channels?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
        const channels = await response.json();
        console.log('Received channels:', channels);

        const channelSelect = document.getElementById('channelSelect');
        channelSelect.innerHTML = '';  // Clear previous options
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel;
            option.innerText = channel;
            channelSelect.appendChild(option);
        });


    } catch (error) {
        console.error('Error loading channels:', error);
    }
}



async function loadDays(year, month, channel) {
    console.log(`Fetching days for year: ${year}, month: ${month}, channel: ${channel}`);
    try {
        const response = await fetch(`/list-days?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&channel=${encodeURIComponent(channel)}`);
        const days = await response.json();
        console.log('Received days:', days);

        const daySelect = document.getElementById('daySelect');
        daySelect.innerHTML = '';  // Clear previous options
        days.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.innerText = day;
            daySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading days:', error);
    }
}


function loadChannelsForSelectedMonth() {
    console.log("loadChannelsForSelectedMonth called"); // Agrega esta línea
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    console.log(`Fetching channels for year: ${year}, month: ${month}`);
    loadChannels(year, month);
}


function loadDaysForSelectedChannel() {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    const channel = document.getElementById('channelSelect').value;
    console.log(`Fetching days for year: ${year}, month: ${month}, channel: ${channel}`);
    loadDays(year, month, channel);
}



function loadRecordingsForSelectedDay() {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    const channel = document.getElementById('channelSelect').value;
    const day = document.getElementById('daySelect').value;
    loadContent(`${year}/${month}/${channel}/${day}`);
}

function updateNavButtons() {
    const prevVideoButton = document.getElementById('prevVideoButton');
    const nextVideoButton = document.getElementById('nextVideoButton');

    // Deshabilitar el botón "Anterior" si estamos en el primer video
    prevVideoButton.disabled = (currentVideoIndex <= 0);

    // Deshabilitar el botón "Siguiente" si estamos en el último video
    nextVideoButton.disabled = (currentVideoIndex >= videoList.length - 1);
}


function playVideo(videoPath) {
    console.log("Playing video:", videoPath);

    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = `/videos/${videoPath}`;
    currentVideoUrl = videoPlayer.src;

    // Actualizar el estado de los botones de navegación antes de reproducir
    updateNavButtons();
    console.log("Updating navigation buttons. Current Index:", currentVideoIndex, "Video List Length:", videoList.length);
    videoPlayer.play();
}


function playNextVideo() {
    console.log('Attempting to play next video. Current index:', currentVideoIndex);
    if (currentVideoIndex < videoList.length - 1) {
        currentVideoIndex++;
        playVideo(videoList[currentVideoIndex]);
    }

    // Actualizar el estado de los botones de navegación
    updateNavButtons();
    console.log("Updating navigation buttons. Current Index:", currentVideoIndex, "Video List Length:", videoList.length);

}

function playPreviousVideo() {
    console.log('Attempting to play previous video. Current index:', currentVideoIndex);
    if (currentVideoIndex > 0) {
        currentVideoIndex--;
        playVideo(videoList[currentVideoIndex]);
    }

    // Actualizar el estado de los botones de navegación
    updateNavButtons();
    console.log("Updating navigation buttons. Current Index:", currentVideoIndex, "Video List Length:", videoList.length);

}

// Cargar el contenido inicial al cargar la página

loadContent();
loadYears();

document.getElementById('monthSelect').addEventListener('change', function() {
    console.log("Month selection changed!");
    loadChannelsForSelectedMonth();
});
document.getElementById('channelSelect').addEventListener('change', loadDaysForSelectedChannel);



function timeToSeconds(time) {
    const [minutes, seconds] = time.split(':').map(Number);
    return minutes * 60 + seconds;
}

function cutVideo() {
    const startMinute = document.getElementById('startMinute').value;
    const startSecond = document.getElementById('startSecond').value;
    const endMinute = document.getElementById('endMinute').value;
    const endSecond = document.getElementById('endSecond').value;

    const cutButton = document.querySelector("#videoCutter button");
    cutButton.disabled = true;
    cutButton.innerText = "Procesando...";
    cutButton.style.backgroundColor = ""; // Reset color

    const postData = JSON.stringify({
        videoUrl: currentVideoUrl,
        startMinute: startMinute,
        startSecond: startSecond,
        endMinute: endMinute,
        endSecond: endSecond
    });

    fetch('/cut-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: postData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        // Código para descargar el fragmento del video automáticamente
        const fragmentPath = "/videos" + data.fragmentPath;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = fragmentPath;
        a.download = 'fragment-' + Date.now() + '.mp4';
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







