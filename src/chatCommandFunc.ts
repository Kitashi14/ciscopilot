import * as vscode from 'vscode';
import * as path from "path";
import { languagesSupported } from './extension';

export const participantCommandFn = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken, prompt: string) => {
	// initialize the messages array with the prompt
	const messages = [
		vscode.LanguageModelChatMessage.User(prompt),
	];

	// get all the previous participant messages
	const previousMessages = context.history.filter(
		(h) => h instanceof vscode.ChatResponseTurn
	);

	// add the previous messages to the messages array
	previousMessages.forEach((m) => {
		let fullMessage = '';
		m.response.forEach((r) => {
			const mdPart = r as vscode.ChatResponseMarkdownPart;
			fullMessage += mdPart.value.value;
		});
		messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
	});

	// add in the user's message
	messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

	// send the request
	const chatResponse = await request.model.sendRequest(messages, {}, token);

	// stream the response
	for await (const fragment of chatResponse.text) {
		// console.log(fragment);
		stream.markdown(fragment);
	}
}

async function findAllImportedFiles(
    rootFile: any,
    modulesFound: Map<string, any>
  ) {
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
    const importRegexPy =
      /^(?:from\s+([^\s]+)|import\s+([^\s,]+(?:,\s*[^\s,]+)*))/gm;
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
      if (languageId === "python" && importPath.includes(",")) {
  
        console.log(importPath);
        console.log(importPath.split(","));
  
        for(const imp of importPath.split(",")){
          const importPathStart =
          match.index +
          match[0].indexOf(imp.trim()) +
          imp.trim().length;
          const importPathPosition = document.positionAt(importPathStart);
          imports.push({
            module: imp.trim(),
            parentFilePath: filePath,
            //   line,
            //   character,
            //   importPathStart,
            importPathPosition,
          });
        }
      } else {
        const importPathStart =
          match.index +
          match[0].indexOf(importPath) +
          (languageId === "python" ? importPath.length : 0);
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
              !moduleFilePath.includes("site-packages") && !moduleFilePath.includes("stdlib");
            moduleFileName = isUserDefined ? moduleFileName : elem.module;
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
      if (imports[i].isUserDefined) {
        if (modulesFound.has(imports[i].moduleFileName)) {
          fullImports.push({
            ...imports[i],
            childImports: modulesFound.get(imports[i].moduleFileName)
              .childImports,
          });
        } else {
          const childImports: any = await findAllImportedFiles(
            {
              rootPath: imports[i].moduleFilePath,
            },
            modulesFound
          );
          fullImports.push({
            ...imports[i],
            childImports: childImports == false ? [] : childImports,
          });
          modulesFound.set(imports[i].moduleFileName, {
            moduleFileName: imports[i].moduleFileName,
            isUserDefined: imports[i].isUserDefined,
            moduleFilePath: imports[i].moduleFilePath,
            parentFilePath: imports[i].parentFilePath,
            childImports: childImports == false ? [] : childImports,
          });
        }
      } else {
        fullImports.push(imports[i]);
        if (!modulesFound.has(imports[i].moduleFileName)) {
          modulesFound.set(imports[i].moduleFileName, {
            moduleFileName: imports[i].moduleFileName,
            isUserDefined: imports[i].isUserDefined,
            parentFilePath: imports[i].parentFilePath,
            moduleFilePath: imports[i].moduleFilePath,
          });
        }
      }
    }
    // if LSP is not present for the language, return false otherwise return the full imports array
    return isLspPresent || !imports.length ? fullImports : isLspPresent;
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
    const allImports = await findAllImportedFiles(rootFile, modulesFound);
    if (!allImports) {
      console.log(
        "Looks like no LSP present for language:",
        languageId,
        ", first download an extention for browsing code in this language."
      );
      return false;
    } else console.log("all imports: ", allImports);
    console.log("modules found: ", modulesFound);
    return {
      rootFile,
      allImports,
      modulesFound,
    };
  };


