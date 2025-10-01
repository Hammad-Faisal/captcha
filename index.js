const {chromium} = require('playwright');
const axios = require('axios');

(async () => {
    // Replace with your actual 2Captcha API key
    const API_KEY = 'YOUR_2CAPTCHA_API_KEY';
    const CREATE_TASK_URL = 'https://api.2captcha.com/createTask';
    const GET_RESULT_URL = 'https://api.2captcha.com/getTaskResult';
    const MAX_RETRIES = 3; // Number of retries if CAPTCHA refreshes or fails
    const CAPTCHA_TIMEOUT = 60000; // 60 seconds in milliseconds

    // Launch browser
    const browser = await chromium.launch({headless: false}); // Set to true for headless mode
    const context = await browser.newContext();
    const page = await context.newPage();

    let problemData = null;

    // Intercept the response from the problem API to get JSON
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.captcha.awswaf.com') && url.includes('/problem')) {
            try {
                problemData = await response.json();
                console.log('Captured problem API response.');
            } catch (error) {
                console.error('Error parsing problem API response:', error);
            }
        }
    });

    async function prepareGridTask(page) {
        return await page.evaluate((problem) => {
            const images = JSON.parse(problem.assets.images); // Array of base64 strings for tiles
            const comment = 'Choose all ' + problem.localized_assets.target0; // e.g., "Choose all the beds"

            // Create canvas 320x320
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 320;
            const ctx = canvas.getContext('2d');

            const tileSize = 320 / 3; // Approximately 106.666

            return new Promise((resolve, reject) => {
                let loaded = 0;
                for (let i = 0; i < 9; i++) {
                    const img = new Image();
                    img.src = 'data:image/jpeg;base64,' + images[i]; // Removed replace
                    img.onload = () => {
                        const row = Math.floor(i / 3);
                        const col = i % 3;
                        ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
                        loaded++;
                        if (loaded === 9) {
                            const fullBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
                            resolve({body: fullBase64, comment, rows: 3, columns: 3});
                        }
                    };
                    img.onerror = () => reject(new Error(`Image load error for tile ${i}`)); // Fixed to pass Error, not Event
                }
            });
        }, problemData);
    }

    async function solveCaptcha(taskData) {
        // Submit task to 2Captcha as GridTask
        const taskPayload = {
            clientKey: API_KEY,
            task: {
                type: 'GridTask',
                body: taskData.body,
                comment: taskData.comment,
                rows: taskData.rows,
                columns: taskData.columns,
                imgType: 'recaptcha'
            }
        };

        const createResponse = await axios.post(CREATE_TASK_URL, taskPayload);
        if (createResponse.data.errorId !== 0) {
            throw new Error(`2Captcha createTask error: ${createResponse.data.errorDescription}`);
        }

        const taskId = createResponse.data.taskId;
        console.log(`Task submitted to 2Captcha. Task ID: ${taskId}`);

        // Poll for result (timeout after 50 seconds)
        let result;
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const resultResponse = await axios.post(GET_RESULT_URL, {clientKey: API_KEY, taskId});
            result = resultResponse.data;

            if (result.status === 'ready') {
                console.log('CAPTCHA solved by 2Captcha!');
                return result.solution;
            } else if (result.status === 'processing') {
                console.log(`Still processing... (${attempts + 1}/${maxAttempts})`);
            } else {
                throw new Error(`2Captcha error: ${result.errorDescription}`);
            }

            attempts++;
        }

        throw new Error('2Captcha solve timed out after 50 seconds.');
    }

    async function applySolution(page, solution) {
        const clickTiles = solution.click || [];
        console.log('Tiles to click:', clickTiles);

        await page.evaluate((tiles) => {
            const captchaEl = document.querySelector('#captchaContainer awswaf-captcha');
            if (!captchaEl || !captchaEl.shadowRoot) return;

            const shadow = captchaEl.shadowRoot;
            const buttons = shadow.querySelectorAll('canvas button');

            for (const num of tiles) {
                if (buttons[num - 1]) {
                    buttons[num - 1].click();
                }
            }

            // Click Confirm button
            const confirmButton = shadow.querySelector('#amzn-btn-verify-internal');
            if (confirmButton) {
                confirmButton.click();
            }
        }, clickTiles);
    }

    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRIES && !success) {
        try {
            console.log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);

            if (retryCount > 0) {
                await page.reload({timeout: 300000, waitUntil: 'networkidle'});
            } else {
                await page.goto('https://renprovider.com/provider-quick-search/home', {
                    waitUntil: 'networkidle', timeout: 300000
                });
            }

            // Wait for CAPTCHA and problem API
            await page.waitForSelector('#captchaCheckbox', {state: "visible"});
            await page.locator("#captchaCheckbox").click()

            await page.waitForSelector('#captchaContainer awswaf-captcha', {state: "visible"});
            await page.waitForTimeout(2000);

            if (!problemData) {
                throw new Error('Could not capture problem API response.');
            }

            const startTime = Date.now();

            // Prepare grid task data
            const taskData = await prepareGridTask(page, problemData);
            console.log('Prepared GridTask data with comment:', taskData.comment);

            // Solve with 2Captcha
            const solution = await solveCaptcha(taskData);

            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > CAPTCHA_TIMEOUT) {
                console.warn('CAPTCHA refresh likely occurred. Retrying...');
                retryCount++;
                continue;
            }

            // Apply solution (click tiles and confirm)
            await applySolution(page, solution);

            // Verify success by checking if the checkbox has the class 'gen-captcha-checkbox'
            await page.waitForTimeout(3000);
            const successCheckbox = await page.$('#captchaCheckbox.gen-captcha-checkbox');
            if (successCheckbox) {
                console.log('CAPTCHA bypassed successfully!');
                success = true;
            } else {
                console.warn('CAPTCHA not bypassed. Retrying...');
                retryCount++;
            }

        } catch (error) {
            console.error(`Error on attempt ${retryCount + 1}:`, error.message);
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
                console.error('Max retries reached. Failed to solve CAPTCHA.');
                break;
            }
            await page.waitForTimeout(1000);
        } finally {
            problemData = null; // Reset for next attempt
        }
    }

    // Clean up
    // await browser.close();
})();