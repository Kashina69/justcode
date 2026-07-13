import fs from 'fs';
import path from 'path';
export class SessionLogger {
    static instance = null;
    logPath;
    /**
     * Private constructor initializes the .logs directory and session file path.
     */
    constructor() {
        const logsDir = path.join(process.cwd(), '.logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logPath = path.join(logsDir, `session_${timestamp}.log`);
        this.logSystem('Session log initiated.');
        // Append .logs directory to .gitignore automatically
        this.ensureGitignore();
    }
    /**
     * Returns the Singleton instance of the SessionLogger.
     *
     * @returns SessionLogger instance.
     */
    static getInstance() {
        if (!SessionLogger.instance) {
            SessionLogger.instance = new SessionLogger();
        }
        return SessionLogger.instance;
    }
    /**
     * Registers the .logs folder in the project's .gitignore file to prevent git tracking.
     */
    ensureGitignore() {
        const gitignorePath = path.join(process.cwd(), '.gitignore');
        try {
            if (fs.existsSync(gitignorePath)) {
                const content = fs.readFileSync(gitignorePath, 'utf-8');
                if (!content.includes('.logs')) {
                    fs.appendFileSync(gitignorePath, '\n.logs\n', 'utf-8');
                }
            }
        }
        catch {
            // Ignore missing or read-only gitignore files
        }
    }
    /**
     * Logs systemic operational events.
     *
     * @param message Text to log.
     */
    logSystem(message) {
        this.write(`[SYSTEM] [${new Date().toISOString()}] ${message}`);
    }
    /**
     * Logs API query details.
     *
     * @param url Targeted API URL.
     * @param payload JSON request arguments.
     */
    logRequest(url, payload) {
        const header = `\n==================== API REQUEST ====================\nURL: ${url}\nTime: ${new Date().toISOString()}\n`;
        const body = `Payload:\n${JSON.stringify(payload, null, 2)}\n=====================================================\n`;
        this.write(header + body);
    }
    /**
     * Logs API response payloads.
     *
     * @param data JSON response data.
     * @param durationMs Execution latency in milliseconds.
     */
    logResponse(data, durationMs) {
        const header = `\n==================== API RESPONSE ====================\nDuration: ${durationMs}ms\nTime: ${new Date().toISOString()}\n`;
        const body = `Response:\n${JSON.stringify(data, null, 2)}\n======================================================\n`;
        this.write(header + body);
    }
    /**
     * Logs process failures and error details.
     *
     * @param message Error prefix.
     * @param error Error object or stack trace.
     */
    logError(message, error) {
        const errMsg = error ? `\nError Details: ${error.stack || error.message || error}` : '';
        this.write(`[ERROR] [${new Date().toISOString()}] ${message}${errMsg}`);
    }
    /**
     * Appends text content to the active log file.
     *
     * @param text String output.
     */
    write(text) {
        try {
            fs.appendFileSync(this.logPath, text + '\n', 'utf-8');
        }
        catch {
            // Ignore logging write failures to prevent breaking tool execution
        }
    }
}
