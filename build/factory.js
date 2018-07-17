"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const createDebug = require("debug");
const Semaphore = require("ts-semaphore");
const socket_1 = require("./socket");
const globalLimit = new Semaphore(256);
class Factory {
    constructor(server, senderDomain) {
        this.debug = createDebug(`server-accepts-email:factory:${server}`);
        this.server = server;
        this.senderDomain = senderDomain;
    }
    async create() {
        this.debug(`Creating connection`);
        await globalLimit.aquire();
        try {
            const connection = await socket_1.default.connect(this.server);
            try {
                const response = await connection.execute(`HELO ${this.senderDomain}`);
                if (response.code !== 250)
                    throw new Error(`Server did not accept sender domain: ${this.senderDomain}`);
                this.debug(`Connection established`);
                return connection;
            }
            catch (err) {
                connection.end();
                throw err;
            }
        }
        catch (err) {
            globalLimit.release();
            throw err;
        }
    }
    async destroy(connection, error) {
        this.debug(`Terminating connection`);
        try {
            const response = await connection.execute('QUIT');
            if (response.code === 421) {
                this.debug('Server sent 421 in response to QUIT, ignoring (probably ProtonMail)');
            }
            else if (response.code !== 221) {
                this.debug(`Unexpected response: ${response.code} - ${response.comment}`);
                throw new Error(`Unexpected response code to QUIT command: ${response.code}`);
            }
        }
        finally {
            globalLimit.release();
            connection.end();
        }
        this.debug(`Connection terminated`);
    }
    async recycle(connection, error) {
        if (error) {
            try {
                await this.destroy(connection, error);
            }
            catch (_a) { }
            return this.create();
        }
        this.debug(`Preparing connection for reuse`);
        try {
            const response = await connection.execute('RSET');
            if (response.code !== 250) {
                throw new Error(`Server did not accept RSET command`);
            }
            this.debug(`Ready to use connection again`);
            return connection;
        }
        catch (err) {
            globalLimit.release();
            connection.end();
            throw err;
        }
    }
}
exports.default = Factory;
