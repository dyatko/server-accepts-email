"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pTry = require("p-try");
const client_1 = require("./client");
class Manager {
    constructor() {
        this.storage = new Map();
    }
    aquire(server, senderDomain) {
        const key = `${server} (from ${senderDomain})`;
        const item = this.storage.get(key);
        if (item != null) {
            item.ref += 1;
            return item.client;
        }
        const client = new client_1.default(server, senderDomain);
        this.storage.set(key, { ref: 1, client });
        return client;
    }
    release(server, senderDomain) {
        const key = `${server} (from ${senderDomain})`;
        const item = this.storage.get(key);
        item.ref -= 1;
        if (item.ref === 0) {
            this.storage.delete(key);
        }
    }
    async withClient(server, senderDomain, fn) {
        const client = this.aquire(server, senderDomain);
        return pTry(() => fn(client)).then((val) => { this.release(server, senderDomain); return val; }, (err) => { this.release(server, senderDomain); throw err; });
    }
}
exports.default = Manager;
