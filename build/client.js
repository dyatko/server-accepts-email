"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const createDebug = require("debug");
const ResourcePool = require("ts-resource-pool");
const factory_1 = require("./factory");
class Client {
    constructor(server, senderDomain) {
        this.debug = createDebug(`server-accepts-email:client:${server}`);
        this.pool = new ResourcePool(new factory_1.default(server, senderDomain), 5);
    }
    test(email, { senderAddress }) {
        this.debug(`Starting test of "${email}"`);
        return this.pool.use(async (connection) => {
            this.debug(`Aquired connection from pool`);
            await connection.execute(`MAIL FROM: <${senderAddress}>`).then((response) => {
                if (response.code !== 250)
                    throw new Error(`Server did not accept sender address: ${senderAddress}`);
            });
            const response = await connection.execute(`RCPT TO: <${email}>`);
            if (response.code === 250) {
                this.debug(`Server accepts email for "${email}"`);
                return { kind: 'answer', answer: true };
            }
            if (response.code === 550) {
                this.debug('The mailbox is unavailable');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 553) {
                this.debug('The mailbox name is not allowed');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 554 && response.comment.includes('this address does not exist')) {
                this.debug('The mailbox is unavailable (probably ProtonMail)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 501 && response.comment.includes('Bad recipient address syntax')) {
                this.debug('The mailbox name is not allowed (probably ProtonMail or ESMTP Postfix)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 504 && response.comment.includes('Recipient address rejected')) {
                this.debug('The mailbox name is not allowed (probably Yandex)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 501 && response.comment.includes(`<${email}>: `)) {
                this.debug('The mailbox name is not allowed (probably Runbox)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 450 && response.comment.includes('unknown user')) {
                this.debug('The mailbox is unavailable (probably ESMTP Postfix)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 554 && response.comment.includes('Invalid-Recipient')) {
                this.debug('The mailbox is unavailable (probably ESMTP Postfix)');
                return { kind: 'answer', answer: false };
            }
            if (response.code === 451 && response.comment.includes('Greylisting enabled, try again in 1 minutes')) {
                this.debug('Server is applying greylisting, estimated wait time: 60s');
                return { kind: 'greylist', timeout: 60 };
            }
            if (response.code === 451 && response.comment.includes('https://community.mimecast.com/docs/DOC-1369#451')) {
                this.debug('Server is applying greylisting, estimated wait time: 60s');
                return { kind: 'greylist', timeout: 60 };
            }
            if (response.code === 450 && response.comment.includes('Greylisted, see http://postgrey.schweikert.ch/help/')) {
                this.debug('Server is applying greylisting, estimated wait time: 5m');
                return { kind: 'greylist', timeout: 300 };
            }
            if (response.code === 451 && response.comment.includes('is not yet authorized to deliver mail from')) {
                this.debug('Server is applying greylisting, estimated wait time: 10m');
                return { kind: 'greylist', timeout: 600 };
            }
            this.debug(`Unexpected response: ${response.code} - ${response.comment}`);
            throw new Error(`Unexpected code from server: ${response.code}`);
        });
    }
}
exports.default = Client;
