import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class AgimateMobileAction implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agimate Mobile',
		name: 'agimateMobile',
		icon: { light: 'file:agimate-mobile-action.svg', dark: 'file:agimate-mobile-action.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'By first agimate node',
		defaults: {
			name: 'AgimateMobileAction',
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
				displayName: 'Mobile Device',
				name: 'mobileDevice',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMobileDevices',
				},
				default: '',
				required: true,
				description: 'Select a mobile device to execute',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMethods',
					loadOptionsDependsOn: ['mobileDevice'],
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
			async getMobileDevices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('agimateApi');
					const baseUrl = credentials.apiUrl as string;

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'agimateApi',
						{
							method: 'GET',
							url: `${baseUrl}/device/api/device/`,
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
					const devices = responseObj.response || responseObj;

					// Ensure it's an array
					if (!Array.isArray(devices)) {
						throw new Error('Response is not an array. Got: ' + typeof devices);
					}

					// Map to n8n options format
					return devices.map((device: any) => ({
						value: device.deviceAuthKeyId || '',
						name: device.name || 'Unknown',
						description: device.description || '',
					}));
				} catch (error) {
					// Return error in a format that n8n can show
					throw new Error('Failed to load connectors: ' + (error as Error).message);
				}
			},

			async getMethods(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const mobileDevice = this.getCurrentNodeParameter('mobileDevice') as string;

					const credentials = await this.getCredentials('agimateApi');
					const baseUrl = credentials.apiUrl as string;

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'agimateApi',
						{
							method: 'GET',
							url: `${baseUrl}/device/api/device/actions/${mobileDevice}`,
							json: true,
						},
					);

                    this.logger.warn("url " + response)

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
						return {
							name: method.displayName || method.name || 'Unknown',
							value: method.name || '',
							description: method.description || '',
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
				const mobileDevice = this.getNodeParameter('mobileDevice', itemIndex, '') as string;
				const methodName = this.getNodeParameter('method', itemIndex, '') as string;

				if (!mobileDevice) {
					throw new NodeOperationError(
						this.getNode(),
						'Device must be selected',
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

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'POST',
						url: `${baseUrl}/device/api/device/call/${mobileDevice}`,
						json: true,
						body: { type: methodName, parameters: requestBody }
					},
				);

				// Parse response if it's a string
				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				// Unwrap SuccessResponse: { response: [...] }
				const responseObj = parsedResponse as any;
				const result = responseObj.response || responseObj;

				// Ensure it's an array
				if (result != "success") {
					throw new Error('Failed.');
				}

				// Use connectorCode, methodName, parameters and requestBody for API calls
				const item = items[itemIndex];
 				item.json.methodName = methodName;
				item.json.requestBody = requestBody;
				item.json.success = result;

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
