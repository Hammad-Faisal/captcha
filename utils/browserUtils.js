import { chromium } from 'playwright';
import config from '../config/constants.js';

const { BROWSER_HEADLESS, PAGE_TIMEOUT, TARGET_URL, SELECTORS } = config;

class BrowserUtils {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.problemData = null;
    }

    /**
     * Initialize browser, context, and page
     */
    async initializeBrowser() {
        this.browser = await chromium.launch({ headless: BROWSER_HEADLESS });
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
        
        // Set up response interceptor for problem API
        this.setupResponseInterceptor();
        
        return this.page;
    }

    /**
     * Set up response interceptor to capture problem API data
     */
    setupResponseInterceptor() {
        this.page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('.captcha.awswaf.com') && url.includes('/problem')) {
                try {
                    this.problemData = await response.json();
                    console.log('Captured problem API response.');
                } catch (error) {
                    console.error('Error parsing problem API response:', error);
                }
            }
        });
    }

    /**
     * Navigate to target URL
     * @param {boolean} isRetry - Whether this is a retry attempt
     */
    async navigateToTarget(isRetry = false) {
        if (isRetry) {
            await this.page.reload({ timeout: PAGE_TIMEOUT, waitUntil: 'networkidle' });
        } else {
            await this.page.goto(TARGET_URL, {
                waitUntil: 'networkidle', 
                timeout: PAGE_TIMEOUT
            });
        }
    }

    /**
     * Wait for and click the CAPTCHA checkbox
     */
    async clickCaptchaCheckbox() {
        await this.page.waitForSelector(SELECTORS.captchaCheckbox, { state: "visible" });
        await this.page.locator(SELECTORS.captchaCheckbox).click();
    }

    /**
     * Wait for CAPTCHA container to be visible
     */
    async waitForCaptchaContainer() {
        await this.page.waitForSelector(SELECTORS.captchaContainer, { state: "visible" });
        await this.page.waitForTimeout(2000);
    }

    /**
     * Check if CAPTCHA was successfully solved
     */
    async isCaptchaSolved() {
        await this.page.waitForTimeout(3000);
        const successCheckbox = await this.page.$(SELECTORS.successCheckbox);
        return !!successCheckbox;
    }

    /**
     * Get the captured problem data
     */
    getProblemData() {
        return this.problemData;
    }

    /**
     * Reset problem data for next attempt
     */
    resetProblemData() {
        this.problemData = null;
    }

    /**
     * Close the browser
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    /**
     * Get current page instance
     */
    getPage() {
        return this.page;
    }
}

export default BrowserUtils;
