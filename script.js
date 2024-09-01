document.getElementById('upload-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const fileInput = document.getElementById('ics-file');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const calendarData = e.target.result;

            // Show the loading animation
            document.querySelector('.container').style.display = 'none';
            const loadingAnimation = document.getElementById('loading-animation');
            loadingAnimation.style.display = 'flex';

            // Delay to simulate the analysis duration
            setTimeout(() => {
                analyzeICS(calendarData);
                // Hide the loading animation
                loadingAnimation.style.display = 'none';
                // Show the results frame
                const resultsFrame = document.getElementById('results-frame');
                resultsFrame.style.display = 'block';
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


function analyzeICS(icsContent) {

    const startTime = performance.now();

    const resultsElement = document.getElementById('results');
    const jcalData = ICAL.parse(icsContent);
    const calendar = new ICAL.Component(jcalData);
    let events = calendar.getAllSubcomponents('vevent');

    // Sort events by start date
    events = events.map(event => new ICAL.Event(event)).sort((a, b) => a.startDate.toJSDate() - b.startDate.toJSDate());

    console.log(events)

    // Filter out past events that were not canceled
    const now = new Date();
    const filteredEvents = events.filter(event => event.status !== "CANCELLED" && event.startDate.toJSDate() <= now);

    // Calculate load time
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;

    // Display basic information
    //resultsElement.textContent = `Loaded calendar in ${(elapsedTime/1000).toFixed(2)}s\n`;

    // Example: Get all people from events
    const peopleData = getAllPeople(filteredEvents);

    // Example: Display top hangouts
    resultsElement.textContent += `Wow you must like these people:\n\n` + show(peopleData, n=10, verbose=false);

    // Perform your analysis with icsData and display the results
    const results = resultsElement.textContent

    // Show the results frame and hide the upload container
    document.querySelector('.container').style.display = 'none';
    const resultsFrame = document.getElementById('results-frame');
    resultsFrame.style.display = 'block';
    
    // Populate the results
    document.getElementById('results').textContent = results;
}

function getAllPeople(events) {
    const data = {}; // Name: {aliases, hours_spent, hangouts_list}
    
    events.forEach(event => {
        const summary = event.summary;
        const description = event.description;
        const start = event.startDate.toJSDate();
        const end = event.endDate.toJSDate();
        const duration = (end - start) / 3600000; // Duration in hours
        const organizer = getNamesEmails(event, 'organizer').names.join('');
        const attendee_data = getNamesEmails(event, 'attendee')
        const attendees = attendee_data.names.join(', ');
        const status = findStatus(event, 'lponssen@scu.edu')
        const event_status = getEventStatus(event)

        if (event_status === 'CANCELLED' && organizer) {
            console.log(`${summary}: ${organizer}, ${attendees}`)
        }

        //console.log(`summ:${summary}\ndur:${duration.toFixed(1)}hrs\norg:${organizer}\natt:${attendees}\nstat:${status}`)

        if (status !== 'DECLINED' && status !== 'NEEDS-ACTION' && event_status !== 'CANCELLED') {

            attendee_data.names.forEach(name => {
                if (!data[name]) {
                    data[name] = {
                        "aliases": [],
                        "hours_spent": 0,
                        "hangouts_list": []
                    };
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
