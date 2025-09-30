const {chromium} = require('playwright');
const axios = require('axios');

(async () => {
    const API_KEY = process.env.CAPTCHA_API_KEY;
    const CREATE_TASK_URL = 'https://api.2captcha.com/createTask';
    const GET_RESULT_URL = 'https://api.2captcha.com/getTaskResult';
    const MAX_RETRIES = 3; // Number of retries if CAPTCHA refreshes or fails
    const CAPTCHA_TIMEOUT = 60000; // 60 seconds in milliseconds

    // Launch browser
    const browser = await chromium.launch({headless: false}); // Set to true for headless mode
    const context = await browser.newContext();
    const page = await context.newPage();

    let captchaParams = null;

    // Intercept the response from the problem API to extract parameters
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.captcha.awswaf.com') && url.includes('/problem')) {
            try {
                const jsonResponse = await response.json();
                captchaParams = {
                    key: jsonResponse.key,
                    iv: jsonResponse.state.iv,
                    context: jsonResponse.state.payload,
                    problemUrl: url
                };
                console.log('Captured CAPTCHA parameters from problem API:', captchaParams);
            } catch (error) {
                console.error('Error parsing problem API response:', error);
            }
        }
    });

    async function solveCaptcha(params) {
        // Construct challengeScript and captchaScript from the problem URL
        let challengeScript = params.problemUrl.replace('captcha.awswaf.com', 'token.awswaf.com').replace(/\/problem\?.*/, '/challenge.js');
        let captchaScript = params.problemUrl.replace(/\/problem\?.*/, '/captcha.js');

        // Step 1: Submit task to 2Captcha
        const taskPayload = {
            clientKey: API_KEY,
            task: {
                type: 'AmazonTaskProxyless',
                websiteURL: 'https://renprovider.com/provider-quick-search/home',
                websiteKey: params.key,
                iv: params.iv,
                context: params.context,
                challengeScript: challengeScript, // Optional but included
                captchaScript: captchaScript // Optional but included
            }
        };

        const createResponse = await axios.post(CREATE_TASK_URL, taskPayload);
        if (createResponse.data.errorId !== 0) {
            throw new Error(`2Captcha createTask error: ${createResponse.data.errorDescription}`);
        }

        const taskId = createResponse.data.taskId;
        console.log(`Task submitted to 2Captcha. Task ID: ${taskId}`);

        // Step 2: Poll for result (timeout after 50 seconds to stay within 60s)
        let result;
        let attempts = 0;
        const maxAttempts = 50; // Poll for up to 50 seconds

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1s
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

    async function injectToken(page, solution) {
        const {captcha_voucher, existing_token} = solution;
        console.log('Injecting token:', {captcha_voucher, existing_token});

        const success = await page.evaluate((voucher, token) => {
            const captchaEl = document.querySelector('awswaf-captcha');
            if (!captchaEl || !captchaEl.shadowRoot) return false;

            const shadow = captchaEl.shadowRoot;

            // Inject captcha_voucher as property or hidden input
            captchaEl.captchaVoucher = voucher;

            let hiddenInput = shadow.querySelector('input[name="captcha_voucher"]');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'captcha_voucher';
                hiddenInput.value = voucher;
                shadow.appendChild(hiddenInput);
            } else {
                hiddenInput.value = voucher;
            }

            // Inject existing_token if provided
            if (token) {
                captchaEl.existingToken = token;
                let tokenInput = shadow.querySelector('input[name="existing_token"]');
                if (!tokenInput) {
                    tokenInput = document.createElement('input');
                    tokenInput.type = 'hidden';
                    tokenInput.name = 'existing_token';
                    tokenInput.value = token;
                    shadow.appendChild(tokenInput);
                } else {
                    tokenInput.value = token;
                }
            }

            // Submit the form or click verify button
            const form = shadow.querySelector('form');
            const verifyButton = shadow.querySelector('#amzn-btn-verify-internal');
            if (form) {
                form.submit();
                return true;
            } else if (verifyButton) {
                verifyButton.click();
                return true;
            }
            return false;
        }, captcha_voucher, existing_token);

        if (!success) {
            throw new Error('Failed to inject token or find submission mechanism.');
        }
    }

    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRIES && !success) {
        try {
            console.log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);

            // Navigate to the page (reload if retrying)
            if (retryCount > 0) {
                await page.reload({waitUntil: 'networkidle'});
            } else {
                await page.goto('https://renprovider.com/provider-quick-search/home', {waitUntil: 'networkidle'});
            }

            // Wait for CAPTCHA element and problem API response
            await page.waitForSelector('awswaf-captcha', {timeout: 10000});
            // Wait a bit for the network response to be captured
            await page.waitForTimeout(2000);

            if (!captchaParams || !captchaParams.key || !captchaParams.iv || !captchaParams.context) {
                throw new Error('Could not capture CAPTCHA parameters from problem API.');
            }

            // Start timer to track 60-second refresh window
            const startTime = Date.now();

            // Step 2: Solve CAPTCHA with 2Captcha
            const solution = await solveCaptcha(captchaParams);

            // Check if we're still within the 60-second window
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > CAPTCHA_TIMEOUT) {
                console.warn('CAPTCHA refresh likely occurred. Retrying...');
                retryCount++;
                continue;
            }

            // Step 3: Inject token and submit
            await injectToken(page, solution);

            // Wait to verify success (e.g., CAPTCHA disappears)
            await page.waitForTimeout(3000);
            const captchaStillVisible = await page.$('awswaf-captcha') !== null;
            if (!captchaStillVisible) {
                console.log('CAPTCHA bypassed successfully!');
                success = true;
            } else {
                console.warn('CAPTCHA still visible, likely refreshed or invalid token. Retrying...');
                retryCount++;
            }

        } catch (error) {
            console.error(`Error on attempt ${retryCount + 1}:`, error.message);
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
                console.error('Max retries reached. Failed to solve CAPTCHA.');
                break;
            }
            await page.waitForTimeout(1000); // Brief pause before retry
        } finally {
            // Reset params for next attempt
            captchaParams = null;
        }
    }

    // Clean up (keep browser open for inspection)
    // await browser.close();
})();