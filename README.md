# aws_lambdas
Repository for AWS Lambda functions

## DeleteS3FeatureBucket

### Setup
1. Create a Lambda function on AWS and add an API Gateway Trigger that proxies ANY request
2. Use the code found in delete_s3_feature_bucket.js as the lambda handler
3. Add the API endpoint url to your Github repository's webhooks
4. Generate bucket names using this pattern: `${BRANCH_NAME}-${REPO_NAME}`
5. When a PR is merged, this webhook will try to delete any s3 buckets that match the named pattern (branch-name-repo-name).
