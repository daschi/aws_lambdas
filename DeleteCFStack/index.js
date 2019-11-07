const AWS = require('aws-sdk');
const cf = new AWS.CloudFormation();

async function handleWebhookEvent(webhookBody) {
    const action = webhookBody['action'];
    const pullRequest = webhookBody['pull_request'];
    let message = 'Event ignored';

    // If no pull_request, ignore event
    if(!pullRequest) {
        return { statusCode: 200, message: message };
    }

    const branchName = pullRequest['head']['ref'];
    const repoName = pullRequest['head']['repo']['name'];

    console.log({action});
    console.log({branchName});

    if(action === 'closed' && branchName != 'master') {
        const stackNameRepo = `${branchName}-${repoName}`;
        const stackNameDev = `${stackNameRepo}-dev`;
        const stackNameTest = `${stackNameRepo}-test`;
        // Delete the stacks
        await cf.deleteStack({StackName: stackNameRepo}).promise();
        await cf.deleteStack({StackName: stackNameDev}).promise();
        await cf.deleteStack({StackName: stackNameTest}).promise();
        message = `CloudFormation Stacks deleted: ${stackNameRepo}, ${stackNameDev}, ${stackNameTest}`;
    } else {
        message = "Pull request event ignored";
    }
    return { statusCode: 200, body: message };
}

module.exports.handler = async (event, context) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    let response;

    if (!event.body) {
        response = { statusCode: 403, body: 'Missing event body' };
        console.log(`Response: ${JSON.stringify(response, null, 2)}`);
        return response;
    }

    // Parse the message body from the Lambda proxy
    let body;

    try {
      body = JSON.parse(event.body);
    } catch (e) {
      console.log(`Request Event Body is not JSON: ${event.body}`)
      console.log(`Error: ${e}`)
      response = { statusCode: 200, body: 'Event body is not JSON, Ignoring event' };
      return response
    }

    console.log(`Event body: ${JSON.stringify(body, null, 2)}`);

    // Handle the webhook event
    response = await handleWebhookEvent(body);

    console.log(`Response: ${JSON.stringify(response, null, 2)}`);
    return response;
};
