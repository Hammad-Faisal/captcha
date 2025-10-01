import config from '../config/constants.js';

const { 
    API_KEY, 
    CREATE_TASK_URL, 
    GET_RESULT_URL, 
    MAX_POLLING_ATTEMPTS, 
    POLLING_INTERVAL 
} = config;

class ApiUtils {
    /**
     * Submit a task to 2Captcha
     * @param {Object} taskData - The task data containing body, comment, rows, columns
     * @returns {string} - Task ID from 2Captcha
     */
    async submitTask(taskData) {
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

        const createResponse = await fetch(CREATE_TASK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskPayload)
        });
        
        const createData = await createResponse.json();
        
        if (createData.errorId !== 0) {
            throw new Error(`2Captcha createTask error: ${createData.errorDescription}`);
        }

        const taskId = createData.taskId;
        console.log(`Task submitted to 2Captcha. Task ID: ${taskId}`);
        
        return taskId;
    }

    /**
     * Poll 2Captcha for task result
     * @param {string} taskId - The task ID to poll for
     * @returns {Object} - The solution object from 2Captcha
     */
    async pollForResult(taskId) {
        let attempts = 0;

        while (attempts < MAX_POLLING_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
            
            const resultResponse = await fetch(GET_RESULT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientKey: API_KEY, 
                    taskId
                })
            });
            
            const result = await resultResponse.json();

            if (result.status === 'ready') {
                console.log('CAPTCHA solved by 2Captcha!');
                return result.solution;
            } else if (result.status === 'processing') {
                console.log(`Still processing... (${attempts + 1}/${MAX_POLLING_ATTEMPTS})`);
            } else {
                throw new Error(`2Captcha error: ${result.errorDescription}`);
            }

            attempts++;
        }

        throw new Error(`2Captcha solve timed out after ${MAX_POLLING_ATTEMPTS} attempts.`);
    }

    /**
     * Complete workflow to solve CAPTCHA using 2Captcha
     * @param {Object} taskData - The task data for the CAPTCHA
     * @returns {Object} - The solution object
     */
    async solveCaptcha(taskData) {
        const taskId = await this.submitTask(taskData);
        return await this.pollForResult(taskId);
    }
}

export default ApiUtils;
