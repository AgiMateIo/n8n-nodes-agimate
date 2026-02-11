import type { IAuthenticateGeneric, Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class AgimateApi implements ICredentialType {
	name = 'agimateApi';
	displayName = 'Agimate API';
	documentationUrl = 'https://agimate.io/n8n';
	icon: Icon = { light: 'file:../icons/logo.svg', dark: 'file:../icons/logo.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API URL',
			name: 'apiUrl',
			type: 'string',
			default: 'https://api.agimate.io',
			required: true,
			description: 'Base URL of the Agimate API',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiUrl}}',
			url: '/user/api-keys/verify',
			method: 'POST',
		},
	};
}
