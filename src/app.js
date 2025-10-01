import BrowserUtils from '../utils/browserUtils.js';
import ApiUtils from '../utils/apiUtils.js';
import CaptchaUtils from '../utils/captchaUtils.js';
import config from '../config/constants.js';

const { MAX_RETRIES, CAPTCHA_TIMEOUT } = config;

class CaptchaSolver {
    constructor() {
        this.browserUtils = new BrowserUtils();
        this.apiUtils = new ApiUtils();
        this.captchaUtils = new CaptchaUtils();
    }

    /**
     * Main method to run the CAPTCHA solver
     */
    async run() {
        try {
            // Initialize browser
            console.log('Initializing browser...');
            await this.browserUtils.initializeBrowser();

            let retryCount = 0;
            let success = false;

            while (retryCount < MAX_RETRIES && !success) {
                try {
                    console.log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
                    success = await this.attemptSolve(retryCount > 0);
                    
                    if (!success) {
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
                    
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } finally {
                    this.browserUtils.resetProblemData();
                }
            }

            if (success) {
                console.log('CAPTCHA bypassed successfully!');
            } else {
                console.error('Failed to bypass CAPTCHA after all attempts.');
            }

        } catch (error) {
            console.error('Fatal error:', error);
        } finally {
            // Uncomment the line below if you want to close browser automatically
            // await this.browserUtils.closeBrowser();
        }
    }

    /**
     * Attempt to solve the CAPTCHA
     * @param {boolean} isRetry - Whether this is a retry attempt
     * @returns {boolean} - Whether the attempt was successful
     */
    async attemptSolve(isRetry = false) {
        const startTime = Date.now();

        // Navigate to target page
        console.log(isRetry ? 'Reloading page...' : 'Navigating to target page...');
        await this.browserUtils.navigateToTarget(isRetry);

        // Click CAPTCHA checkbox
        console.log('Clicking CAPTCHA checkbox...');
        await this.browserUtils.clickCaptchaCheckbox();

        // Wait for CAPTCHA container
        console.log('Waiting for CAPTCHA container...');
        await this.browserUtils.waitForCaptchaContainer();

        // Get problem data
        const problemData = this.browserUtils.getProblemData();
        if (!problemData) {
            throw new Error('Could not capture problem API response.');
        }

        // Validate problem data
        if (!this.captchaUtils.validateProblemData(problemData)) {
            throw new Error('Invalid problem data structure.');
        }

        // Check for timeout before proceeding
        if (this.captchaUtils.hasTimedOut(startTime, CAPTCHA_TIMEOUT)) {
            console.warn('CAPTCHA refresh likely occurred due to timeout. Retrying...');
            return false;
        }

        // Prepare grid task data
        console.log('Preparing GridTask data...');
        const taskData = await this.captchaUtils.prepareGridTask(
            this.browserUtils.getPage(), 
            problemData
        );
        console.log('Prepared GridTask data with comment:', taskData.comment);

        // Solve with 2Captcha
        console.log('Solving CAPTCHA with 2Captcha...');
        const solution = await this.apiUtils.solveCaptcha(taskData);

        // Check for timeout after solving
        if (this.captchaUtils.hasTimedOut(startTime, CAPTCHA_TIMEOUT)) {
            console.warn('CAPTCHA refresh likely occurred during solving. Retrying...');
            return false;
        }

        // Apply solution
        console.log('Applying solution...');
        await this.captchaUtils.applySolution(this.browserUtils.getPage(), solution);

        // Verify success
        console.log('Verifying CAPTCHA solution...');
        return await this.browserUtils.isCaptchaSolved();
    }
}

// Export for use in other files
export default CaptchaSolver;

// Run the application if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const solver = new CaptchaSolver();
    solver.run().catch(console.error);
}
