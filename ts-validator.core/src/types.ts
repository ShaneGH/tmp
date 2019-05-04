

// https://github.com/ShaneGH/ts-validator/issues/39

export class PropertyKeyword {
    private constructor(public keyword: string, public validate: (x: any) => boolean) {}

    static string = new PropertyKeyword("string", x => typeof x === "string")
    static object = new PropertyKeyword("object", x => typeof x === "object") 
    static number = new PropertyKeyword("number", x => typeof x === "number") 
    static boolean = new PropertyKeyword("boolean", x => typeof x === "boolean") 
    static any = new PropertyKeyword("any", () => true) 
    static null = new PropertyKeyword("null", x => x === null) 
    static undefined = new PropertyKeyword("undefined", x => x === undefined) 
    static unknown = new PropertyKeyword("unknown", () => { throw new Error('"unknown" is not a valid type'); }) 
    static never = new PropertyKeyword("never", () => false) 
    static void = new PropertyKeyword("void", () => { throw new Error('"void" is not a valid type'); })

    static value(key: string) {
        const result: PropertyKeyword = (PropertyKeyword as any)[key];
        if (result instanceof PropertyKeyword) {
            return result;
        }

        throw new Error(`${key} is not a valid property keyword.`);
    }

    equals(other: any): boolean {
        return other === this;
    }
}

export enum MultiTypeCombinator {
    Intersection = 1,
    Union
} 

export class Property {
    constructor (public name: string, public type: PropertyType, public optional: boolean) {}

    equals(other: any): boolean {
        if (!(other instanceof Property)) return false;
        return other.name === this.name 
            && other.optional === this.optional 
            && this.type.equals(other.type);
    }
}

type Eq = {equals: (x: any) => boolean}
function compareArrays(arr1: Eq[], arr2: Eq[]): boolean {
    if (arr1.length !== arr2.length) return false;

    // make read/write copy
    arr2 = arr2.slice();
    for (var i = 0; i < arr1.length; i++) {
        for (var j = 0; j < arr2.length; j++) {
            if (arr1[i].equals(arr2[j])) {
                arr2.splice(j, 1);
                break;
            }
        }
        
        if (j >= arr2.length) return false;
    }

    return true;
}

export class Properties {
    constructor (public properties: Property[]) {}

    equals(other: any): boolean {
        if (!(other instanceof Properties)) return false;
        return compareArrays(other.properties, this.properties);
    }
}

export class AliasedType {
    constructor (public id: string, public name: string, public aliases: PropertyType) {
    }

    equals(other: any): boolean {
        if (other instanceof AliasedType || other instanceof LazyTypeReference) {
            return this.id == other.id;
        }
        
        return false;
    }
}

export class LazyTypeReference {
    constructor(public id: string, private type: () => AliasedType) { }

    getType() {
        return this.type();
    }

    equals(other: any): boolean {
        if (other instanceof AliasedType || other instanceof LazyTypeReference) {
            return this.id == other.id;
        }
        
        return false;
    }
}

export class MultiType {
    constructor(public types: PropertyType[], public combinator: MultiTypeCombinator) {
    }

    equals(other: any): boolean {
        if (!(other instanceof MultiType)) return false;
        if (this.combinator !== other.combinator) return false;
        
        return compareArrays(other.types, this.types);
    }
}

export class ArrayType {
    constructor(public type: PropertyType) { }

    equals(other: any): boolean {
        if (!(other instanceof ArrayType)) return false;
        return this.type.equals(other.type);
    }
}

export type CommonType = MultiType | PropertyKeyword | Properties | ArrayType;
export type PropertyType = LazyTypeReference | CommonType;
export type Type = CommonType | AliasedType;