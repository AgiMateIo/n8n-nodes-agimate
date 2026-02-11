import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

interface AgimateResponseWrapper {
	response?: unknown[];
}

interface AgimateConnector {
	name?: string;
	code?: string;
	id?: string;
	description?: string;
}

interface AgimateCredential {
	name?: string;
	id?: string;
	description?: string;
}

interface AgimateMethodParam {
	name: string;
	required: boolean;
}

interface AgimateBodyField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

interface AgimateMethod {
	name?: string;
	displayName?: string;
	description?: string;
	httpMethod?: string;
	parameters?: AgimateMethodParam[];
	requestBodySchema?: {
		fields?: AgimateBodyField[];
	};
}

export class AgimateConnectors implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agimate Connectors',
		name: 'agimateConnectors',
		icon: { light: 'file:agimate-connector-action.svg', dark: 'file:agimate-connector-action.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'Execute methods on Agimate platform connectors',
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
				displayName: 'Connector Credentials Name or ID',
				name: 'connectorCredential',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectorCredentials',
					loadOptionsDependsOn: ['connector'],
				},
				default: '',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description: 'Select credentials for the connector',
			},
			{
				displayName: 'Method Name or ID',
				name: 'method',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMethods',
					loadOptionsDependsOn: ['connectorCredential'],
				},
				default: '',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description: 'Select a method to execute',
			},
			{
				displayName: 'Request Body',
				name: 'requestBody',
				type: 'json',
				default: '{}',
				description: 'Request body as JSON (used for POST/PUT/PATCH methods)',
				hint: 'Check method description - if it shows [POST/PUT/PATCH], you may need to provide request body',
				placeholder: '{\n  "action": "vibrate",\n  "duration": 500\n}',
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
						url: `${baseUrl}/connectors-api/api/connectors/`,
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
					value: connector.code || connector.id || '',
					description: connector.description || '',
				}));
			},

			async getConnectorCredentials(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const connectorCode = this.getCurrentNodeParameter('connector') as string;

				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;
				const url = `${baseUrl}/connectors-api/api/connectors/credentials/${connectorCode}/`;
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: url,
						json: true,
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as AgimateResponseWrapper;
				const connectorCredentials = (responseObj.response || responseObj) as AgimateCredential[];

				if (!Array.isArray(connectorCredentials)) {
					throw new NodeOperationError(this.getNode(), 'Response is not an array. Got: ' + typeof connectorCredentials);
				}

				return connectorCredentials.map((connectorCred) => ({
					name: connectorCred.name || 'Unknown',
					value: connectorCred.id || '',
					description: connectorCred.description || '',
				}));
			},

			async getMethods(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const connectorCode = this.getCurrentNodeParameter('connector') as string;

				if (!connectorCode) {
					return [];
				}

				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;
				const url = `${baseUrl}/connectors-api/api/connectors/methods/${connectorCode}/`;
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: url,
						json: true,
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as AgimateResponseWrapper;
				const methods = (responseObj.response || responseObj) as AgimateMethod[];

				if (!Array.isArray(methods)) {
					throw new NodeOperationError(this.getNode(), 'Response is not an array. Got: ' + typeof methods);
				}

				return methods.map((method) => {
					let description = method.description || '';

					if (method.httpMethod) {
						description = `[${method.httpMethod}] ${description}`;
					}

					if (method.parameters && Array.isArray(method.parameters) && method.parameters.length > 0) {
						const requiredParams = method.parameters.filter((p) => p.required);
						const optionalParams = method.parameters.filter((p) => !p.required);

						const paramInfo: string[] = [];

						if (requiredParams.length > 0) {
							paramInfo.push('Required: ' + requiredParams.map((p) => p.name).join(', '));
						}

						if (optionalParams.length > 0) {
							paramInfo.push('Optional: ' + optionalParams.map((p) => p.name).join(', '));
						}

						if (paramInfo.length > 0) {
							description += (description ? ' | ' : '') + paramInfo.join(' | ');
						}
					}

					if (method.requestBodySchema?.fields && method.requestBodySchema.fields.length > 0) {
						const bodyFields = method.requestBodySchema.fields;
						const requiredBodyFields = bodyFields.filter((f) => f.required);
						const optionalBodyFields = bodyFields.filter((f) => !f.required);

						const bodyInfo: string[] = [];

						if (requiredBodyFields.length > 0) {
							bodyInfo.push('Body (required): ' + requiredBodyFields.map((f) => `${f.name}:${f.type}`).join(', '));
						}

						if (optionalBodyFields.length > 0) {
							bodyInfo.push('Body (optional): ' + optionalBodyFields.map((f) => `${f.name}:${f.type}`).join(', '));
						}

						if (bodyInfo.length > 0) {
							description += (description ? ' | ' : '') + bodyInfo.join(' | ');
						}
					}

					return {
						name: method.displayName || method.name || 'Unknown',
						value: method.name || '',
						description: description,
					};
				});
			},

		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const connectorCode = this.getNodeParameter('connector', itemIndex, '') as string;
				const methodName = this.getNodeParameter('method', itemIndex, '') as string;

				if (!connectorCode) {
					throw new NodeOperationError(
						this.getNode(),
						'Connector must be selected',
						{ itemIndex },
					);
				}

				if (!methodName) {
					throw new NodeOperationError(
						this.getNode(),
						'Method must be selected',
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

				const methodsResponse = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: `${baseUrl}/connectors-api/api/methods/${connectorCode}`,
						json: true,
					},
				);

				let methodsData = methodsResponse;
				if (typeof methodsResponse === 'string') {
					methodsData = JSON.parse(methodsResponse);
				}
				const methodsObj = methodsData as AgimateResponseWrapper;
				const methods = (methodsObj.response || methodsObj) as AgimateMethod[];
				const selectedMethod = methods.find((m) => m.name === methodName);

				if (!selectedMethod) {
					throw new NodeOperationError(
						this.getNode(),
						`Method '${methodName}' not found for connector '${connectorCode}'`,
						{ itemIndex },
					);
				}

				const item = items[itemIndex];
				item.json.connectorCode = connectorCode;
				item.json.methodName = methodName;
				item.json.requestBody = requestBody;
				item.json.methodMetadata = selectedMethod;

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
