const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            // Ignore
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  let serverProcess;
  try {
    console.log('Starting server...');
    serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });

    // Wait for server to boot
    await sleep(2000);

    console.log('\n--- 1. Testing GET /tasks ---');
    const getTasksRes = await request('GET', '/tasks');
    console.log('Status Code:', getTasksRes.statusCode);
    console.log('Body:', getTasksRes.body);
    if (getTasksRes.statusCode !== 200 || !Array.isArray(getTasksRes.body) || getTasksRes.body.length !== 3) {
      throw new Error('GET /tasks failed - expected 3 tasks');
    }

    console.log('\n--- 2. Testing GET /tasks/1 ---');
    const getTask1Res = await request('GET', '/tasks/1');
    console.log('Status Code:', getTask1Res.statusCode);
    console.log('Body:', getTask1Res.body);
    if (getTask1Res.statusCode !== 200 || getTask1Res.body.title !== 'Buy milk') {
      throw new Error('GET /tasks/1 failed');
    }

    console.log('\n--- 3. Testing GET /tasks/999 (Not Found) ---');
    const getTaskNotFound = await request('GET', '/tasks/999');
    console.log('Status Code:', getTaskNotFound.statusCode);
    console.log('Body:', getTaskNotFound.body);
    if (getTaskNotFound.statusCode !== 404 || getTaskNotFound.body.error !== 'Task not found') {
      throw new Error('GET /tasks/999 failed');
    }

    console.log('\n--- 4. Testing POST /tasks (Validation Error) ---');
    const postInvalidRes = await request('POST', '/tasks', {});
    console.log('Status Code:', postInvalidRes.statusCode);
    console.log('Body:', postInvalidRes.body);
    if (postInvalidRes.statusCode !== 400) {
      throw new Error('POST /tasks validation failed');
    }

    console.log('\n--- 5. Testing POST /tasks (Success) ---');
    const postSuccessRes = await request('POST', '/tasks', { title: 'Learn SQLite', done: false });
    console.log('Status Code:', postSuccessRes.statusCode);
    console.log('Body:', postSuccessRes.body);
    if (postSuccessRes.statusCode !== 201 || postSuccessRes.body.title !== 'Learn SQLite' || postSuccessRes.body.done !== false) {
      throw new Error('POST /tasks success failed');
    }
    const createdId = postSuccessRes.body.id;

    console.log('\n--- 6. Testing GET /tasks after creation ---');
    const getTasksAfterPost = await request('GET', '/tasks');
    console.log('Count:', getTasksAfterPost.body.length);
    if (getTasksAfterPost.body.length !== 4) {
      throw new Error('GET /tasks count after POST is incorrect');
    }

    console.log('\n--- 7. Testing PUT /tasks/:id ---');
    const putRes = await request('PUT', `/tasks/${createdId}`, { title: 'Master SQLite', done: true });
    console.log('Status Code:', putRes.statusCode);
    console.log('Body:', putRes.body);
    if (putRes.statusCode !== 200 || putRes.body.title !== 'Master SQLite' || putRes.body.done !== true) {
      throw new Error('PUT /tasks/:id failed');
    }

    console.log('\n--- 8. Testing GET /stats ---');
    const statsRes = await request('GET', '/stats');
    console.log('Status Code:', statsRes.statusCode);
    console.log('Body:', statsRes.body);
    if (statsRes.statusCode !== 200 || statsRes.body.total !== 4 || statsRes.body.completed !== 2) {
      throw new Error('GET /stats failed');
    }

    console.log('\n--- 9. Testing Optional Filtering /tasks?done=true ---');
    const filterRes = await request('GET', '/tasks?done=true');
    console.log('Status Code:', filterRes.statusCode);
    console.log('Completed Tasks count:', filterRes.body.length);
    if (filterRes.statusCode !== 200 || filterRes.body.length !== 2) {
      throw new Error('Filtering failed');
    }

    console.log('\n--- 10. Testing Optional Search /tasks?search=SQLite ---');
    const searchRes = await request('GET', '/tasks?search=SQLite');
    console.log('Status Code:', searchRes.statusCode);
    console.log('Search Results:', searchRes.body);
    if (searchRes.statusCode !== 200 || searchRes.body.length !== 1 || searchRes.body[0].title !== 'Master SQLite') {
      throw new Error('Search failed');
    }

    console.log('\n--- 11. Testing DELETE /tasks/:id ---');
    const deleteRes = await request('DELETE', `/tasks/${createdId}`);
    console.log('Status Code:', deleteRes.statusCode);
    console.log('Body:', deleteRes.body);
    if (deleteRes.statusCode !== 200) {
      throw new Error('DELETE failed');
    }

    console.log('\nStopping server to test persistence across restarts...');
    serverProcess.kill();
    await sleep(2000);

    console.log('\nStarting server again...');
    serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });
    await sleep(2000);

    console.log('\n--- 12. Testing GET /tasks after restart ---');
    const getTasksAfterRestart = await request('GET', '/tasks');
    console.log('Count:', getTasksAfterRestart.body.length);
    if (getTasksAfterRestart.body.length !== 3) {
      throw new Error('Persistence test failed: count is not 3');
    }
    // Make sure 'Master SQLite' is gone (it was deleted)
    const exists = getTasksAfterRestart.body.some(t => t.title === 'Master SQLite');
    if (exists) {
      throw new Error('Persistence test failed: deleted task still exists');
    }

    console.log('\nAll tests passed successfully! 🎉');
  } catch (error) {
    console.error('\nTest failed ❌:', error.message);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runTests();
