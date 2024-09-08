// Helper function to parse the nicknames input
function parseNicknames(nicknameString) {
    const nicknameMap = {};

    // Split the input by semicolons to get each mapping
    nicknameString.split(';').forEach(mapping => {
        const [nicknames, realName] = mapping.split(':').map(str => str.trim());
        if (nicknames && realName) {
            // Split the nicknames by commas, trim them, and map them to the real name
            nicknameMap[realName] = nicknames.split(',').map(nickname => nickname.trim());
        }
    });

    return nicknameMap;
}

document.getElementById('upload-form').addEventListener('submit', function (event) {
    event.preventDefault();

    // Get the file input
    const fileInput = document.getElementById('ics-file');
    const file = fileInput.files[0];

    // Get the nicknames from the input field
    const nicknamesInput = document.getElementById('nicknames-input');
    const nicknameMap = parseNicknames(nicknamesInput.value); // Parse the nickname input

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const calendarData = e.target.result;

            // Show the loading animation
            document.querySelector('.container').style.display = 'none';
            const loadingAnimation = document.getElementById('loading-animation');
            loadingAnimation.style.display = 'flex';

            // Set a maximum timeout for the loading screen (10 seconds)
            const loadingTimeout = setTimeout(() => {
                loadingAnimation.style.display = 'none';
                alert('Error: The analysis took too long. Please try again later.');
                document.querySelector('.container').style.display = 'block';
            }, 10000); // 10 seconds

            // Delay to simulate the analysis duration
            setTimeout(() => {
                analyzeICS(calendarData, nicknameMap, loadingTimeout);  // Pass nicknames and timeout
            }, 2000); // Simulate the 2-second analysis duration
        };
        reader.readAsText(file);
    } else {
        alert('Please upload an ICS file.');
    }
});

document.getElementById('back-button').addEventListener('click', function () {
    // Hide the results frame and show the upload container
    document.querySelector('.container').style.display = 'block';
    document.getElementById('results-frame').style.display = 'none';
    const resultsElement = document.getElementById('results');
    resultsElement.textContent = '';
});

function analyzeICS(icsContent, nicknameMap, loadingTimeout) {

    const startTime = performance.now();

    const jcalData = ICAL.parse(icsContent);
    const calendar = new ICAL.Component(jcalData);
    let events = calendar.getAllSubcomponents('vevent');

    // Sort events by start date
    events = events.map(event => new ICAL.Event(event)).sort((a, b) => a.startDate.toJSDate() - b.startDate.toJSDate());

    // Filter out past events that were not canceled
    const now = new Date();
    const filteredEvents = events.filter(event => event.status !== "CANCELLED" && event.startDate.toJSDate() <= now);

    // Get people data
    const peopleData = getAllPeople(filteredEvents, nicknameMap);

    if (Object.keys(peopleData).length === 0) {
        // If no people are found, stop the loading screen and show an error message
        clearTimeout(loadingTimeout); // Clear the 10-second timeout
        document.getElementById('loading-animation').style.display = 'none';
        alert('No attendees found in this calendar.');
        document.querySelector('.container').style.display = 'block';
    } else {
        // Clear the timeout because analysis is successful
        clearTimeout(loadingTimeout);
        // Hide the loading animation and show the results frame
        document.getElementById('loading-animation').style.display = 'none';
        const resultsFrame = document.getElementById('results-frame');
        resultsFrame.style.display = 'block';

        // Show the chart with the people data
        showChart(peopleData);
    }
}

function getAllPeople(events, nicknameMap) {
    const data = {}; // Name: {aliases, hours_spent, hangouts_list}

    events.forEach(event => {
        const summary = event.summary.toLowerCase(); // Convert summary to lowercase for easier matching
        const description = event.description;
        const start = event.startDate.toJSDate();
        const end = event.endDate.toJSDate();
        const duration = (end - start) / 3600000; // Duration in hours
        const organizer = getNamesEmails(event, 'organizer').names.join('');
        const attendee_data = getNamesEmails(event, 'attendee');
        const attendees = attendee_data.names.join(', ');
        const status = findStatus(event, 'lponssen@scu.edu');
        const event_status = getEventStatus(event);

        // Skip events that have no attendees
        if (attendee_data.names.length === 0) {
            return;
        }

        if (status !== 'DECLINED' && status !== 'NEEDS-ACTION' && event_status !== 'CANCELLED') {
            attendee_data.names.forEach(name => {
                if (!data[name]) {
                    data[name] = {
                        "aliases": [],
                        "hours_spent": 0,
                        "hangouts_list": []
                    };
                }

                // Check if any nickname from nicknameMap matches the event summary
                const aliases = nicknameMap[name] || []; // Get aliases for the current name

                aliases.forEach(alias => {
                    if (summary.includes(alias.toLowerCase())) {
                        // If an alias is found in the summary, add the alias to the data and update hours
                        data[name]["aliases"].push(alias);
                        data[name]["hours_spent"] += duration;
                    }
                });

                // Add the original name to the aliases if not present
                if (!data[name]["aliases"].includes(name)) {
                    data[name]["aliases"].push(name);
                }

                data[name]["hours_spent"] += duration;
                data[name]["hangouts_list"].push({
                    summary,
                    duration,
                    start,
                    end,
                    attendees
                });
            });
        }
    });

    return data;
}






