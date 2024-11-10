export class BaseProvider {
    precheck() {
        throw new Error('precheck not implemented');
    }
    getSession(sid) {
        throw new Error('getSession not implemented');
    }
    setSession(sid, data, expiry) {
        throw new Error('setSession not implemented');
    }
    destroySession(sid) {
        throw new Error('destroySession not implemented');
    }
}