export const streamInportedModules = (modulesData: any, stream: vscode.ChatResponseStream) => {
	// stream the response
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown('## Showing list of imported files for: ');
	}
	else{
		stream.markdown('## Showing list of imported files and modules for: ');
	}
	
	stream.anchor(vscode.Uri.file(modulesData.rootFile.rootPath));
	if(modulesData.allImports.length === 0){
		if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
			stream.markdown('\n\nNo files imported directly or indirectly. \n');
		}
		else{
			stream.markdown('\n\nNo files or modules imported directly or indirectly. \n');
		}
		
		return;
	}
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown('\n\n## List of files imported directly: \n\n');
	}
	else{
		stream.markdown('\n\n## List of files and modules imported directly: \n\n');
	}
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown(`- ### User files: \n`);
	}
	else{
		stream.markdown(`- ### Files: \n`);
	}
	var count = 1;
	for(const modules of modulesData.allImports){
		if(modules.isUserDefined){
			stream.markdown(`    ${count}. ${modules.moduleFileName}  `);
			count++;
			if(modules.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(modules.moduleFilePath));
			}
			stream.markdown(`\n`);
		}
	}
	if(count === 1){
		if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
			stream.markdown(`    No user files imported directly. \n`);

		}
		else{
			stream.markdown(`    No files imported directly. \n`);

		}
	}
	count = 1;
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown(`\n\n- ### Standard Files: \n`);


	}
	else{
		stream.markdown(`\n\n- ### Modules: \n`);
	}
	for(const modules of modulesData.allImports){
		if(!modules.isUserDefined){
			stream.markdown(`    ${count}. ${modules.moduleFileName}  `);
			count++;
			if(modules.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(modules.moduleFilePath));
			}
			stream.markdown(`\n`);

		}
	}
	if(count === 1){
		if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
			stream.markdown(`    No standard files imported directly. \n`);
		}
		else{
			stream.markdown(`    No modules imported directly. \n`);
		}
	}
	stream.markdown("\n ");
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown('## List of nested files imported directly or indirectly: \n\n');

	}
	else{
		stream.markdown('## List of nested files and modules imported directly or indirectly: \n\n');

	}
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown(`- ### User Files: \n`);


	}
	else{
		stream.markdown(`- ### Files: \n`);


	}
	count = 1;
	for(const value of modulesData.modulesFound.values()){
		if(value.isUserDefined){
			stream.markdown(`    ${count}. ${value.moduleFileName}  `);
			count++;
			if(value.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(value.moduleFilePath));
			}
			stream.markdown('  |  **first found at:**');
			stream.anchor(vscode.Uri.file(value.parentFilePath));
			stream.markdown(`\n`);

		}
	}
	if(count === 1){
		if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
			stream.markdown(`    No user files imported directly or indirectly. \n`);
		}
		else{
			stream.markdown(`    No files imported directly or indirectly. \n`);
	
		}
		
	}
	count = 1;
	if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
		stream.markdown(`\n\n- ### Standard Files: \n`);

	}
	else{
		stream.markdown(`\n\n- ### Modules: \n`);


	}
	for(const value of modulesData.modulesFound.values()){
		if(!value.isUserDefined){
			stream.markdown(`    ${count}. ${value.moduleFileName}  `);
			count++;
			if(value.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(value.moduleFilePath));
			}
			stream.markdown('  |  **first found at:**');
			stream.anchor(vscode.Uri.file(value.parentFilePath));
			stream.markdown(`\n`);
		}
	}
	
	if(count === 1){
		if(modulesData.rootFile.languageId==='c' || modulesData.rootFile.languageId==='cpp'){
			stream.markdown(`    No standard files imported directly or indirectly. \n`);

		}
		else{
			stream.markdown(`    No modules imported directly or indirectly. \n`);
		}
	}
	console.log(modulesData.rootFile.languageId);
}