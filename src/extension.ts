// Description: This is the entry point for your extension. It is activated when the extension is loaded by the host application.
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import { tutorHandler } from "./chatParticipant";

const stat = util.promisify(fs.stat);

const languagesSupported = new Set<string>([
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

async function findAllImportedFiles(rootFile: any, modulesFound: Map<string, any>) {
  console.log("root file: ", rootFile);

  // extracting file path from rootFile object
  const filePath = rootFile.rootPath;
  // finding the document object from the file path
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(filePath)
  );

  // extracting the content, filename and languageId from the document object
  const fileContent = document.getText();
  const fileName = path.basename(filePath);
  // console.log("filename: ", fileName);
  const languageId = document.languageId;
  // console.log("file path: ", filePath);

  // Regular expression to match import statements
  const importRegexJS = /import\s+.*\s+from\s+['"](.*)['"]/g;
  const importRegexPy = /^(?:import\s+(\S+)|from\s+(\S+)\s+import\s+.*)$/gm;
  const importRegexJava = /import\s+(.*);/g;
  const importRegexC = /#include\s*["<](.*?)[">]/g;
  const importRegexCpp = /#include\s*["<](.*?)[">]/g;

  //   const importRegexGo = /import\s+"(.*)"/g;
  //   const importRegexHTML = /<link\s+href="(.*)"\s+rel="stylesheet">/g;
  //   const importRegexCSS = /@import\s+url\((.*)\);/g;
  //   const importRegexSCSS = /@import\s+"(.*)";/g;

  const importRegexLanguageMap = new Map<string, RegExp>([
    ["javascript", importRegexJS],
    ["typescript", importRegexJS],
    ["python", importRegexPy],
    ["java", importRegexJava],
    ["c", importRegexC],
    ["cpp", importRegexCpp],
  ]);
  // assigning the correct regex for the language
  const importRegex = importRegexLanguageMap.get(languageId) || importRegexJS;
  let match;
  var imports = [];

  // finding all the imports modules in the file and storging them in an array
  while ((match = importRegex.exec(fileContent)) !== null) {
    const importPath = languageId == "python" ? match[1] || match[2] : match[1];
    // const line = document.positionAt(match.index).line;
    // const character = document.positionAt(match.index).character;
    const importPathStart = match.index + match[0].indexOf(importPath);
    const importPathPosition = document.positionAt(importPathStart);
    imports.push({
      module: importPath,
      parentFilePath: filePath,
      //   line,
      //   character,
      //   importPathStart,
      importPathPosition,
    });
  }
  // console.log("imports: ", imports);
  // a flag to check if LSP is present for the language
  var isLspPresent = false;

  // finding the definitions of the imports modules and further iterating over them to find the child imports and storing them in the array
  imports = await Promise.all(
    imports.map(async (elem) => {

      // finding the definition of the import module
      const position = elem.importPathPosition;
      const definitions: any = await vscode.commands.executeCommand<
        vscode.Location[]
      >("vscode.executeDefinitionProvider", document.uri, position);
      // console.log("definitions: ", definitions);
      if (definitions && definitions.length > 0) {
        // setting the flag to true if even one definition is found for any module
        isLspPresent = true;
        // issue : give multiple definitions, need to find the correct one

        // different language have different ways of defining the module file path
        const moduleFilePath =
          languageId == "javascript" || languageId == "typescript"
            ? definitions[0].targetUri.path
            : languageId == "c" || languageId == "cpp"
            ? definitions[0].uri.path
            : languageId == "python"
            ? definitions[0].uri.path
            : definitions[0].uri.path;
        // console.log("module file path: ", moduleFilePath);
        var moduleFileName = path.basename(moduleFilePath);
        var isUserDefined = null;
        //   const definition = definitions[0];
        //   const definitionUri = definition.targetUri;
        //   const definitionRange = definition.targetRange;

        // checking if the module is user defined or not based on the file path
        if (languageId == "javascript" || languageId == "typescript") {
          isUserDefined =
            elem.module.startsWith(".") || elem.module.startsWith("/");
          moduleFileName =
            elem.module.startsWith(".") || elem.module.startsWith("/")
              ? moduleFileName
              : elem.module;
        } else if (
          languageId == "c" ||
          languageId == "cpp" ||
          languageId == "python"
        ) {
          isUserDefined =
            !moduleFilePath.includes("CommandLineTools") &&
            !moduleFilePath.includes("site-packages");
        } else {
          isUserDefined = false;
        }

        return {
          moduleFileName,
          isUserDefined,
          ...elem,
          moduleFilePath,
        };
      } else {
        return {
          moduleFileName: elem.module,
          isUserDefined: null,
          ...elem,
          moduleFilePath: null,
        };
      }
    })
  );
  // console.log("imports full details: ", imports);
  const fullImports = [];
  // iterating over the imports array to find the child imports of each module that is user defined and also storing the modules in a map to avoid irrelevant iterations
  for (let i = 0; i < imports.length; i++) {
    if (imports[i].isUserDefined ) {
      if(modulesFound.has(imports[i].moduleFileName)){
        fullImports.push({
          ...imports[i],
          childImports: modulesFound.get(imports[i].moduleFileName).childImports,
        });
      }else{
        const childImports: any = await findAllImportedFiles({
          rootPath: imports[i].moduleFilePath,
        }, modulesFound);
        fullImports.push({
          ...imports[i],
          childImports: childImports==false? [] : childImports,
        });
        modulesFound.set(imports[i].moduleFileName, {
          moduleFileName: imports[i].moduleFileName,
          isUserDefined: imports[i].isUserDefined,
          moduleFilePath: imports[i].moduleFilePath,
          parentFilePath: imports[i].parentFilePath,
          childImports: childImports==false? [] : childImports,
        });
      }
      
    } else {
      fullImports.push(imports[i]);
      if(!modulesFound.has(imports[i].moduleFileName)){
        modulesFound.set(imports[i].moduleFileName, {
          moduleFileName: imports[i].moduleFileName,
          isUserDefined: imports[i].isUserDefined,
          parentFilePath: imports[i].parentFilePath,
          moduleFilePath: imports[i].moduleFilePath,
        });
      }
    }
  }
  console.log("full imports: ", fullImports);
  // if LSP is not present for the language, return false otherwise return the full imports array
  return isLspPresent || !fullImports.length ? fullImports : isLspPresent;
}

export const listIncludedFilesFn = async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor found.");
    return false;
  }

  const document = editor.document;
  const filePath = document.fileName;
  const fileName = path.basename(filePath);
  const languageId = document.languageId;
  console.log("root file path: ", filePath);

  if (!languagesSupported.has(document.languageId)) {
    vscode.window.showInformationMessage(
      "This command not supported for this language file."
    );
    return false;
  }

  const rootFile = {
    rootPath: filePath,
    languageId,
  };
  const modulesFound = new Map<string, any>();
  const allImports = await findAllImportedFiles(rootFile,modulesFound);
  if (!allImports) {
    console.log(
      "Looks like no LSP present for language:",
      languageId,
      ", first download an extention for browsing code in this language.",
    );
    return  false;
  } else console.log("all imports: ", allImports);
  console.log("modules found: ", modulesFound);
  return {
    rootFile,
    allImports,
    modulesFound,
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "ciscopilot-test.helloWorld",
    () => {
      console.log("Hello World from ciscopilot_test!");
      vscode.window.showInformationMessage("Hello World from ciscopilot_test!");
    }
  );
  context.subscriptions.push(disposable);

  const findReference = vscode.commands.registerCommand(
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
          console.log(`Variable referenced at line: ${line + 1}`);
        });
      }
      console.log("\n");
    }
  );

  context.subscriptions.push(findReference);

  const findDefinition = vscode.commands.registerCommand(
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
  );

  context.subscriptions.push(findDefinition);

  const listIncludedFiles = vscode.commands.registerCommand(
    "ciscopilot-test.listIncludedFiles",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor found.");
        return;
      }

      const document = editor.document;
      const fileContent = document.getText();
      const filePath = document.fileName;
      const languageId = document.languageId;
      console.log("file path: ", filePath);

      // Regular expression to match import statements
      const importRegexJS = /import\s+.*\s+from\s+['"](.*)['"]/g;
      const importRegexPy = /^(?:import\s+(\S+)|from\s+(\S+)\s+import\s+.*)$/gm;
      const importRegexJava = /import\s+(.*);/g;
      const importRegexC = /#include\s*["<](.*?)[">]/g;
      const importRegexCpp = /#include\s*["<](.*?)[">]/g;

      //   const importRegexGo = /import\s+"(.*)"/g;
      //   const importRegexHTML = /<link\s+href="(.*)"\s+rel="stylesheet">/g;
      //   const importRegexCSS = /@import\s+url\((.*)\);/g;
      //   const importRegexSCSS = /@import\s+"(.*)";/g;

      const importRegexLanguageMap = new Map<string, RegExp>([
        ["javascript", importRegexJS],
        ["typescript", importRegexJS],
        ["python", importRegexPy],
        ["java", importRegexJava],
        ["c", importRegexC],
        ["cpp", importRegexCpp],
      ]);
      const importRegex =
        importRegexLanguageMap.get(languageId) || importRegexJS;
      let match;
      const fileImports: string[] = [];
      const moduleImports: string[] = [];

      while ((match = importRegex.exec(fileContent)) !== null) {
        const importPath =
          languageId == "python" ? match[1] || match[2] : match[1];
        if (
          languageId == "python" ||
          languageId == "javascript" ||
          languageId == "typescript"
        ) {
          if (importPath.startsWith(".") || importPath.startsWith("/")) {
            fileImports.push(importPath);
          } else {
            moduleImports.push(importPath);
          }
        } else if (languageId == "c" || languageId == "cpp") {
          if (standardClibs.has(importPath)) moduleImports.push(importPath);
          else fileImports.push(importPath);
        }
      }
      console.log("file imports: ", fileImports);
      console.log("module imports: ", moduleImports);

      const resolvedFileImports = await Promise.all(
        fileImports.map((importPath) =>
          resolveFilePath(importPath, document.uri, languageId, true)
        )
      );
      const resolvedModuleImports = await Promise.all(
        moduleImports.map((importPath) =>
          resolveFilePath(importPath, document.uri, languageId, false)
        )
      );
      console.log("resolved file imports: ", resolvedFileImports);
      console.log("resolved module imports: ", resolvedModuleImports);

      if (fileImports.length > 0 || moduleImports.length > 0) {
        const fileImportsList = fileImports.join("\n");
        const moduleImportsList = moduleImports.join("\n");
        vscode.window.showInformationMessage(
          `File imports:\n${fileImportsList}\n\nNode module imports:\n${moduleImportsList}`
        );
      } else {
        vscode.window.showInformationMessage("No imports found.");
      }
    }
  );

  context.subscriptions.push(listIncludedFiles);

  const listIncludedFiles2 = vscode.commands.registerCommand(
    "ciscopilot-test.listIncludedFiles2",
    listIncludedFilesFn
  );

  context.subscriptions.push(listIncludedFiles2);


// create participant
const tutor = vscode.chat.createChatParticipant("ciscopilot-test.code-tutor", tutorHandler);

// add icon to participant
tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'ciscopilot.jpeg');
}

// This method is called when your extension is deactivated
export function deactivate() {}
