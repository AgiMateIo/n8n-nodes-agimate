# n8n-nodes-agimate

This is an n8n community node for the Agimate platform. It lets you integrate Agimate connectors, mobile devices, and event triggers into your n8n workflows.

Agimate is a platform for managing and automating IoT devices, mobile applications, and third-party service integrations.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Nodes](#nodes)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Nodes

This package includes three nodes:

### Agimate Connectors

Executes actions through connectors registered on the Agimate platform.

**Parameters:**
- **Connector** - Select a connector from your Agimate account
- **Connector Credentials** - Select credentials for the connector
- **Method** - Select a method to execute
- **Request Body** - JSON request body for the method (optional)

### Agimate Mobile

Executes actions on mobile devices registered with Agimate.

**Parameters:**
- **Mobile Device** - Select a device from your Agimate account
- **Method** - Select an action to execute on the device
- **Request Body** - JSON request body for the action (optional)

### Agimate Trigger

Receives webhook events from the Agimate platform. This is a trigger node that starts workflows when events occur.

**Parameters:**
- **Event Types** - Filter by event types (default: `*` for all events)
- **Authentication** - `header` (validate Authorization header) or `none`
- **Include Headers** - Include HTTP headers in output data
- **Include Query Parameters** - Include query parameters in output data

**Supported Event Types:**
- `mobile.trigger` - Events triggered on mobile devices
- `connector.event` - Events from connectors
- `credential.updated` - Credential update events
- `device.action` - Device action events

**Note:** After activating the workflow, copy the webhook URL and register it on the Agimate platform.

## Credentials

### Agimate API

To use these nodes, you need to configure Agimate API credentials:

1. In n8n, go to **Credentials** > **New Credential**
2. Search for "Agimate API"
3. Configure the following fields:
   - **API URL** - Base URL of the Agimate API (default: `https://api.agimate.io`)
   - **API Key** - Your Agimate API key

The API key is sent in the `X-API-Key` header for all API requests.

## Compatibility

Tested with n8n version 1.x. Requires n8n-workflow package.

## Usage

### Example: Execute mobile device action

1. Add **Agimate Mobile** node to your workflow
2. Configure credentials
3. Select your mobile device
4. Choose an action (e.g., `vibrate`)
5. Set request body: `{"duration": 500}`

### Example: React to mobile triggers

1. Add **Agimate Trigger** node
2. Set event type to `mobile.trigger`
3. Activate workflow and copy webhook URL
4. Register webhook URL in Agimate platform
5. Add processing nodes after the trigger

### Example: Use connector actions

1. Add **Agimate Connectors** node
2. Select connector and credentials
3. Choose method to execute
4. Configure request body if needed

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Agimate platform](https://agimate.io)

## Version history

### 0.1.0
- Initial release
- Agimate Connectors node
- Agimate Mobile node
- Agimate Trigger node
