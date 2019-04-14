
const promisify1_1 = 
    <T, U>(input: (x: T, cb: (err: Error | null, y: U) => void) => void) =>
    (x: T) => new Promise<U>((res, rej) => input(x, (err, y) => err ? rej(err) : res(y)));
    
const promisify2_1 = 
    <T1, T2, U>(input: (x1: T1, x2: T2, cb: (err: Error | null, y: U) => void) => void) =>
    (x1: T1, x2: T2) => new Promise<U>((res, rej) => input(x1, x2, (err, y) => err ? rej(err) : res(y)));
    
const promisify3_1 = 
    <T1, T2, T3, U>(input: (x1: T1, x2: T2, x3: T3, cb: (err: Error | null, y: U) => void) => void) =>
    (x1: T1, x2: T2, x3: T3) => new Promise<U>((res, rej) => input(x1, x2, x3, (err, y) => err ? rej(err) : res(y)));

export {
    promisify1_1,
    promisify2_1,
    promisify3_1
}