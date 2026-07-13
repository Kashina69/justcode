import fs from 'fs';
import path from 'path';
import os from 'os';
export const THEMES = {
    'Default': {
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        gray: '\x1b[90m',
    },
    'One Dark': {
        cyan: '\x1b[38;2;86;182;194m',
        green: '\x1b[38;2;152;195;121m',
        yellow: '\x1b[38;2;229;192;123m',
        red: '\x1b[38;2;224;108;117m',
        blue: '\x1b[38;2;97;175;239m',
        magenta: '\x1b[38;2;198;120;221m',
        gray: '\x1b[38;2;92;99;112m',
    },
    'Catppuccin': {
        cyan: '\x1b[38;2;137;220;235m',
        green: '\x1b[38;2;166;227;161m',
        yellow: '\x1b[38;2;249;226;175m',
        red: '\x1b[38;2;243;139;168m',
        blue: '\x1b[38;2;137;180;250m',
        magenta: '\x1b[38;2;203;166;247m',
        gray: '\x1b[38;2;108;112;134m',
    },
    'Material': {
        cyan: '\x1b[38;2;128;203;196m',
        green: '\x1b[38;2;195;232;141m',
        yellow: '\x1b[38;2;255;203;107m',
        red: '\x1b[38;2;240;113;120m',
        blue: '\x1b[38;2;130;177;255m',
        magenta: '\x1b[38;2;199;146;234m',
        gray: '\x1b[38;2;144;164;174m',
    },
    'Hackerman': {
        cyan: '\x1b[38;2;0;255;0m',
        green: '\x1b[38;2;0;200;0m',
        yellow: '\x1b[38;2;0;150;0m',
        red: '\x1b[38;2;150;255;150m',
        blue: '\x1b[38;2;0;255;128m',
        magenta: '\x1b[38;2;0;100;0m',
        gray: '\x1b[38;2;0;120;0m',
    },
    'Vilnius Purple': {
        cyan: '\x1b[38;2;216;180;254m',
        green: '\x1b[38;2;168;85;247m',
        yellow: '\x1b[38;2;192;132;252m',
        red: '\x1b[38;2;244;63;94m',
        blue: '\x1b[38;2;129;140;248m',
        magenta: '\x1b[38;2;232;121;249m',
        gray: '\x1b[38;2;113;113;122m',
    },
};
export const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};
const THEME_FILE = path.join(os.homedir(), '.agent', 'theme.json');
export function applyTheme(name) {
    const theme = THEMES[name];
    if (!theme)
        return;
    for (const key of Object.keys(theme)) {
        if (theme[key] !== undefined) {
            colors[key] = theme[key];
        }
    }
}
export function loadStoredTheme() {
    try {
        if (fs.existsSync(THEME_FILE)) {
            const data = JSON.parse(fs.readFileSync(THEME_FILE, 'utf-8'));
            if (data && data.theme) {
                applyTheme(data.theme);
            }
        }
    }
    catch {
        // Ignore error
    }
}
export function saveTheme(name) {
    if (!THEMES[name])
        return;
    try {
        const dir = path.dirname(THEME_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(THEME_FILE, JSON.stringify({ theme: name }, null, 2), 'utf-8');
        applyTheme(name);
    }
    catch {
        // Ignore error
    }
}
// Initial load
loadStoredTheme();
