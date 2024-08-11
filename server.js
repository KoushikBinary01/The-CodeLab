const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const util = require('util');
const os = require('os');
const mongoose = require('mongoose');
const Problem = require('./problem');
const Contest = require('./contest');
const path = require('path');
const { exec, spawn } = require('child_process');  // Make sure this line is present

const port = 3000;
const app = express();

app.use(bodyParser.json());
app.use(express.static('./'));

const execPromise = util.promisify(exec);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/codingPlatform', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));


  async function compileAndRun(code, input) {
    const fileName = `temp_${Date.now()}.c`;
    const executableName = `temp_${Date.now()}${os.platform() === 'win32' ? '.exe' : ''}`;
    const inputFileName = `input_${Date.now()}.txt`;

    try {
        await fs.writeFile(fileName, code);
        await fs.writeFile(inputFileName, input);

        const fullFilePath = path.join(__dirname, fileName);
        const fullExecutablePath = path.join(__dirname, executableName);
        
        // Compile the code
        await execPromise(`gcc "${fullFilePath}" -o "${fullExecutablePath}"`);

        // Run the compiled program and measure execution time
        const startTime = process.hrtime();
        const { stdout, stderr } = await execPromise(`"${fullExecutablePath}" < "${inputFileName}"`, { timeout: 5000 });
        const endTime = process.hrtime(startTime);
        const executionTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2); // in milliseconds

        if (stderr) {
            throw new Error(`Runtime error: ${stderr}`);
        }

        return { output: stdout.trim(), executionTime: `${executionTime} ms` };
    } finally {
        // Clean up files
        try {
            await fs.unlink(fileName);
            await fs.unlink(executableName);
            await fs.unlink(inputFileName);
        } catch (err) {
            console.error('Error cleaning up files:', err);
        }
    }
}

app.post('/api/compile', async (req, res) => {
    const { code, input } = req.body;
    try {
        const result = await compileAndRun(code, input);
        res.json(result);
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.post('/api/submit', async (req, res) => {
    const { problemId, code } = req.body;
    try {
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        console.log('Problem found:', problem);

        let passedTestCases = 0;
        let totalExecutionTime = 0;
        const testCaseResults = [];
        let allTestCasesPassed = true;

        for (let i = 0; i < problem.testCases.length; i++) {
            const testCase = problem.testCases[i];
            console.log(`Running test case ${i + 1}:`, testCase);

            try {
                // Compile and run the code for each test case
                const result = await compileAndRun(code, testCase.input);
                console.log('Execution result:', result);

                // Compare the result with the expected output
                const expectedOutput = testCase.output.toString().trim();
                const actualOutput = result.output.toString().trim();

                console.log('Expected output:', expectedOutput);
                console.log('Actual output:', actualOutput);
                console.log('Execution time:', result.executionTime);

                totalExecutionTime += parseFloat(result.executionTime);

                const passed = expectedOutput === actualOutput;
                if (passed) {
                    passedTestCases++;
                } else {
                    allTestCasesPassed = false;
                }

                testCaseResults.push({
                    testCaseNumber: i + 1,
                    passed: passed,
                    executionTime: result.executionTime,
                    expectedOutput: expectedOutput,
                    actualOutput: actualOutput
                });

            } catch (error) {
                console.error(`Error in test case ${i + 1}:`, error.message);
                allTestCasesPassed = false;
                testCaseResults.push({
                    testCaseNumber: i + 1,
                    passed: false,
                    error: error.message
                });
            }
        }

        const totalTestCases = problem.testCases.length;
        const score = Math.round((passedTestCases / totalTestCases) * 100);
        const averageExecutionTime = (totalExecutionTime / totalTestCases).toFixed(2);

        const result = {
            passed: allTestCasesPassed,
            totalTestCases: totalTestCases,
            passedTestCases: passedTestCases,
            score: score,
            averageExecutionTime: `${averageExecutionTime} ms`,
            testCaseResults: testCaseResults
        };

        console.log('Final result:', result);
        res.json(result);
    } catch (error) {
        console.error('Error in submission:', error);
        res.status(500).json({ error: 'An error occurred during submission' });
    }
});


app.get('/api/problems', async (req, res) => {
    try {
        const problems = await Problem.find({}, 'title difficulty');
        res.json(problems);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching problems', error: error.message });
    }
});

app.get('/api/contests', async (req, res) => {
    try {
        const contests = await Contest.find({}, 'title startTime endTime');
        res.json(contests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching contests', error: error.message });
    }
});

app.get('/api/problems/:id', async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) {
            return res.status(404).json({ message: 'Problem not found' });
        }
        res.json(problem);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching problem', error: error.message });
    }
});

app.get('/api/contests/:id', async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.id);
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        res.json(contest);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching contest', error: error.message });
    }
});


function runTestCase(executablePath, input) {
    return new Promise((resolve, reject) => {
        const child = spawn(executablePath, { shell: true });
        let output = '';
        let error = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            error += data.toString();
        });

        child.on('error', (err) => {
            reject(new Error(`Failed to start subprocess: ${err}`));
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}: ${error}`));
            } else {
                resolve(output);
            }
        });

        // Send input to the process
        child.stdin.write(input);
        child.stdin.end();

        // Set a timeout for the process
        const timeout = setTimeout(() => {
            child.kill(); // Sends SIGTERM
            reject(new Error('Execution timed out'));
        }, 5000); // 5 seconds timeout

        // Clear the timeout on successful completion
        child.on('exit', () => clearTimeout(timeout));
    });
}





app.post('/api/submit-contest', async (req, res) => {
    const { contestId, code } = req.body;
    // Implement contest submission logic here
    res.json({ message: 'Contest submission received', contestId, codeLength: code.length });
});

app.get('/problem/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/contest/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Fetch all problems for contest creation
app.get('/api/problems-for-contest', async (req, res) => {
    try {
        const problems = await Problem.find({}, 'title difficulty');
        res.json(problems);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching problems', error: error.message });
    }
});

// Create a new contest
app.post('/api/contests', async (req, res) => {
    try {
        const { title, description, startTime, endTime, problemIds } = req.body;

        // Validate input
        if (new Date(startTime) <= new Date()) {
            return res.status(400).json({ message: 'Start time must be in the future' });
        }
        if (new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({ message: 'End time must be after start time' });
        }

        // Create new contest
        const newContest = new Contest({
            title,
            description,
            startTime,
            endTime,
            problems: problemIds,
            createdBy: req.user._id // Assuming you have user authentication implemented
        });

        await newContest.save();
        res.status(201).json(newContest);
    } catch (error) {
        res.status(500).json({ message: 'Error creating contest', error: error.message });
    }
});

