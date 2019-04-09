import { serialize } from "../validation-rewriter/typeSerializers";
import { EOL } from  'os'
import { CompilerArgs } from "../validator/validate";
import { moduleName } from "../const";
import { AliasedType, PropertyType, Type, PropertyKeyword, BinaryType } from "../validation-rewriter/types";
import { LazyDictionary } from "../utils/lazyDictionary";

interface ICodeFile {

    toString(): string
    log(): void
}

class CodeWriter implements ICodeFile {
    private _tab = 0;
    private _code: string[] = [];

    tabbed(f: () => void) {
        this._tab++;
        f();
        this._tab--;
    }

    writeLine(value?: string) {
        if (!value) {
            this._code.push("");
            return;
        }

        let tab = "";
        for (var i = 0; i < this._tab; i++) {
            tab += "\t";
        }

        this._code.push(tab + value);
    }

    writeTabbedLine(value?: string) {
        this.tabbed(() => this.writeLine(value));
    }

    toString() {
        return this._code.join(EOL);
    }

    log() {
        this._code.forEach(x => console.log(x));
    }
}

export function generateValidateFile (types: {key: string, value: Type}[], compilerArgs: CompilerArgs): ICodeFile {

    let i = 0;
    const aliasedTypes = types
        .map(x => {
            if (x.value instanceof AliasedType) return x as {key: string, value: AliasedType};
            const key = x.value instanceof PropertyKeyword
                ? `keyword: ${x.value.keyword}`
                : `anonymous: ${++i}`;

            return {
                key: x.key,
                value: new AliasedType(key, key, x.value)
            };
        });

    const serailizableTypes = serialize(
        aliasedTypes.map(a => a.value));

    const keyMap = aliasedTypes
        .reduce((s, x) => { return s[x.key] = x.value.id, s; }, {} as {[key: string]: string});

    const writer = new CodeWriter();

    writer.writeLine(`import { init } from "${moduleName}";`);

    writer.writeLine();
    writer.writeLine('var keyMap = {');
    writer.tabbed(() => {
        Object
            .keys(keyMap)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = keyMap[k].replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                writer.writeLine(`"${kSafe}": "${vSafe}",`);
            });
    });
    writer.writeLine('};');

    writer.writeLine();
    writer.writeLine('var aliasedTypes = {');
    writer.tabbed(() => {
        Object
            .keys(serailizableTypes)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = JSON.stringify(serailizableTypes[k]);
                writer.writeLine(`"${kSafe}": ${vSafe},`);
            });
    });
    writer.writeLine(`};`);

    writer.writeLine();
    writer.writeLine(`var compilerArgs = ${JSON.stringify(compilerArgs)};`);

    writer.writeLine();
    writer.writeLine('function initInternal () {');
    writer.writeTabbedLine('init(keyMap, aliasedTypes, compilerArgs);');
    writer.writeLine('}');

    writer.writeLine();
    writer.writeLine('export {');
    writer.writeTabbedLine('initInternal as init');
    writer.writeLine('}');

    return writer;
}