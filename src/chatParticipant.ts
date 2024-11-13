import * as vscode from 'vscode';
import { listIncludedFilesFn } from './extension';

const BASE_PROMPT = 'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';

const EXERCISES_PROMPT = 'You are a helpful tutor. Your job is to teach the user with fun, simple exercises that they can complete in the editor. Your exercises should start simple and get more complex as the user progresses. Move one concept at a time, and do not move on to the next concept until the user provides the correct answer. Give hints in your exercises to help the user learn. If the user is stuck, you can provide the answer and explain why it is the answer. If the user asks a non-programming question, politely decline to respond.';


const participantCommandFn = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken, prompt: string) => {
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

const streamInportedModules = (modulesData: any, stream: vscode.ChatResponseStream) => {
	// stream the response
	stream.markdown('## Showing list of imported files and modules for: ');
	stream.anchor(vscode.Uri.file(modulesData.rootFile.rootPath));
	if(modulesData.allImports.length === 0){
		stream.markdown('\n\nNo files or modules imported directly or indirectly. \n');
		return;
	}
	stream.markdown('\n\n## List of files and modules imported directly: \n\n');
	stream.markdown(`### Files: \n`);
	var count = 1;
	for(const modules of modulesData.allImports){
		if(modules.isUserDefined){
			stream.markdown(`${count}. ${modules.moduleFileName}  `);
			count++;
			if(modules.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(modules.moduleFilePath));
			}
			stream.markdown(`\n`);
		}
	}
	if(count === 1){
		stream.markdown(`No files imported directly. \n`);
	}
	count = 1;
	stream.markdown(`\n\n### Modules: \n`);
	for(const modules of modulesData.allImports){
		if(!modules.isUserDefined){
			stream.markdown(`${count}. ${modules.moduleFileName}  `);
			count++;
			if(modules.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(modules.moduleFilePath));
			}
			stream.markdown(`\n`);

		}
	}
	if(count === 1){
		stream.markdown(`No modules imported directly. \n`);
	}
	stream.markdown("\n ");
	stream.markdown('## List of nested files and modules imported directly or indirectly: \n\n');
	stream.markdown(`### Files: \n`);
	count = 1;
	for(const value of modulesData.modulesFound.values()){
		if(value.isUserDefined){
			stream.markdown(`${count}. ${value.moduleFileName}  `);
			count++;
			if(value.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(value.moduleFilePath));
			}
			stream.markdown(' \tfound at:');
			stream.anchor(vscode.Uri.file(value.parentFilePath));
			stream.markdown(`\n`);

		}
	}
	if(count === 1){
		stream.markdown(`No files imported directly or indirectly. \n`);
	}
	count = 1;
	stream.markdown(`\n\n### Modules: \n`);
	for(const value of modulesData.modulesFound.values()){
		if(!value.isUserDefined){
			stream.markdown(`${count}. ${value.moduleFileName}  `);
			count++;
			if(value.isUserDefined
				!==null){
				stream.anchor(vscode.Uri.file(value.moduleFilePath));
			}
			stream.markdown(` found at:`);
			stream.anchor(vscode.Uri.file(value.parentFilePath));
			stream.markdown(`\n`);
		}
	}
	if(count === 1){
		stream.markdown(`No modules imported directly or indirectly. \n`);
	}
}

// define a chat handler
export const tutorHandler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {

	// initialize the prompt
	let prompt = BASE_PROMPT;

	if (request.command === 'exercise') {
		prompt = EXERCISES_PROMPT;
		await participantCommandFn(request, context, stream, token, prompt);
	}else if(request.command === 'listModules'){
		const modulesData = await listIncludedFilesFn();
		console.log(modulesData);
		streamInportedModules(modulesData, stream);
	}else{
		await participantCommandFn(request, context, stream, token, prompt);
	}

	

	return;

};
