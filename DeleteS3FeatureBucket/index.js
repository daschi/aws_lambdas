const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function constructResponse(statusCode, bodyMessage) {
  return { statusCode: statusCode, body: bodyMessage };
}

async function deleteS3Bucket(bucket) {
  let objects;

  try {
    let response = await s3.listObjects({ Bucket: bucket }).promise();
    objects = response['Contents'].map((object) => { return { 'Key': object['Key'] } });
  } catch (e) {
    console.log(e);
    throw new Error(e);
  };

  if (objects.length > 0) {
    console.log(`deleting contents for bucket ${bucket}`);
    await s3.deleteObjects({ Bucket: bucket, Delete: { Objects: objects } }).promise();
    console.log(`deleting bucket ${bucket}`);
    await s3.deleteBucket({ Bucket: bucket }).promise();
  } else {
    console.log(`deleting bucket ${bucket}`);
    await s3.deleteBucket({ Bucket: bucket }).promise();
  };
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
};

async function bucketExists(bucket) {
  try {
    const data = await s3.headBucket({ Bucket: bucket }).promise();
    return true;
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`'${bucket}' bucket does not exist, skipping.`)
      return false;
    };
    throw err;
  };
}

async function validBuckets(buckets) {
  let validBuckets = [];
  for (bucket of buckets) {
    const validBucket = await bucketExists(bucket);
    if (validBucket) {
      validBuckets.push(bucket);
    };
  };
  return validBuckets;
};

async function allBucketsByRepo(branchName, repoName) {
  const hobbesbuckets = [
    `${branchName}-${repoName}`,
    `${branchName}-dev`,
    `${branchName}-test`
  ];
  const balooBuckets = [`${branchName}-${repoName}`];
  const allBuckets = repoName === 'hobbes' ? hobbesbuckets : balooBuckets;
  return await validBuckets(allBuckets);
};

async function handleWebhookEvent(eventType, webhookBody) {
  if (!['pull_request', 'delete'].includes(eventType)) {
    return constructResponse(200, `Event ignored. Event type: ${eventType}`);
  };

  const { shouldDeleteBucket, branchName, repoName } = parseWebhookBody(eventType, webhookBody);

  if (!shouldDeleteBucket) {
    const message = `Event should not delete bucket(s): shouldDeleteBucket: ${shouldDeleteBucket}, eventType: ${eventType}`;
    return constructResponse(200, message);
  } else {
    const buckets = await allBucketsByRepo(branchName, repoName);
    for (bucket of buckets) {
      await deleteS3Bucket(bucket);
    };
    const message = buckets.length > 0 ? `${buckets.join(', ')} bucket(s) deleted` : 'no buckets to delete';
    return constructResponse(200, message);
  };
};

module.exports.handler = async (event, context) => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  let response;

  if (!event.body) {
    response = constructResponse(403, 'Missing event body');
    console.log(`Response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  let body;

  try {
    body = JSON.parse(event.body);
  } catch (e) {
    response = constructResponse(200, 'Event body is not JSON, Ignoring event.');
    console.log(`Request Event Body is not JSON: ${event.body}`);
    console.log(`Error: ${e}`);
    return response
  };

  console.log(`Event body: ${JSON.stringify(body, null, 2)}`);

  const gitHubEvent = event.headers['X-GitHub-Event'];
  response = await handleWebhookEvent(gitHubEvent, body);

  console.log(`Response: ${JSON.stringify(response, null, 2)}`);
  return response;
};