function showChart(peopleData) {
    // Get the context of the canvas where the chart will be rendered
    const ctx = document.getElementById('results-chart').getContext('2d');

    // Extract names and hours for the chart
    let names = Object.keys(peopleData);
    let hours = names.map(name => peopleData[name]['hours_spent']);

    // Find the index of the person with the maximum hours and remove the top person
    const maxIndex = hours.indexOf(Math.max(...hours));
    names.splice(maxIndex, 1);
    hours.splice(maxIndex, 1);

    // Sort the remaining entries by hours in descending order
    const sortedIndices = hours.map((value, index) => index)
                               .sort((a, b) => hours[b] - hours[a]);

    // Keep only the top 10 entries
    const topIndices = sortedIndices.slice(0, 10);
    const filteredLabels = topIndices.map(index => names[index]);
    const filteredData = topIndices.map(index => hours[index]);

    // Increase the size of the chart by setting the canvas width and height
    ctx.canvas.width = 600;  // Set the chart to 900x900 pixels
    ctx.canvas.height = 600;

    // Create a new Chart instance with the updated size and options
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: filteredLabels,
            datasets: [{
                data: filteredData,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
                    '#FF9F40', '#FF6347', '#36A2EB', '#FFCE56', '#CCCCCC'
                ],
                hoverBackgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
                    '#FF9F40', '#FF6347', '#36A2EB', '#FFCE56', '#AAAAAA'
                ],
                borderWidth: 0 // Remove the white spaces between slices
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Remove the legend
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(1)} hours`;
                        }
                    }
                },
                datalabels: {
                    color: '#fff',  // Text color
                    formatter: function(value, context) {
                        const name = context.chart.data.labels[context.dataIndex];
                        return `${name}`;
                    },
                    anchor: 'center',
                    align: 'center',
                    textAlign: 'center',
                    font: {
                        weight: 'bold',
                        size: 8,
                    },
                }
            }
        },
        plugins: [ChartDataLabels] // This plugin is required for the datalabels to work
    });
}






function getEventStatus(event) {
    const data = event.component.jCal[1];
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item[0] === 'status') {
            return item[3];
        }
    }
    return null;
}

function findStatus(event, targetCn) {
    const data = event.component.jCal[1];
    // Loop through the array
    for (let i = 0; i < data.length; i++) {
        // Check if the type is 'attendee'
        const item = data[i];
        if (item[0] === 'attendee') {
            // Check if the 'cn' matches the target
            if (item[1]['cn'] === targetCn) {
                // Return the status if found
                return item[1]['partstat'];
            }
        }
    }
    
    // Return null if the targetCn is not found
    return null;
}

function getNamesEmails(event, type) {
    const nameFromEmailPattern = /^([^@]+)@/;

    // Ensure event.component.jCal[1] is an array
    const data = event.component.jCal[1];
    if (!Array.isArray(data)) {
        console.error('Expected an array for jCal[1] but got:', data);
        return { names: [], emails: [] };
    }

    // Initialize arrays for names and emails
    const names = new Set();
    const emails = new Set();

    // Extract names and emails from the data
    data.forEach(item => {
        // Check if the item is a map and the first item in the array is type
        if (Array.isArray(item) && item.length > 1 && item[0] === type) {
            const attendee = item[1];
            if (attendee) {
                // Get the email address from the map
                const email = attendee['cn'];
                if (email) {
                    emails.add(email);

                    const nameMatchFromEmail = nameFromEmailPattern.exec(email);
                    if (nameMatchFromEmail) {
                        const name = nameMatchFromEmail[1];
                        names.add(name)
                    }
                }
            }
        }
    });

    return {
        names: [...names],
        emails: [...emails]
    };
}



function show(data, n = 1000, verbose = false) {
    let output = "";
    const sortedData = Object.entries(data).sort((a, b) => b[1]['hours_spent'] - a[1]['hours_spent']);
    
    sortedData.slice(1, n).forEach(([name, details]) => {
        output += `${name}: ${details['hours_spent'].toFixed(1)} hours\n`;
        if (verbose) {
            output += "-------------------------------\n";
            details["hangouts_list"].forEach(hangout => {
                output += `${hangout.summary}: ${hangout.duration.toFixed(1)} hrs\n`;
            });
            output += "-------------------------------\n";
        }
    });

    return output;
}
