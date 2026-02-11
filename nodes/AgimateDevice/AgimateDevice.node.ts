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

interface AgimateDeviceItem {
	deviceAuthKeyId?: string;
	name?: string;
	description?: string;
}

interface AgimateMethod {
	name?: string;
	displayName?: string;
	description?: string;
}

export class AgimateDevice implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agimate Device',
		name: 'agimateDevice',
		icon: { light: 'file:agimate-device-action.svg', dark: 'file:agimate-device-action.dark.svg' },
		group: ['input'],
		version: 1,
		description: 'Execute actions on devices registered with Agimate',
		defaults: {
			name: 'AgimateDeviceAction',
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
				displayName: 'Device Name or ID',
				name: 'device',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getDevices',
				},
				default: '',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description: 'Select a device to execute actions on',
			},
			{
				displayName: 'Method Name or ID',
				name: 'method',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getMethods',
					loadOptionsDependsOn: ['device'],
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
			async getDevices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
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

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as AgimateResponseWrapper;
				const devices = (responseObj.response || responseObj) as AgimateDeviceItem[];

				if (!Array.isArray(devices)) {
					throw new NodeOperationError(this.getNode(), 'Response is not an array. Got: ' + typeof devices);
				}

				return devices.map((device) => ({
					value: device.deviceAuthKeyId || '',
					name: device.name || 'Unknown',
					description: device.description || '',
				}));
			},

			async getMethods(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const device = this.getCurrentNodeParameter('device') as string;

				const credentials = await this.getCredentials('agimateApi');
				const baseUrl = credentials.apiUrl as string;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'GET',
						url: `${baseUrl}/device/api/device/actions/${device}`,
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

				return methods.map((method) => ({
					name: method.displayName || method.name || 'Unknown',
					value: method.name || '',
					description: method.description || '',
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const device = this.getNodeParameter('device', itemIndex, '') as string;
				const methodName = this.getNodeParameter('method', itemIndex, '') as string;

				if (!device) {
					throw new NodeOperationError(
						this.getNode(),
						'Device must be selected',
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

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'agimateApi',
					{
						method: 'POST',
						url: `${baseUrl}/device/api/device/call/${device}`,
						json: true,
						body: { type: methodName, parameters: requestBody },
					},
				);

				let parsedResponse = response;
				if (typeof response === 'string') {
					parsedResponse = JSON.parse(response);
				}

				const responseObj = parsedResponse as Record<string, unknown>;
				const result = responseObj.response || responseObj;

				if (result !== 'success') {
					throw new NodeOperationError(this.getNode(), 'Device action failed', { itemIndex });
				}

				const item = items[itemIndex];
				item.json.methodName = methodName;
				item.json.requestBody = requestBody;
				item.json.success = result;

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
