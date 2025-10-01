export default {
    // 2Captcha API Configuration
    API_KEY: process.env.CAPTCHA_API_KEY || 'YOUR_2CAPTCHA_API_KEY',
    CREATE_TASK_URL: 'https://api.2captcha.com/createTask',
    GET_RESULT_URL: 'https://api.2captcha.com/getTaskResult',
    
    // Retry and Timeout Configuration
    MAX_RETRIES: 3,
    CAPTCHA_TIMEOUT: 60000, // 60 seconds in milliseconds
    MAX_POLLING_ATTEMPTS: 50,
    POLLING_INTERVAL: 1000, // 1 second
    
    // Browser Configuration
    BROWSER_HEADLESS: false,
    PAGE_TIMEOUT: 300000, // 5 minutes
    
    // Target Website Configuration
    TARGET_URL: 'https://renprovider.com/provider-quick-search/home',
    
    // CAPTCHA Grid Configuration
    GRID_SIZE: 320,
    GRID_ROWS: 3,
    GRID_COLUMNS: 3,
    
    // Selectors
    SELECTORS: {
        captchaCheckbox: '#captchaCheckbox',
        captchaContainer: '#captchaContainer awswaf-captcha',
        successCheckbox: '#captchaCheckbox.gen-captcha-checkbox',
        confirmButton: '#amzn-btn-verify-internal',
        canvasButtons: 'canvas button'
    }
};