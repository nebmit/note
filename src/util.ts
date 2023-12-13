
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitMin = async <T>(fn: Promise<T>, ms: number) => {
    const start = Date.now();
    const result = await fn;
    const end = Date.now();
    const duration = end - start;
    if (duration < ms) {
        await wait(ms - duration);
    }
    return result;
};

export const arrayBufferToString = (buffer: ArrayBuffer) => {
    return Array.prototype.map
        .call(new Uint8Array(buffer), (byte) =>
            ("0" + byte.toString(16)).slice(-2)
        )
        .join("");
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const stringToArrayBuffer = (str: string) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
};
