$(document).ready(function () {
    // Función para alternar la visibilidad de la barra lateral
    $("#sidebarToggle").click(function () {
        $("#sidebar").toggleClass("hidden");
        $("#sidebarToggle i").toggleClass("bi-list bi-list-ul");
    });
});
