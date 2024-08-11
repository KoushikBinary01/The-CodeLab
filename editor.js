let editor;
let currentProblemId = null;

document.addEventListener('DOMContentLoaded', () => {
    setupEditor();
    setupNavigation();
    fetchProblems();
    fetchContests();
});

function setupEditor() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.32.1/min/vs' }});

    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
            language: 'c',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });

        document.getElementById('run-button').addEventListener('click', runCode);
    });
}

function setupNavigation() {
    window.showPage = function(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageId}-page`).classList.add('active');

        if (pageId === 'editor') {
            if (editor) {
                editor.layout();
                if (!currentProblemId) {
                    editor.setValue('#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}');
                    document.getElementById('problem-description').innerHTML = '';
                    document.getElementById('submit-solution').style.display = 'none';
                }
            }
        } else if (pageId === 'problem-statements') {
            fetchProblems();
            currentProblemId = null;
        } else if (pageId === 'contests') {
            fetchContests();
            setupContestCreation();
        }
    };
}

function runCode() {
    const code = editor.getValue();
    const input = document.getElementById('input-area').value;
    
    const outputElement = document.getElementById('output');
    const executionTimeElement = document.getElementById('execution-time');
    
    outputElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    executionTimeElement.textContent = '';

    fetch('/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input })
    })
    .then(response => response.json())
    .then(data => {
        executionTimeElement.innerHTML = '<i class="fas fa-clock"></i> Execution Time: ' + data.executionTime;
        
        if (data.error) {
            outputElement.innerHTML = '<span class="text-danger">Error: ' + data.error + '</span>';
        } else {
            outputElement.textContent = data.output || "No output";
        }
    })
    .catch(error => {
        outputElement.innerHTML = '<span class="text-danger">Error: ' + error.message + '</span>';
    });
}

async function fetchProblems() {
    try {
        const response = await fetch('/api/problems');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const problems = await response.json();
        displayProblems(problems);
    } catch (error) {
        console.error('Error fetching problems:', error);
    }
}

function displayProblems(problems) {
    const problemList = document.getElementById('problem-list');
    problemList.innerHTML = '';

    problems.forEach(problem => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${problem.title}</h5>
                    <p class="card-text">Difficulty: ${problem.difficulty}</p>
                    <button class="btn btn-primary" onclick="loadProblem('${problem._id}')">Solve</button>
                </div>
            </div>
        `;
        problemList.appendChild(col);
    });
}

async function loadProblem(problemId) {
    try {
        const response = await fetch(`/api/problems/${problemId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const problem = await response.json();
        displayProblemDetails(problem);
        currentProblemId = problemId;
    } catch (error) {
        console.error('Error loading problem:', error);
    }
}

function displayProblemDetails(problem) {
    showPage('editor');
    document.querySelector('#editor-page h2').innerHTML = `<i class="fas fa-tasks"></i> ${problem.title}`;
    
    const problemDescription = document.getElementById('problem-description');
    problemDescription.innerHTML = `
        <h3>Problem Description</h3>
        <p>${problem.description}</p>
        <h4>Input Format</h4>
        <p>${problem.inputFormat}</p>
        <h4>Output Format</h4>
        <p>${problem.outputFormat}</p>
        <h4>Constraints</h4>
        <p>${problem.constraints}</p>
        <h4>Sample Input</h4>
        <pre>${problem.sampleInput}</pre>
        <h4>Sample Output</h4>
        <pre>${problem.sampleOutput}</pre>
    `;

    editor.setValue(`#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}`);

    const submitButton = document.getElementById('submit-solution');
    submitButton.style.display = 'block';
    submitButton.onclick = submitSolution;
}


function submitSolution() {
    if (!currentProblemId) {
        alert('No problem selected');
        return;
    }

    const code = editor.getValue();
    const submitButton = document.getElementById('submit-solution');

    submitButton.disabled = true; // Disable the submit button while the submission is processing

    fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: currentProblemId, code })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to submit solution');
        }
        return response.json();
    })
    .then(result => {
        alert(`Submission result: ${result.passed ? 'Passed' : 'Failed'}, Score: ${result.score}`);
    })
    .catch(error => {
        console.error('Error submitting solution:', error);
        alert('Error submitting solution: ' + error.message);
    })
    .finally(() => {
        submitButton.disabled = false; // Re-enable the submit button
    });
}



async function fetchContests() {
    try {
        const response = await fetch('/api/contests');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const contests = await response.json();
        displayContests(contests);
    } catch (error) {
        console.error('Error fetching contests:', error);
    }
}

function displayContests(contests) {
    const contestList = document.getElementById('contest-list');
    contestList.innerHTML = '';

    contests.forEach(contest => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${contest.title}</h5>
                    <p class="card-text">Start: ${new Date(contest.startTime).toLocaleString()}</p>
                    <p class="card-text">End: ${new Date(contest.endTime).toLocaleString()}</p>
                    <button class="btn btn-primary" onclick="loadContest('${contest._id}')">Enter Contest</button>
                </div>
            </div>
        `;
        contestList.appendChild(col);
    });
}

async function setupContestCreation() {
    try {
        const problemsResponse = await fetch('/api/problems-for-contest');
        const problems = await problemsResponse.json();

        const contestForm = `
            <h3>Create a New Contest</h3>
            <form id="create-contest-form">
                <div class="mb-3">
                    <label for="contest-title" class="form-label">Contest Title</label>
                    <input type="text" class="form-control" id="contest-title" required>
                </div>
                <div class="mb-3">
                    <label for="contest-description" class="form-label">Description</label>
                    <textarea class="form-control" id="contest-description" rows="3"></textarea>
                </div>
                <div class="mb-3">
                    <label for="contest-start-time" class="form-label">Start Time</label>
                    <input type="datetime-local" class="form-control" id="contest-start-time" required>
                </div>
                <div class="mb-3">
                    <label for="contest-end-time" class="form-label">End Time</label>
                    <input type="datetime-local" class="form-control" id="contest-end-time" required>
                </div>
                <div class="mb-3">
                    <label for="contest-problems" class="form-label">Select Problems</label>
                    <select multiple class="form-select" id="contest-problems" required>
                        ${problems.map(problem => `<option value="${problem._id}">${problem.title}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Create Contest</button>
            </form>
        `;

        document.getElementById('contest-creation-container').innerHTML = contestForm;

        document.getElementById('create-contest-form').addEventListener('submit', createContest);
    } catch (error) {
        console.error('Error setting up contest creation:', error);
    }
}

async function createContest(e) {
    e.preventDefault();
    const formData = {
        title: document.getElementById('contest-title').value,
        description: document.getElementById('contest-description').value,
        startTime: new Date(document.getElementById('contest-start-time').value).toISOString(),
        endTime: new Date(document.getElementById('contest-end-time').value).toISOString(),
        problemIds: Array.from(document.getElementById('contest-problems').selectedOptions).map(option => option.value)
    };

    try {
        const response = await fetch('/api/contests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create contest');
        }

        const result = await response.json();
        alert('Contest created successfully!');
        fetchContests();
    } catch (error) {
        alert(`Error creating contest: ${error.message}`);
        console.error('Error creating contest:', error);
    }
}


function loadContest(contestId) {
    // Implement contest loading logic here
    console.log(`Loading contest: ${contestId}`);
}
