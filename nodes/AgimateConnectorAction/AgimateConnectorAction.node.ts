import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class AgimateConnectorAction implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agimate Connectors',
		name: 'agimateConnectors',
		icon: { light: 'file:agimate-connector-action.svg', dark: 'file:agimate-connector-action.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'By first agimate node',
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
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Connector',
				name: 'connector',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectors',
				},
				default: '',
				required: true,
				description: 'Select a connector from your Agimate account',
			},
			{
				displayName: 'Connector Credentials',
				name: 'connectorCredential',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectorCredentials',
					loadOptionsDependsOn: ['connector'],
				},
				default: '',
				required: true,
				description: 'Select a credentials to execute',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMethods',
					loadOptionsDependsOn: ['connectorCredential'],
				},
				default: '',
				required: true,
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
				try {
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

					// Parse response if it's a string
					let parsedResponse = response;
					if (typeof response === 'string') {
						parsedResponse = JSON.parse(response);
					}

					// Unwrap SuccessResponse: { response: [...] }
					const responseObj = parsedResponse as any;
					const connectors = responseObj.response || responseObj;

					// Ensure it's an array
					if (!Array.isArray(connectors)) {
						throw new Error('Response is not an array. Got: ' + typeof connectors);
					}

					// Map to n8n options format
					return connectors.map((connector: any) => ({
						name: connector.name || 'Unknown',
						value: connector.code || connector.id || '',
						description: connector.description || '',
					}));
				} catch (error) {
					// Return error in a format that n8n can show
					throw new Error('Failed to load connectors: ' + (error as Error).message);
				}
			},

			async getConnectorCredentials(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const connectorCode = this.getCurrentNodeParameter('connector') as string;

					const credentials = await this.getCredentials('agimateApi');
					const baseUrl = credentials.apiUrl as string;
					const url = `${baseUrl}/connectors-api/api/connectors/credentials/${connectorCode}/`;

					this.logger.warn("url " + url)

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'agimateApi',
						{
							method: 'GET',
							url: url,
							json: true,
						},
					);

					this.logger.warn("response " + response)

					// Parse response if it's a string
					let parsedResponse = response;
					if (typeof response === 'string') {
						parsedResponse = JSON.parse(response);
					}

					// Unwrap SuccessResponse: { response: [...] }
					const responseObj = parsedResponse as any;
					const connectorCredentials = responseObj.response || responseObj;

					this.logger.warn("test 1")

					// Ensure it's an array
					if (!Array.isArray(connectorCredentials)) {
						throw new Error('Response is not an array. Got: ' + typeof connectorCredentials);
					}

					this.logger.warn("test 2")

					// Map to n8n options format
					return connectorCredentials.map((connectorCred: any) => ({
						name: connectorCred.name || 'Unknown',
						value: connectorCred.id || '',
						description: connectorCred.description || '',
					}));

				} catch (error) {
					// Return error in a format that n8n can show
					throw new Error('Failed to load credentials: ' + (error as Error).message);
				}
			},

			async getMethods(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const connectorCode = this.getCurrentNodeParameter('connector') as string;

					if (!connectorCode) {
						return [];
					}

					const credentials = await this.getCredentials('agimateApi');
					const baseUrl = credentials.apiUrl as string;
					const url = `${baseUrl}/connectors-api/api/connectors/methods/${connectorCode}/` as string;

					this.logger.warn("url " + url)

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'agimateApi',
						{
							method: 'GET',
							url: url,
							json: true,
						},
					);

					// Parse response if it's a string
					let parsedResponse = response;
					if (typeof response === 'string') {
						parsedResponse = JSON.parse(response);
					}

					// Unwrap SuccessResponse: { response: [...] }
					const responseObj = parsedResponse as any;
					const methods = responseObj.response || responseObj;

					// Ensure it's an array
					if (!Array.isArray(methods)) {
						throw new Error('Response is not an array. Got: ' + typeof methods);
					}

					// Map to n8n options format
					return methods.map((method: any) => {
						let description = method.description || '';

						// Add HTTP method to description
						if (method.httpMethod) {
							description = `[${method.httpMethod}] ${description}`;
						}

						// Add parameters information to description
						if (method.parameters && Array.isArray(method.parameters) && method.parameters.length > 0) {
							const requiredParams = method.parameters.filter((p: any) => p.required);
							const optionalParams = method.parameters.filter((p: any) => !p.required);

							const paramInfo: string[] = [];

							if (requiredParams.length > 0) {
								paramInfo.push('Required: ' + requiredParams.map((p: any) => p.name).join(', '));
							}

							if (optionalParams.length > 0) {
								paramInfo.push('Optional: ' + optionalParams.map((p: any) => p.name).join(', '));
							}

							if (paramInfo.length > 0) {
								description += (description ? ' | ' : '') + paramInfo.join(' | ');
							}
						}

						// Add request body schema information to description
						if (method.requestBodySchema && method.requestBodySchema.fields && method.requestBodySchema.fields.length > 0) {
							const bodyFields = method.requestBodySchema.fields as Array<{ name: string; type: string; required: boolean; description: string }>;
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
				} catch (error) {
					// Return error in a format that n8n can show
					throw new Error('Failed to load methods: ' + (error as Error).message);
				}
			},

		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		// Iterates over all input items
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Get connector and method parameters
				const connectorCode = this.getNodeParameter('connector', itemIndex, '') as string;
				const methodName = this.getNodeParameter('method', itemIndex, '') as string;

				if (!connectorCode) {
					throw new NodeOperationError(
						this.getNode(),
						'Connector must be selected',
						{ itemIndex }
					);
				}

				if (!methodName) {
					throw new NodeOperationError(
						this.getNode(),
						'Method must be selected',
						{ itemIndex }
					);
				}

				// Get request body
				const requestBodyStr = this.getNodeParameter('requestBody', itemIndex, '{}') as string;
				let requestBody: any = {};
				try {
					if (requestBodyStr && requestBodyStr.trim() !== '{}' && requestBodyStr.trim() !== '') {
						requestBody = JSON.parse(requestBodyStr);
					}
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid JSON in Request Body: ' + (error as Error).message,
						{ itemIndex }
					);
				}

				// Get credentials and load method metadata for validation
				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;

				// Load method metadata to validate parameters
				const methodsResponse = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: `${baseUrl}/connectors-api/api/methods/${connectorCode}`,
						json: true,
					},
				);

				// Parse and find the selected method
				let methodsData = methodsResponse;
				if (typeof methodsResponse === 'string') {
					methodsData = JSON.parse(methodsResponse);
				}
				const methods = (methodsData as any).response || methodsData;
				const selectedMethod = methods.find((m: any) => m.name === methodName);

				if (!selectedMethod) {
					throw new NodeOperationError(
						this.getNode(),
						`Method '${methodName}' not found for connector '${connectorCode}'`,
						{ itemIndex }
					);
				}


				// Use connectorCode, methodName, parameters and requestBody for API calls
				const item = items[itemIndex];
				item.json.connectorCode = connectorCode;
				item.json.methodName = methodName;
				item.json.requestBody = requestBody;
				item.json.methodMetadata = selectedMethod;

				// TODO: Add connector method execution logic here
				// Example: await callConnectorMethod(connectorCode, methodName, parameters, requestBody);

			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
