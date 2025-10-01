import config from '../config/constants.js';

const { GRID_SIZE, GRID_ROWS, GRID_COLUMNS, SELECTORS } = config;

class CaptchaUtils {
    /**
     * Prepare grid task data from problem data
     * @param {Object} page - Playwright page instance
     * @param {Object} problemData - Problem data captured from API response
     * @returns {Object} - Task data for 2Captcha including body, comment, rows, columns
     */
    async prepareGridTask(page, problemData) {
        return await page.evaluate((args) => {
            const { problem, gridSize, gridRows, gridColumns } = args;
            const images = JSON.parse(problem.assets.images); // Array of base64 strings for tiles
            const comment = 'Choose all ' + problem.localized_assets.target0; // e.g., "Choose all the beds"

            // Create canvas 320x320
            const canvas = document.createElement('canvas');
            canvas.width = gridSize;
            canvas.height = gridSize;
            const ctx = canvas.getContext('2d');

            const tileSize = gridSize / gridRows; // Approximately 106.666

            return new Promise((resolve, reject) => {
                let loaded = 0;
                for (let i = 0; i < 9; i++) {
                    const img = new Image();
                    img.src = 'data:image/jpeg;base64,' + images[i];
                    img.onload = () => {
                        const row = Math.floor(i / gridColumns);
                        const col = i % gridColumns;
                        ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
                        loaded++;
                        if (loaded === 9) {
                            const fullBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
                            resolve({
                                body: fullBase64, 
                                comment, 
                                rows: gridRows, 
                                columns: gridColumns
                            });
                        }
                    };
                    img.onerror = () => reject(new Error(`Image load error for tile ${i}`));
                }
            });
        }, {
            problem: problemData,
            gridSize: GRID_SIZE,
            gridRows: GRID_ROWS,
            gridColumns: GRID_COLUMNS
        });
    }

    /**
     * Apply the solution by clicking tiles and confirming
     * @param {Object} page - Playwright page instance
     * @param {Object} solution - Solution object from 2Captcha
     */
    async applySolution(page, solution) {
        const clickTiles = solution.click || [];
        console.log('Tiles to click:', clickTiles);

        await page.evaluate((args) => {
            const { tiles, selectors } = args;
            const captchaEl = document.querySelector('#captchaContainer awswaf-captcha');
            if (!captchaEl || !captchaEl.shadowRoot) return;

            const shadow = captchaEl.shadowRoot;
            const buttons = shadow.querySelectorAll(selectors.canvasButtons);

            for (const num of tiles) {
                if (buttons[num - 1]) {
                    buttons[num - 1].click();
                }
            }

            // Click Confirm button
            const confirmButton = shadow.querySelector(selectors.confirmButton);
            if (confirmButton) {
                confirmButton.click();
            }
        }, {
            tiles: clickTiles,
            selectors: SELECTORS
        });
    }

    /**
     * Validate if problem data is available
     * @param {Object} problemData - Problem data to validate
     * @returns {boolean} - Whether problem data is valid
     */
    validateProblemData(problemData) {
        return problemData && 
               problemData.assets && 
               problemData.assets.images && 
               problemData.localized_assets && 
               problemData.localized_assets.target0;
    }

    /**
     * Get formatted comment from problem data
     * @param {Object} problemData - Problem data from API
     * @returns {string} - Formatted comment for CAPTCHA
     */
    getFormattedComment(problemData) {
        if (!this.validateProblemData(problemData)) {
            throw new Error('Invalid problem data');
        }
        return 'Choose all ' + problemData.localized_assets.target0;
    }

    /**
     * Check if CAPTCHA timeout has occurred
     * @param {number} startTime - Start time in milliseconds
     * @param {number} timeout - Timeout duration in milliseconds
     * @returns {boolean} - Whether timeout has occurred
     */
    hasTimedOut(startTime, timeout) {
        return (Date.now() - startTime) > timeout;
    }
}

export default CaptchaUtils;
