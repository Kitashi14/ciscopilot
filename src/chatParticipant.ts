import * as vscode from "vscode";
import {
	findDefinitionFn,
	findReferencesFn,
  listIncludedFilesFn,
  participantCommandFn,
  streamInportedModules,
} from "./chatCommandFunc";

const BASE_PROMPT =
  "You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.";

const EXERCISES_PROMPT =
  "You are a helpful tutor. Your job is to teach the user with fun, simple exercises that they can complete in the editor. Your exercises should start simple and get more complex as the user progresses. Move one concept at a time, and do not move on to the next concept until the user provides the correct answer. Give hints in your exercises to help the user learn. If the user is stuck, you can provide the answer and explain why it is the answer. If the user asks a non-programming question, politely decline to respond.";

// define a chat handler
export const ciscopilotHandler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) => {
  // initialize the prompt
  let prompt = BASE_PROMPT;

  if (request.command === "exercise") {
    prompt = EXERCISES_PROMPT;
    await participantCommandFn(request, context, stream, token, prompt);
  } else if (request.command === "listModules") {
    const modulesData = await listIncludedFilesFn(vscode.window.activeTextEditor);
    console.log(modulesData);
    streamInportedModules(modulesData, stream);
  } else if (request.command === "findReferences") {
    await findReferencesFn(stream);
  }  else if (request.command === "findDefination") {
    await findDefinitionFn(stream);
  }  else if (request.command === "test") {
    // Get the active text editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const text = editor.document.getText(selection);

      // Invoke the `github.copilot.chat.explain` command
      await vscode.commands.executeCommand("github.copilot.chat.explain");
    } else {
      vscode.window.showInformationMessage("No active editor found.");
    }
  } else if (request.command === "viewImportTree") {
    await vscode.commands.executeCommand("ciscopilot-test.viewImportTree");
  } else {
    await participantCommandFn(request, context, stream, token, prompt);
  }
  return;
};
