import { Type } from "../validation-rewriter/types";
import { serialize } from "../validation-rewriter/typeSerializer";
import { EOL } from  'os'
import { CompilerArgs } from "../validator/validate";

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

export function generateValidateFile (types: {[key: string]: Type}, compilerArgs: CompilerArgs): ICodeFile {

    const typesList: Type[] = [];
    const keyMap: {[key: string]: string} = {};
    const done: {[key: string]: boolean} = {};

    for(var k in types) {
        keyMap[k] = types[k].id;
        if (done[types[k].id]) continue;
        
         done[types[k].id] = true;
         typesList.push(types[k]);
    }

    const typesS = serialize(typesList);

    const writer = new CodeWriter();
    
    writer.writeLine("import { deserialize, validateType } from 'ts-validator'");

    writer.writeLine();
    writer.writeLine(`const keyMap: {[key: string]: string} = {`);
    writer.tabbed(() => {
        Object
            .keys(keyMap)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = keyMap[k].replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                writer.writeLine(`"${kSafe}": "${vSafe}",`);
            });
    });
    writer.writeLine(`};`);

    writer.writeLine();
    writer.writeLine(`const types = deserialize({`);
    writer.tabbed(() => {
        Object
            .keys(typesS)
            .forEach(k => {
                const kSafe = k.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                const vSafe = JSON.stringify(typesS[k]);
                writer.writeLine(`"${kSafe}": ${vSafe},`);
            });
    });
    writer.writeLine(`});`);

    writer.writeLine();
    writer.writeLine(`const compilerArgs = ${JSON.stringify(compilerArgs)};`);

    writer.writeLine();
    writer.writeLine("export function validate<T>(subject: T, key: string) {");

    writer.tabbed(() => {
        writer.writeLine();
        writer.writeLine("if (!key) {");
        writer.writeTabbedLine('throw new Error("There was no key specified for validation. Do you need to re-compile your ts code?")');
        writer.writeLine("}");

        writer.writeLine();
        writer.writeLine('const map = keyMap[key];');
        writer.writeLine('if (!map) {');
        writer.writeTabbedLine('throw new Error(`Invalid validation key ${key}. Do you need to re-compile your ts code?`);');
        writer.writeLine('}');

        writer.writeLine();
        writer.writeLine('const type = types.tryGet(map);');
        writer.writeLine('if (!type) {');
        writer.writeTabbedLine('throw new Error(`Could not find type for validation key ${key}, type key ${map}. Do you need to re-compile your ts code?`);');
        writer.writeLine('}');

        writer.writeLine();
        writer.writeLine("return validateType(subject, type(), compilerArgs);");
    });

    writer.writeLine("};");

    return writer;
}