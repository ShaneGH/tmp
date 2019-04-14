

export class PropertyKeyword {
    private constructor(public keyword: string, public validate: (x: any) => boolean) {}

    static string = new PropertyKeyword("string", x => typeof x === "string") 
    static number = new PropertyKeyword("number", x => typeof x === "number") 
    static boolean = new PropertyKeyword("boolean", x => typeof x === "boolean") 
    static any = new PropertyKeyword("any", x => true) 
    static null = new PropertyKeyword("null", x => x === null) 
    static undefined = new PropertyKeyword("undefined", x => x === undefined) 
    static unknown = new PropertyKeyword("unknown", x => { throw new Error('"unknown" is not a valid type'); }) 
    static never = new PropertyKeyword("never", x => false) 
    static void = new PropertyKeyword("void", x => { throw new Error('"void" is not a valid type'); })

    static value(key: string) {
        const result: PropertyKeyword = (PropertyKeyword as any)[key];
        if (result instanceof PropertyKeyword) {
            return result;
        }

        throw new Error(`${key} is not a valid property keyword.`);
    }
}

export enum MultiTypeCombinator {
    Intersection = 1,
    Union
} 

export class Property {
    constructor (public name: string, public type: PropertyType) {}
}

export class Properties {
    constructor (public properties: Property[]) {}
}

export class AliasedType {
    constructor (public id: string, public name: string, public aliases: PropertyType) {
    }
}

export class LazyTypeReference {
    constructor(public id: string, private type: () => AliasedType) { }

    getType() {
        return this.type();
    }
}

export class MultiType {
    constructor(public types: PropertyType[], public combinator: MultiTypeCombinator) {
    }
}

export class ArrayType {
    constructor(public type: PropertyType) { }
}

export type CommonType = MultiType | PropertyKeyword | Properties | ArrayType;
export type PropertyType = LazyTypeReference | CommonType;
export type Type = CommonType | AliasedType;