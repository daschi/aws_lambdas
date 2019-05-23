const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function handleWebhookEvent(webhookBody) {
    const action = webhookBody['action'];
    const pullRequest = webhookBody['pull_request'];
    let message = 'Event ignored';

    // If no pull_request, ignore event
    if(!pullRequest) {
        return { statusCode: 200, message: message };
    }

    const branchName = pullRequest['head']['ref'];
    const merged = pullRequest['merged'];

    console.log({action});
    console.log({merged});
    console.log({branchName});

    if(action === 'closed' && (merged || merged === 'true') && branchName != 'master') {
        const bucket = `${branchName}-baloo`;
        let objects;

        // List all object keys in the bucket
        try {
          let response = await s3.listObjects({Bucket: bucket}).promise();
          objects = response['Contents'].map((object) => { return { 'Key': object['Key'] } });
        } catch (e) {
          console.log(e);
          throw new Error(e);
        }

        console.log({objects});

        // Delete all the objects from the bucket
        await s3.deleteObjects({Bucket: bucket, Delete: { Objects: objects }}).promise();
        // Delete the bucket
        await s3.deleteBucket({Bucket: bucket}).promise();
        message = `S3 bucket deleted: ${bucket}`;
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
