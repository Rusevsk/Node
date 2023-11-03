document.addEventListener("DOMContentLoaded", function() {
    const audioPlayer = document.getElementById('audio-player');
    const back10SecButton = document.getElementById('back-10-sec');
    const back5SecButton = document.getElementById('back-5-sec');
    const forward5SecButton = document.getElementById('forward-5-sec');
    const forward10SecButton = document.getElementById('forward-10-sec');

    if (audioPlayer) {
        if (back10SecButton) {
            back10SecButton.addEventListener('click', () => {
                audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 10, 0);
            });
        }

        if (back5SecButton) {
            back5SecButton.addEventListener('click', () => {
                audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 5, 0);
            });
        }

        if (forward5SecButton) {
            forward5SecButton.addEventListener('click', () => {
                audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 5, audioPlayer.duration);
            });
        }

        if (forward10SecButton) {
            forward10SecButton.addEventListener('click', () => {
                audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 10, audioPlayer.duration);
            });
        }
    }
});

window.onload = function() {
    const cutAudioButton = document.getElementById('cutAudioButton');
    if (cutAudioButton) {
        cutAudioButton.addEventListener('click', function() {
            var audioUrl = this.dataset.audioUrl;
            var startMinute = document.getElementById('startMinute').value;
            var startSecond = document.getElementById('startSecond').value;
            var endMinute = document.getElementById('endMinute').value;
            var endSecond = document.getElementById('endSecond').value;
            console.log(`audioUrl: ${audioUrl}`);
            console.log(`start: ${startMinute}:${startSecond}`);
            console.log(`end: ${endMinute}:${endSecond}`);


            var postData = JSON.stringify({
                audioUrl: audioUrl,
                startMinute: startMinute,
                startSecond: startSecond,
                endMinute: endMinute,
                endSecond: endSecond
            });

            console.log(`Sending data: ${postData}`); // Imprime los datos que se envían

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/cut-audio', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'blob'; // This is necessary to handle the binary data
            xhr.send(postData);

            xhr.responseType = 'json'; // Cambia esto para esperar un JSON

            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    console.log('Request finished and response is ready.');

                    // Usa la ruta proporcionada para establecer el src del reproductor de audio y descargar el archivo
                    const fragmentPath = xhr.response.fragmentPath;
                    document.getElementById('fragment-audio-player').src = fragmentPath;
                    $('#fragmentModal').modal('show');

                    // Código para descargar el fragmento automáticamente
                    var a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = fragmentPath;
                    a.download = 'fragment-' + Date.now() + '.mp3';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else if (xhr.readyState == 4) {
                    console.log('There was an error with the request.');
                    console.log('Status:', xhr.status);
                    console.log('Response:', xhr.responseText);
                }
            };
        });
    }
};

document.addEventListener("DOMContentLoaded", function() {
    const uploadDateInput = document.getElementById('uploadDate');

    if (uploadDateInput) {
        const today = new Date();

        // Convertir la fecha al formato YYYY-MM-DD
        const maxDate = today.toISOString().split('T')[0];

        uploadDateInput.setAttribute('max', maxDate);
    }
});

$(document).ready(function() {
     console.log("Script cargado");
    // Llenar el dropdown de Medios cuando el modal se abra
    $('#fragmentModal').on('shown.bs.modal', function () {
        console.log("Modal abierto");
        $.get("/api/medios", function(data) {
            // Limpia las opciones previas
            $("#medioDropdown").empty();

            // Añade una opción por defecto (opcional)
            $("#medioDropdown").append('<option value="" disabled selected>Seleccione un medio</option>');

            // Añade las opciones de medios desde la base de datos
            data.forEach(function(medio) {
                $("#medioDropdown").append(`<option value="${medio.id}">${medio.nombre}</option>`);
            });
        });
    });

    // Cuando se cambie la opción en el dropdown de Medios, llenar el dropdown de Programas
    $("#medioDropdown").change(function() {
        var medioId = $(this).val();

        // Limpia y deshabilita el dropdown de programas mientras se cargan los datos
        $("#programaDropdown").empty().prop('disabled', true);

        $.get(`/api/programas/${medioId}`, function(data) {
            console.log("Datos recibidos:", data);
            // Añade una opción por defecto (opcional)
            $("#programaDropdown").append('<option value="" disabled selected>Seleccione un programa</option>');

            // Añade las opciones de programas basado en el medio seleccionado
            data.forEach(function(programa) {
                $("#programaDropdown").append(`<option value="${programa.id}">${programa.nombre}</option>`);
            });

            // Habilita el dropdown de programas una vez cargados los datos
            $("#programaDropdown").prop('disabled', false);
        });
    });

});

$('#fragmentModal').on('show.bs.modal', function() {
    const noticiaId = $('#fragmentModal').data('noticia-id');
    $('#noticiaIdInput').val(noticiaId);
});






