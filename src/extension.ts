// Description: This is the entry point for your extension. It is activated when the extension is loaded by the host application.
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import { ciscopilotHandler } from "./chatParticipant";
import { listIncludedFilesFn } from "./chatCommandFunc";
import { ViewImportTreePanel } from "./panels/viewImportTree";

const stat = util.promisify(fs.stat);

export var WORKPLACE_EDITOR: any = null;

export const languagesSupported = new Set<string>([
  "javascript",
  "typescript",
  "python",
  // "java",
  "c",
  "cpp",
]);

const languageIdToExtensionMap = new Map<string, string>([
  ["javascript", ".js"],
  ["typescript", ".ts"],
  ["python", ".py"],
  ["java", ".java"],
]);

const standardClibs = new Set<string>([
  "assert.h",
  "complex.h",
  "ctype.h",
  "errno.h",
  "fenv.h",
  "float.h",
  "inttypes.h",
  "iso646.h",
  "limits.h",
  "locale.h",
  "math.h",
  "setjmp.h",
  "signal.h",
  "stdalign.h",
  "stdarg.h",
  "stdatomic.h",
  "stdbit.h",
  "stdbool.h",
  "stdckdint.h",
  "stddef.h",
  "stdint.h",
  "stdio.h",
  "stdlib.h",
  "stdnoreturn.h",
  "string.h",
  "tgmath.h",
  "threads.h",
  "time.h",
  "uchar.h",
  "wchar.h",
  "wctype.h",
]);

async function resolveFilePath(
  importPath: string,
  documentUri: vscode.Uri,
  languageId: string,
  isFilePath: boolean
): Promise<string | null> {
  if (isFilePath) {
    // Resolve relative or absolute file path
    const basePath = path.dirname(documentUri.fsPath);
    var fullPath = path.resolve(basePath, importPath);
    if (
      languageIdToExtensionMap.has(languageId) &&
      !importPath.includes(languageIdToExtensionMap.get(languageId) || "")
    ) {
      fullPath = fullPath + languageIdToExtensionMap.get(languageId) || "";
    }
    try {
      await stat(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  } else {
    // Resolve node module path
    console.log(
      isFilePath,
      "importPath: ",
      importPath,
      path.dirname(documentUri.fsPath)
    );
    try {
      return require.resolve(importPath, {
        paths: [path.dirname(documentUri.fsPath)],
      });
    } catch {
      return null;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("ciscopilot-test.helloWorld", () => {
      console.log("Hello World from ciscopilot_test!");
      vscode.window.showInformationMessage("Hello World from ciscopilot_test!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ciscopilot-test.findVariableReferences",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          console.log("No active text editor");
          return;
        }

        const position = editor.selection.active;
        console.log("position of cursor: ", position);
        //   const location = '/Users/rishara2/Downloads/src/context/dataContext.js'; // Example location
        //   const document = await vscode.workspace.openTextDocument(vscode.Uri.file(location));
        const document = editor.document;
        const fileContent = document.getText();
        const filePath = document.fileName;
        const fileName = path.basename(filePath);
        const languageId = document.languageId;

        const references = await vscode.commands.executeCommand<
          vscode.Location[]
        >("vscode.executeReferenceProvider", document.uri, position);
        const wordRange = document.getWordRangeAtPosition(position);
        const word = document.getText(wordRange);
        console.log("keyword: ", word);
        console.log("filename: ", fileName);
        console.log("filepath: ", filePath);
        console.log("prog language: ", languageId);
        // console.log(fileContent);
        if (references) {
          references.forEach((reference) => {
            const line = reference.range.start.line;
            const file = reference.uri.path
            console.log(`Variable referenced at line: ${line + 1}, file: ${file}`);
          });
        }
        console.log("\n");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ciscopilot-test.findDefinition",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage("No active editor found.");
          return;
        }

        const position = editor.selection.active;
        const document = editor.document;
        console.log("document: ", document);
        console.log("file path: ", document.uri);

        const definitions: any = await vscode.commands.executeCommand<
          vscode.Location[]
        >("vscode.executeDefinitionProvider", document.uri, position);
        console.log("definitions: ", definitions);
        console.log(definitions[0].targetUri);
        // if (definitions && definitions.length > 0) {
        //     const definition = definitions[0];
        //     const definitionUri = definition.uri;
        //     const definitionRange = definition.range;
        //     const definitionLine = definitionRange.start.line + 1;
        //     const definitionCharacter = definitionRange.start.character + 1;
        // 	console.log("definition: ", definition);
        // 	console.log("definitionUri: ", definitionUri);
        //     vscode.window.showInformationMessage(`Definition found at ${definitionUri.fsPath} (line ${definitionLine}, character ${definitionCharacter})`);
        // } else {
        //     vscode.window.showInformationMessage('No definition found.');
        // }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ciscopilot-test.listIncludedFiles",()=>{
        listIncludedFilesFn(vscode.window.activeTextEditor);
      }
    )
  );

  // create participant
  const ciscopilot = vscode.chat.createChatParticipant(
    "ciscopilot-test.ciscopilot",
    ciscopilotHandler
  );

  // add icon to participant
  ciscopilot.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "ciscopilot.jpeg"
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ciscopilot-test.viewImportTree", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor found.");
        return false;
      }
      WORKPLACE_EDITOR = editor;

      ViewImportTreePanel.render(context.extensionUri);
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
