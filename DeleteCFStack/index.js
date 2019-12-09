const AWS = require('aws-sdk');
const cf = new AWS.CloudFormation();

function parseWebhookBody(eventType, webhookBody) {
  let shouldDeleteStack, branchName, repoName;

  if (eventType === 'pull_request') {
    branchName = webhookBody['pull_request']['head']['ref'];
    repoName = webhookBody['pull_request']['head']['repo']['name'];
    shouldDeleteStack = webhookBody['action'] === 'closed' && branchName !== 'master';
  } else if (eventType === 'delete') {
    branchName = webhookBody['ref'];
    repoName = webhookBody['repository']['name'];
    shouldDeleteStack = webhookBody['ref_type'] === 'branch' && branchName !== 'master';
  };

  console.log('shouldDeleteStack', shouldDeleteStack);
  const stackName = `${branchName}-${repoName}`
  return { shouldDeleteStack, stackName }
}

async function handleWebhookEvent(eventType, webhookBody) {
  if(!['pull_request', 'delete'].includes(eventType)) {
    const message = `Event ignored. Event type: ${eventType}`;
    return { statusCode: 200, message: message };
  }

  const { shouldDeleteStack, stackName } = parseWebhookBody(eventType, webhookBody);

  if (!shouldDeleteStack) {
    const message = `Event should not delete stack: shouldDeleteStack: ${shouldDeleteStack}, eventType: ${eventType}`;
    return { statusCode: 200, message: message };
  } else {
    // Delete the stacks
    const stackNameDev = `${stackName}-dev`;
    const stackNameTest = `${stackName}-test`;
    await cf.deleteStack({StackName: stackName}).promise();
    await cf.deleteStack({StackName: stackNameDev}).promise();
    await cf.deleteStack({StackName: stackNameDev}).promise();

    const message = `CloudFormation Stacks deleted: ${stackName}, ${stackNameDev}, ${stackNameTest}`;
    return { statusCode: 200, message: message };
  }
};

module.exports.handler = async (event, context) => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  let response;
parseWebhookBody
  if (!event.body) {
      response = { statusCode: 403, body: 'Missing event body' };
      console.log(`Response: ${JSON.stringify(response, null, 2)}`);
      return response;
  }

  let body;

  try {
    // Parse the message body from the Lambda proxy
    body = JSON.parse(event.body);
  } catch (e) {
    console.log(`Request Event Body is not JSON: ${event.body}`)
    console.log(`Error: ${e}`)
    response = { statusCode: 200, body: 'Event body is not JSON, Ignoring event' };
    return response
  }

  console.log(`Event body: ${JSON.stringify(body, null, 2)}`);

  const gitHubEvent = event.headers['X-GitHub-Event'];
  response = await handleWebhookEvent(gitHubEvent, body);

  console.log(`Response: ${JSON.stringify(response, null, 2)}`);
  return response;
};
