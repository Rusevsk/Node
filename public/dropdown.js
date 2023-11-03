document.addEventListener("DOMContentLoaded", function() {
    const configDropdown = document.getElementById("configDropdown");
    const configOptions = document.getElementById("configOptions");

    configDropdown.addEventListener('click', function() {
        const displayStyle = configOptions.style.display;
        if (displayStyle === "none" || displayStyle === "") {
            configOptions.style.display = "block";
        } else {
            configOptions.style.display = "none";
        }
    });
});
document.getElementById("onlineDropdown").addEventListener("click", function() {
    var options = document.getElementById("onlineOptions");
    if (options.style.display === "none") {
        options.style.display = "block";
    } else {
        options.style.display = "none";
    }
});
document.getElementById("radioDropdown").addEventListener("click", function() {
    var options = document.getElementById("radioOptions");
    if (options.style.display === "none") {
        options.style.display = "block";
    } else {
        options.style.display = "none";
    }
});
