const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function deleteS3Bucket(bucket) {
  let objects;

  try {
    let response = await s3.listObjects({Bucket: bucket}).promise();
    objects = response['Contents'].map((object) => { return { 'Key': object['Key'] } });
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }

  if(objects.length > 0) {
    console.log(`deleting contents for bucket ${bucket}`);
    await s3.deleteObjects({Bucket: bucket, Delete: { Objects: objects }}).promise();
    console.log(`deleting bucket ${bucket}`);
    await s3.deleteBucket({Bucket: bucket}).promise();
  } else {
    console.log(`deleting bucket ${bucket}`);
    await s3.deleteBucket({Bucket: bucket}).promise();
  }
};

function parseWebhookBody(eventType, webhookBody) {
  let shouldDeleteBucket, branchName, repoName;

  if (eventType === 'pull_request') {
    branchName = webhookBody['pull_request']['head']['ref'];
    repoName = webhookBody['pull_request']['head']['repo']['name'];
    shouldDeleteBucket = webhookBody['action'] === 'closed' && branchName !== 'master';
  } else if (eventType === 'delete') {
    branchName = webhookBody['ref'];
    repoName = webhookBody['repository']['name'];
    shouldDeleteBucket = webhookBody['ref_type'] === 'branch' && branchName !== 'master';
  };

  console.log('shouldDeleteBucket: ', shouldDeleteBucket);
  return { shouldDeleteBucket, branchName, repoName };
}

function allBucketsByRepo(branchName, repoName) {
  let buckets = [];
  if (repoName === 'hobbes') {
    buckets = [
      `${branchName}-${repoName}`,
      `${branchName}-dev`,
      `${branchName}-test`
    ];
  } else {
    // baloo repo only has one bucket
    buckets.push(`${branchName}-${repoName}`);
  }
  return buckets;
};

async function handleWebhookEvent(eventType, webhookBody) {
  if (!['pull_request', 'delete'].includes(eventType)) {
    const message = `Event ignored. Event type: ${eventType}`;
    return { statusCode: 200, body: message };
  }

  const { shouldDeleteBucket, branchName, repoName } = parseWebhookBody(eventType, webhookBody);

  if (!shouldDeleteBucket) {
    const message = `Event should not delete bucket(s): shouldDeleteBucket: ${shouldDeleteBucket}, eventType: ${eventType}`;
    return { statusCode: 200, body: message };
  } else {
    const buckets = allBucketsByRepo(branchName, repoName);
    for (bucket of buckets) {
      await deleteS3Bucket(bucket);
    }
    message = `${buckets.join(', ')} bucket(s) deleted`;
    return { statusCode: 200,  body: message };
  }
};

module.exports.handler = async (event, context) => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  let response;

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
