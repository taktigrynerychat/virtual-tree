export function LogMethods() {
    return function (constructor: Function) {

        
        const methodNames: string[] = Object.getOwnPropertyNames(constructor.prototype).filter(
            (name) => {
                let res;
                try {
                    const method = constructor.prototype[name];
                    res = typeof method === 'function' && name !== 'constructor'
                } catch {
                    res = false
                }
                return res;
                
            }
        );
        console.log(methodNames);
        

        const executedMethods: Set<string> = new Set();
        const untouchedMethods: Set<string> = new Set(methodNames);

        for (const methodName of methodNames) {
            const originalMethod = constructor.prototype[methodName];

            constructor.prototype[methodName] = function (...args: any[]) {
                executedMethods.add(methodName);
                untouchedMethods.delete(methodName);
                console.log(`Executing method: ${methodName}`);
                return originalMethod.apply(this, args);
            };
        }

        constructor.prototype.logMethodUsage = function () {
            console.log('Executed Methods:', Array.from(executedMethods));
            console.log('Untouched Methods:', Array.from(untouchedMethods));
        };
    };
}