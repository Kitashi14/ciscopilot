import { Uri, Webview } from "vscode";
import * as vscode from "vscode";

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(
  webview: Webview,
  extensionUri: Uri,
  pathList: string[]
) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getValueObjectArrayFromMap(map: Map<any, any>) {
  let arr: any[] = [];
  map.forEach((value, key) => {
    arr.push({ value });
  });
  return arr;
}

export async function openFileInEditor(path: string) {
  const uri = vscode.Uri.file(path); // Replace with the path to your file
  try {
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
  } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
  }
}