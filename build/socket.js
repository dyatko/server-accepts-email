"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const asyncLines = require("async-lines");
const pTimeout = require("p-timeout");
const createDebug = require("debug");
async function readLine(lines) {
    const { done, value } = await lines.next();
    if (done)
        throw new Error('Server closed connection prematurely');
    const code = Number(value.slice(0, 3));
    const hasMore = (value.charAt(3) === '-');
    const comment = value.slice(4);
    return { code, hasMore, comment };
}
async function readResponse(lines) {
    let line = await readLine(lines);
    let code = line.code;
    let comment = line.comment;
    while (line.hasMore) {
        line = await readLine(lines);
        comment += '\n' + line.comment;
    }
    return { code, comment };
}
function readResponseWithTimeout(lines) {
    return pTimeout(readResponse(lines), 15000, 'Timed out while waiting for response from server');
}
class Socket {
    static async connect(server) {
        const self = new Socket(server);
        try {
            self.debug(`Waiting for greeting`);
            const response = await readResponseWithTimeout(self.lines);
            if (response.code !== 220) {
                self.debug(`Unexpected response: ${response.code} - ${response.comment}`);
                throw new Error(`Unexpected code from server: ${response.code}`);
            }
        }
        catch (err) {
            self.end();
            throw err;
        }
        return self;
    }
    constructor(server) {
        this.debug = createDebug(`server-accepts-email:socket:${server}`);
        this.debug(`Connecting to "${server}"`);
        this.socket = net.connect(25, server);
        this.lines = asyncLines(this.socket);
    }
    async execute(message) {
        this.debug(`Sending "${message}" message`);
        this.socket.write(`${message}\r\n`);
        this.debug(`Waiting for server response`);
        const response = await readResponseWithTimeout(this.lines);
        this.debug(`Got response: ${response.code} - ${response.comment}`);
        return response;
    }
    end() {
        this.debug('Closing connection');
        this.socket.end();
    }
}
exports.default = Socket;
