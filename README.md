# Renaissance CAPTCHA Solver

A lightweight, modular CAPTCHA solver for AWS WAF CAPTCHAs using 2Captcha and Playwright. Built with modern ES6 modules and minimal dependencies.

## Project Structure

```
renaissance-catptcha/
├── src/
│   └── app.js              # Main application file
├── utils/
│   ├── browserUtils.js     # Browser management utilities
│   ├── apiUtils.js         # 2Captcha API utilities
│   └── captchaUtils.js     # CAPTCHA processing utilities
├── config/
│   └── constants.js        # Configuration constants
├── package.json            # Project configuration
├── .env                    # Environment variables (optional)
└── README.md              # This file
```

## Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```
   
   **Note**: Only Playwright is required as a dependency! We use native Node.js features for HTTP requests and environment variables.

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

3. **Set your 2Captcha API key:**
   
   **Option 1**: Export as environment variable:
   ```bash
   export CAPTCHA_API_KEY=your_2captcha_api_key_here
   npm start
   ```
   
   **Option 2**: Pass directly when running:
   ```bash
   CAPTCHA_API_KEY=your_2captcha_api_key_here npm start
   ```
   
   **Option 3**: Create a `.env` file (you'll need to handle loading yourself):
   ```bash
   echo "CAPTCHA_API_KEY=your_2captcha_api_key_here" > .env
   # Then export it: source .env && npm start
   ```

## Usage

### Running the application:

```bash
# Using npm scripts
npm start
# or
npm run captcha
# or
npm run dev
```

### Direct execution:
```bash
node src/app.js
```

## Configuration

All configuration is centralized in `config/constants.js`:

- **API Configuration**: 2Captcha API URLs and key (from environment variables)
- **Retry Settings**: Max retries and timeout values
- **Browser Settings**: Headless mode and timeouts
- **Target Website**: URL and selectors
- **CAPTCHA Grid**: Size and dimensions

**Zero-dependency configuration**: No external libraries needed for config management!

## Architecture

### Classes and Utilities

1. **CaptchaSolver** (`src/app.js`)
   - Main orchestrator class
   - Manages the complete workflow
   - Handles retries and error management

2. **BrowserUtils** (`utils/browserUtils.js`)
   - Browser initialization and management
   - Page navigation and interaction
   - Response interception for API data

3. **ApiUtils** (`utils/apiUtils.js`)
   - 2Captcha API integration using native `fetch()`
   - Task submission and result polling
   - Error handling for API responses
   - Zero external HTTP dependencies

4. **CaptchaUtils** (`utils/captchaUtils.js`)
   - Grid task preparation
   - Solution application
   - Data validation utilities

## Environment Variables

- `CAPTCHA_API_KEY`: Your 2Captcha API key (required)

**Note**: No .env file loading is included by default. Set environment variables directly in your shell or pass them when running the application.

## Features

- **🏗️ Modern ES6 Modules**: Clean `import`/`export` syntax
- **⚡ Minimal Dependencies**: Only Playwright required (75% reduction!)
- **🌐 Native HTTP**: Uses built-in `fetch()` instead of axios
- **🔧 Zero-Config Environment**: Direct environment variable usage
- **🏛️ Modular Architecture**: Clean separation of concerns
- **⚠️ Error Handling**: Comprehensive error management and retries
- **⚙️ Configurable**: Easy to modify settings and parameters
- **📝 Logging**: Detailed console output for debugging
- **⏱️ Timeout Management**: Handles CAPTCHA refresh scenarios

## Development

### Modern JavaScript
- **ES6 Modules**: Uses `import`/`export` instead of CommonJS
- **Native APIs**: Leverages built-in Node.js capabilities
- **Type**: Set to `"module"` in package.json

### Architecture
The codebase follows a modular approach with clear separation between:
- **Configuration management** (environment variables)
- **Browser automation** (Playwright integration)
- **API interactions** (native fetch with 2Captcha)
- **CAPTCHA processing** (grid handling and solution application)
- **Main application logic** (orchestration and retry management)

Each module can be easily tested and modified independently.

## Scripts

- `npm start`: Run the application
- `npm run captcha`: Alias for start  
- `npm run dev`: Development mode (same as start)

**Simplified**: Removed unnecessary build scripts to keep it lightweight!

MIT License