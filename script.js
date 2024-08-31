document.getElementById('upload-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const fileInput = document.getElementById('ics-file');
    const file = fileInput.files[0];
    const resultsElement = document.getElementById('results');

    if (file && file.type === 'text/calendar') {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            analyzeICS(content);
        };
        reader.readAsText(file);
    } else {
        resultsElement.textContent = 'Please upload a valid .ics file.';
    }
});

function analyzeICS(icsContent) {
    const resultsElement = document.getElementById('results');

    // Count the number of VEVENT entries in the ICS file
    const veventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;

    // Display the results
    resultsElement.textContent = `Number of events: ${veventCount}`;
}
