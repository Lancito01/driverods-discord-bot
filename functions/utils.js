"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = logger;
function logger(str, color = undefined, type = undefined) {
    switch (color) {
        case "red":
            str = `\x1b[31m${str}`;
            break;
        case "green":
            str = `\x1b[32m${str}`;
            break;
        case "yellow":
            str = `\x1b[33m${str}`;
            break;
        case "blue":
            str = `\x1b[34m${str}`;
            break;
        case "magenta":
            str = `\x1b[35m${str}`;
            break;
        case "cyan":
            str = `\x1b[36m${str}`;
            break;
        case "white":
            str = `\x1b[37m${str}`;
            break;
        default:
            str = str;
    }
    switch (type) {
        case "bold":
            str = `\u001b[1m${str}`;
            break;
        case "underline":
            str = `\u001b[4m${str}`;
            break;
        case "inverse":
            str = `\u001b[7m${str}`;
            break;
        case "strikethrough":
            str = `\u001b[9m${str}`;
            break;
        default:
            str = str;
    }
    str += "\x1b[0m";
    console.log(str);
    return;
}
