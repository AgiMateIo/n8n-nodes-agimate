import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

function generateUUID(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

interface AgimateResponseWrapper {
	response?: unknown[];
}

interface AgimateConnector {
	connectorPubId?: string;
	name?: string;
	description?: string;
}

interface AgimateDeviceTool {
	name?: string;
	description?: string;
	params?: string[];
}

export class AgimateConnectors implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agimate Connectors',
		name: 'agimateConnectors',
		icon: { light: 'file:agimate-connector-action.svg', dark: 'file:agimate-connector-action.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'Execute tools on Agimate platform connectors',
		defaults: {
			name: 'AgimateConnectorAction',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'agimateApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Connector Name or ID',
				name: 'connector',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectors',
				},
				default: '',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description: 'Select a connector from your Agimate account',
			},
			{
				displayName: 'Tool Name or ID',
				name: 'tool',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTools',
					loadOptionsDependsOn: ['connector'],
				},
				default: '',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description: 'Select a tool to execute',
			},
			{
				displayName: 'Request Body',
				name: 'requestBody',
				type: 'json',
				default: '{}',
				description:
					'Request body as JSON. Leave as {} to auto-populate with empty params from the tool definition.',
				hint: 'Check tool dropdown description for expected params. Leave as {} to auto-fill param names.',
				placeholder: '{\n  "message": "Hello",\n  "chatId": "123"\n}',
			},
		],
	};

	methods = {
		loadOptions: {
			async getConnectors(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: `${baseUrl}/device/agent/connectors/`,
						json: true,
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as AgimateResponseWrapper;
				const connectors = (responseObj.response || responseObj) as AgimateConnector[];

				if (!Array.isArray(connectors)) {
					throw new NodeOperationError(this.getNode(), 'Response is not an array. Got: ' + typeof connectors);
				}

				return connectors.map((connector) => ({
					name: connector.name || 'Unknown',
					value: connector.connectorPubId || '',
					description: connector.description || '',
				}));
			},

			async getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const connectorId = this.getCurrentNodeParameter('connector') as string;

				if (!connectorId) {
					return [];
				}

				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: `${baseUrl}/device/agent/connectors/tools/${connectorId}`,
						json: true,
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as AgimateResponseWrapper;
				const tools = (responseObj.response || responseObj) as AgimateDeviceTool[];

				if (!Array.isArray(tools)) {
					throw new NodeOperationError(this.getNode(), 'Response is not an array. Got: ' + typeof tools);
				}

				return tools.map((tool) => {
					let description = tool.description || '';
					if (tool.params && tool.params.length > 0) {
						const template = JSON.stringify(
							Object.fromEntries(tool.params.map((p) => [p, ''])),
						);
						description += (description ? ' | ' : '') + `Params: ${template}`;
					}
					return {
						name: tool.name || 'Unknown',
						value: tool.name || '',
						description,
					};
				});
			},

		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const connectorId = this.getNodeParameter('connector', itemIndex, '') as string;
				const toolName = this.getNodeParameter('tool', itemIndex, '') as string;

				if (!connectorId) {
					throw new NodeOperationError(
						this.getNode(),
						'Connector must be selected',
						{ itemIndex },
					);
				}

				if (!toolName) {
					throw new NodeOperationError(
						this.getNode(),
						'Tool must be selected',
						{ itemIndex },
					);
				}

				const requestBodyStr = this.getNodeParameter('requestBody', itemIndex, '{}') as string;
				let requestBody: Record<string, unknown> = {};
				try {
					if (requestBodyStr && requestBodyStr.trim() !== '{}' && requestBodyStr.trim() !== '') {
						requestBody = JSON.parse(requestBodyStr) as Record<string, unknown>;
					}
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid JSON in Request Body: ' + (error as Error).message,
						{ itemIndex },
					);
				}

				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;

				// Auto-populate params when requestBody is empty
				if (Object.keys(requestBody).length === 0) {
					const toolsResponse = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'agimateApi',
						{
							method: 'GET',
							url: `${baseUrl}/device/agent/connectors/tools/${connectorId}`,
							json: true,
						},
					);

					let parsedTools = toolsResponse;
					if (typeof toolsResponse === 'string') {
						parsedTools = JSON.parse(toolsResponse);
					}

					const toolsObj = parsedTools as AgimateResponseWrapper;
					const tools = (toolsObj.response || toolsObj) as AgimateDeviceTool[];

					if (Array.isArray(tools)) {
						const matched = tools.find((t) => t.name === toolName);
						if (matched?.params && matched.params.length > 0) {
							requestBody = Object.fromEntries(
								matched.params.map((p) => [p, '']),
							);
						}
					}
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'POST',
						url: `${baseUrl}/device/agent/tool/call/${connectorId}`,
						json: true,
						body: { id: generateUUID(), name: toolName, input: requestBody },
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as Record<string, unknown>;
				const toolUseId = responseObj.response || responseObj;

				const item = items[itemIndex];
				item.json.connectorId = connectorId;
				item.json.toolName = toolName;
				item.json.requestBody = requestBody;
				item.json.toolUseId = toolUseId;

			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if ((error as NodeOperationError).context) {
						(error as NodeOperationError).context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
